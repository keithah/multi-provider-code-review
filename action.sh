#!/usr/bin/env bash

set -euo pipefail

if ! command -v npm >/dev/null 2>&1; then
  echo "npm is required but not found on PATH."
  exit 1
fi

if ! command -v python >/dev/null 2>&1; then
  echo "python is required but not found on PATH. Please ensure Python is installed on the runner."
  exit 1
fi

if ! command -v opencode >/dev/null 2>&1; then
  echo "opencode CLI not found; installing via npm (opencode-ai)..."
  NPM_PREFIX="${NPM_PREFIX:-$HOME/.npm-global}"
  mkdir -p "$NPM_PREFIX"
  npm config set prefix "$NPM_PREFIX"
  npm install -g opencode-ai@latest
  export PATH="$NPM_PREFIX/bin:$PATH"
fi

if ! command -v opencode >/dev/null 2>&1; then
  echo "opencode CLI is required but not found in PATH. Please install it before running this action."
  exit 1
fi

if ! command -v gh >/dev/null 2>&1; then
  echo "GitHub CLI (gh) is required but not found in PATH."
  exit 1
fi

REPO="${GITHUB_REPOSITORY:-}"
if [ -z "$REPO" ]; then
  echo "GITHUB_REPOSITORY is not set; unable to determine repository."
  exit 1
fi

CONFIG_FILE=".github/multi-review.yml"
CONFIG_SOURCE="defaults"
# default provider pools (defined early to avoid unset use during fallback)
DEFAULT_OPENROUTER_PROVIDERS=("openrouter/google/gemini-2.0-flash-exp:free" "openrouter/mistralai/devstral-2512:free" "openrouter/xiaomi/mimo-v2-flash:free")
FALLBACK_OPENCODE_PROVIDERS=("opencode/big-pickle" "opencode/grok-code" "opencode/minimax-m2.1-free" "opencode/glm-4.7-free")
# initialize configurable inputs to avoid set -u errors during config merge
REVIEW_PROVIDERS="${REVIEW_PROVIDERS:-}"
SYNTHESIS_MODEL="${SYNTHESIS_MODEL:-}"
INLINE_MAX_COMMENTS="${INLINE_MAX_COMMENTS:-}"
INLINE_MIN_SEVERITY="${INLINE_MIN_SEVERITY:-}"
INLINE_MIN_AGREEMENT="${INLINE_MIN_AGREEMENT:-}"
DIFF_MAX_BYTES="${DIFF_MAX_BYTES:-}"
RUN_TIMEOUT_SECONDS="${RUN_TIMEOUT_SECONDS:-}"
MIN_CHANGED_LINES="${MIN_CHANGED_LINES:-}"
MAX_CHANGED_FILES="${MAX_CHANGED_FILES:-}"
PROVIDER_ALLOWLIST_RAW="${PROVIDER_ALLOWLIST_RAW:-}"
PROVIDER_BLOCKLIST_RAW="${PROVIDER_BLOCKLIST_RAW:-}"
SKIP_LABELS_RAW="${SKIP_LABELS_RAW:-}"
if [ -f "$CONFIG_FILE" ]; then
  echo "Loading config from ${CONFIG_FILE}"
  CONFIG_EXPORTS=$(python - "$CONFIG_FILE" <<'PYCODE' || true
import os, sys, json, subprocess, tempfile
path = sys.argv[1]
def load_yaml(p):
    try:
        import yaml  # type: ignore
    except Exception:
        try:
            subprocess.run([sys.executable, "-m", "pip", "install", "pyyaml==6.0.2", "--quiet"], check=True, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
            import yaml  # type: ignore
        except Exception:
            sys.stderr.write("Failed to import/install pyyaml; YAML config will be skipped.\n")
            return None
    try:
        with open(p, "r", encoding="utf-8") as f:
            return yaml.safe_load(f)
    except Exception:
        return None

def load_json(p):
    try:
        with open(p, "r", encoding="utf-8") as f:
            return json.load(f)
    except Exception:
        return None

data = load_yaml(path)
if data is None:
    data = load_json(path)

if not isinstance(data, dict):
    sys.exit(0)

exports = {}
def set_if(key, env_key, cast=None):
    if key in data and data[key] is not None:
        val = data[key]
        if cast:
            try:
                val = cast(val)
            except Exception:
                return
        exports[env_key] = val

providers = data.get("providers")
if isinstance(providers, list):
    exports["REVIEW_PROVIDERS"] = ",".join(str(p) for p in providers if p)
elif isinstance(providers, str) and providers.strip():
    exports["REVIEW_PROVIDERS"] = providers

set_if("synthesis_model", "SYNTHESIS_MODEL", str)
set_if("inline_max_comments", "INLINE_MAX_COMMENTS", int)
set_if("inline_min_severity", "INLINE_MIN_SEVERITY", str)
set_if("inline_min_agreement", "INLINE_MIN_AGREEMENT", int)
set_if("diff_max_bytes", "DIFF_MAX_BYTES", int)
set_if("run_timeout_seconds", "RUN_TIMEOUT_SECONDS", int)
set_if("min_changed_lines", "MIN_CHANGED_LINES", int)
set_if("max_changed_files", "MAX_CHANGED_FILES", int)
if "provider_allowlist" in data:
    val = data["provider_allowlist"]
    if isinstance(val, list):
        exports["PROVIDER_ALLOWLIST"] = ",".join(str(x) for x in val)
    elif isinstance(val, str):
        exports["PROVIDER_ALLOWLIST"] = val
if "provider_blocklist" in data:
    val = data["provider_blocklist"]
    if isinstance(val, list):
        exports["PROVIDER_BLOCKLIST"] = ",".join(str(x) for x in val)
    elif isinstance(val, str):
        exports["PROVIDER_BLOCKLIST"] = val
if "skip_labels" in data:
    val = data["skip_labels"]
    if isinstance(val, list):
        exports["SKIP_LABELS"] = ",".join(str(x) for x in val)
    elif isinstance(val, str):
        exports["SKIP_LABELS"] = val

print(json.dumps(exports))
PYCODE
  )
  if [ -n "$CONFIG_EXPORTS" ]; then
    CONFIG_SOURCE="$CONFIG_FILE"
    if command -v jq >/dev/null 2>&1; then
      REVIEW_PROVIDERS="$(echo "$CONFIG_EXPORTS" | jq -r '.REVIEW_PROVIDERS // "'$REVIEW_PROVIDERS'"')"
      SYNTHESIS_MODEL="$(echo "$CONFIG_EXPORTS" | jq -r '.SYNTHESIS_MODEL // "'$SYNTHESIS_MODEL'"')"
      INLINE_MAX_COMMENTS="$(echo "$CONFIG_EXPORTS" | jq -r '.INLINE_MAX_COMMENTS // "'$INLINE_MAX_COMMENTS'"')"
      INLINE_MIN_SEVERITY="$(echo "$CONFIG_EXPORTS" | jq -r '.INLINE_MIN_SEVERITY // "'$INLINE_MIN_SEVERITY'"')"
      INLINE_MIN_AGREEMENT="$(echo "$CONFIG_EXPORTS" | jq -r '.INLINE_MIN_AGREEMENT // "'$INLINE_MIN_AGREEMENT'"')"
      DIFF_MAX_BYTES="$(echo "$CONFIG_EXPORTS" | jq -r '.DIFF_MAX_BYTES // "'$DIFF_MAX_BYTES'"')"
      RUN_TIMEOUT_SECONDS="$(echo "$CONFIG_EXPORTS" | jq -r '.RUN_TIMEOUT_SECONDS // "'$RUN_TIMEOUT_SECONDS'"')"
      MIN_CHANGED_LINES="$(echo "$CONFIG_EXPORTS" | jq -r '.MIN_CHANGED_LINES // "'$MIN_CHANGED_LINES'"')"
      MAX_CHANGED_FILES="$(echo "$CONFIG_EXPORTS" | jq -r '.MAX_CHANGED_FILES // "'$MAX_CHANGED_FILES'"')"
      PROVIDER_ALLOWLIST_RAW="$(echo "$CONFIG_EXPORTS" | jq -r '.PROVIDER_ALLOWLIST // ""')"
      PROVIDER_BLOCKLIST_RAW="$(echo "$CONFIG_EXPORTS" | jq -r '.PROVIDER_BLOCKLIST // ""')"
      SKIP_LABELS_RAW="$(echo "$CONFIG_EXPORTS" | jq -r '.SKIP_LABELS // ""')"
    else
      read -r REVIEW_PROVIDERS SYNTHESIS_MODEL INLINE_MAX_COMMENTS INLINE_MIN_SEVERITY INLINE_MIN_AGREEMENT DIFF_MAX_BYTES RUN_TIMEOUT_SECONDS MIN_CHANGED_LINES MAX_CHANGED_FILES PROVIDER_ALLOWLIST_RAW PROVIDER_BLOCKLIST_RAW SKIP_LABELS_RAW <<EOF
$(python - "$CONFIG_EXPORTS" "$REVIEW_PROVIDERS" "$SYNTHESIS_MODEL" "$INLINE_MAX_COMMENTS" "$INLINE_MIN_SEVERITY" "$INLINE_MIN_AGREEMENT" "$DIFF_MAX_BYTES" "$RUN_TIMEOUT_SECONDS" "$MIN_CHANGED_LINES" "$MAX_CHANGED_FILES" "" "" "" <<'PYCODE'
import json, sys
data = json.loads(sys.argv[1])
defaults = sys.argv[2:]
keys = ["REVIEW_PROVIDERS","SYNTHESIS_MODEL","INLINE_MAX_COMMENTS","INLINE_MIN_SEVERITY","INLINE_MIN_AGREEMENT","DIFF_MAX_BYTES","RUN_TIMEOUT_SECONDS","MIN_CHANGED_LINES","MAX_CHANGED_FILES","PROVIDER_ALLOWLIST","PROVIDER_BLOCKLIST","SKIP_LABELS"]
out = []
for i,k in enumerate(keys):
    out.append(str(data.get(k, defaults[i] if i < len(defaults) else "")))
print(" ".join(out))
PYCODE
)
EOF
    fi
  fi
fi
# Prefer explicit workflow input SKIP_LABELS over config/defaults
SKIP_LABELS_RAW="${SKIP_LABELS:-$SKIP_LABELS_RAW}"

if [ -z "$REVIEW_PROVIDERS" ]; then
  RAW_PROVIDERS=()
else
  mapfile -t RAW_PROVIDERS < <(printf "%s" "$REVIEW_PROVIDERS" | tr ',' '\n')
fi
PROVIDERS=()
for raw_provider in "${RAW_PROVIDERS[@]}"; do
  provider="$(echo "$raw_provider" | xargs)"
  [ -z "$provider" ] && continue
  if [[ "$provider" == openrouter/* ]] && [ -z "$OPENROUTER_API_KEY" ]; then
    echo "Skipping ${provider} because OPENROUTER_API_KEY is not set (will fall back if none remain)."
    continue
  fi
  PROVIDERS+=("$provider")
done

if [ "${#PROVIDERS[@]}" -eq 0 ]; then
  if [ -z "$OPENROUTER_API_KEY" ]; then
    echo "OPENROUTER_API_KEY is not set; using OpenCode fallback providers."
    PROVIDERS=("${FALLBACK_OPENCODE_PROVIDERS[@]}")
  else
    echo "No providers specified; using default OpenRouter providers."
    PROVIDERS=("${DEFAULT_OPENROUTER_PROVIDERS[@]}")
  fi
fi

if [ -n "${PROVIDER_ALLOWLIST_RAW:-}" ]; then
  IFS=',' read -ra AL <<< "$PROVIDER_ALLOWLIST_RAW"
  tmp=()
  for p in "${PROVIDERS[@]}"; do
    for a in "${AL[@]}"; do
      a_trim="$(echo "$a" | xargs)"
      [ -z "$a_trim" ] && continue
      if [ "$p" = "$a_trim" ]; then
        tmp+=("$p")
        break
      fi
    done
  done
  PROVIDERS=("${tmp[@]}")
fi

if [ -n "${PROVIDER_BLOCKLIST_RAW:-}" ]; then
  IFS=',' read -ra BL <<< "$PROVIDER_BLOCKLIST_RAW"
  tmp=()
  for p in "${PROVIDERS[@]}"; do
    skip=false
    for b in "${BL[@]}"; do
      b_trim="$(echo "$b" | xargs)"
      [ -z "$b_trim" ] && continue
      if [ "$p" = "$b_trim" ]; then
        skip=true
        break
      fi
    done
    if ! $skip; then
      tmp+=("$p")
    fi
  done
  PROVIDERS=("${tmp[@]}")
fi

if [ "${#PROVIDERS[@]}" -eq 0 ]; then
  echo "No review providers available after processing configuration."
  exit 1
fi

if [[ "$SYNTHESIS_MODEL" == openrouter/* ]] && [ -z "$OPENROUTER_API_KEY" ]; then
  echo "OpenRouter synthesis model requested but OPENROUTER_API_KEY is not set; falling back to opencode/big-pickle."
  SYNTHESIS_MODEL="opencode/big-pickle"
fi

# Validate numeric inputs early to avoid arithmetic errors
is_int='^[0-9]+$'
for var_name in PROVIDER_LIMIT MIN_CHANGED_LINES MAX_CHANGED_FILES INLINE_MAX_COMMENTS INLINE_MIN_AGREEMENT RUN_TIMEOUT_SECONDS DIFF_MAX_BYTES PROVIDER_RETRIES; do
  val="${!var_name}"
  if ! [[ "$val" =~ $is_int ]]; then
    printf -v "$var_name" "%s" "0"
  fi
done

# Limit providers if requested (deterministic rotation based on PR number)
if [ "$PROVIDER_LIMIT" -gt 0 ] && [ "${#PROVIDERS[@]}" -gt "$PROVIDER_LIMIT" ]; then
  pr_hash=${PR_NUMBER//[^0-9]/}
  [ -z "$pr_hash" ] && pr_hash=1
  start=$((pr_hash % ${#PROVIDERS[@]}))
  selected=()
  for i in $(seq 0 $((PROVIDER_LIMIT - 1))); do
    idx=$(((start + i) % ${#PROVIDERS[@]}))
    selected+=("${PROVIDERS[$idx]}")
  done
  PROVIDERS=("${selected[@]}")
fi

SYNTHESIS_MODEL="${SYNTHESIS_MODEL:-openrouter/google/gemini-2.0-flash-exp:free}"
DIFF_MAX_BYTES="${DIFF_MAX_BYTES:-120000}"
RUN_TIMEOUT_SECONDS="${RUN_TIMEOUT_SECONDS:-600}"
OPENROUTER_API_KEY="${OPENROUTER_API_KEY:-}"
INLINE_MAX_COMMENTS="${INLINE_MAX_COMMENTS:-5}"
INLINE_MIN_SEVERITY="${INLINE_MIN_SEVERITY:-major}"
INLINE_MIN_AGREEMENT="${INLINE_MIN_AGREEMENT:-1}"
PROVIDER_LIMIT="${PROVIDER_LIMIT:-0}"
PROVIDER_RETRIES="${PROVIDER_RETRIES:-2}"
MIN_CHANGED_LINES="${MIN_CHANGED_LINES:-0}"
MAX_CHANGED_FILES="${MAX_CHANGED_FILES:-0}"
PROVIDER_ALLOWLIST_RAW="${PROVIDER_ALLOWLIST_RAW:-}"
PROVIDER_BLOCKLIST_RAW="${PROVIDER_BLOCKLIST_RAW:-}"
SKIP_LABELS_RAW="${SKIP_LABELS_RAW:-}"
ESTIMATED_COST_TOTAL="unknown"
ESTIMATED_COST_DETAILS=()
TOTAL_PROMPT_TOKENS=0
TOTAL_COMPLETION_TOKENS=0
TOTAL_TOKENS=0
BUDGET_MAX_USD="${BUDGET_MAX_USD:-0}"
PROVIDER_ALLOWLIST=()
PROVIDER_BLOCKLIST=()
SKIP_LABELS=()
REPORT_BASENAME="${REPORT_BASENAME:-multi-provider-review}"
REPORT_DIR="${GITHUB_WORKSPACE:-$PWD}/multi-provider-report"
mkdir -p "$REPORT_DIR"

TMP_DIR="$(mktemp -d -t mpr.XXXXXX)"
trap 'rm -rf "$TMP_DIR"' EXIT
PR_FILES="${TMP_DIR}/pr-files.json"
DIFF_FILE="${TMP_DIR}/pr.diff"
PR_META="${TMP_DIR}/pr-meta.json"
PR_META_FIELDS="${TMP_DIR}/pr-meta-fields"
PRICING_CACHE="${TMP_DIR}/openrouter-models.json"
PROMPT_FILE="${TMP_DIR}/review-prompt.txt"
SKIP_COMMENT="${TMP_DIR}/skip-comment.md"
BUDGET_SKIP="${TMP_DIR}/budget-skip.md"
REVIEWS_DIR="${TMP_DIR}/reviews"
mkdir -p "$REVIEWS_DIR"
PROVIDER_REPORT_JL="${TMP_DIR}/provider-report.jsonl"
COST_INFO="${TMP_DIR}/cost-info.json"
PROVIDER_FINDINGS_FILE="${TMP_DIR}/provider-findings.json"
SYN_PROMPT="${TMP_DIR}/synthesis-prompt.txt"
SYNTHESIS_OUTPUT="${TMP_DIR}/synthesis.txt"
SYNTHESIS_LOG="${TMP_DIR}/synthesis.log"
COMMENT_FILE="${TMP_DIR}/final-review.md"
COMMENT_CHUNK_PREFIX="${TMP_DIR}/comment-chunk"
MISSING_TEST_FILES="${TMP_DIR}/missing-tests.txt"
GEMINI_RATE_FILE="${TMP_DIR}/gemini-rate-limit.flag"
RATE_LIMITED_GEMINI="false"

run_with_timeout() {
  if command -v timeout >/dev/null 2>&1; then
    timeout "${RUN_TIMEOUT_SECONDS}s" "$@"
  else
    "$@"
  fi
}

run_openrouter() {
  local provider="$1"
  local prompt="$2"
  local outfile="$3"
  local usagefile="${4:-}"

  if [ -z "$OPENROUTER_API_KEY" ]; then
    echo "OpenRouter provider ${provider} requested but OPENROUTER_API_KEY is not set."
    return 1
  fi

  local model="${provider#openrouter/}"
  local payload_file
  local response_file
  local curl_cfg
  payload_file=$(mktemp) || return 1
  response_file=$(mktemp) || return 1
  curl_cfg=$(mktemp) || return 1

  if ! python - "$prompt" "$model" "$payload_file" >/dev/null <<'PYCODE'
import json, sys
prompt, model, path = sys.argv[1], sys.argv[2], sys.argv[3]
payload = {
    "model": model,
    "messages": [{"role": "user", "content": prompt}],
    "temperature": 0.1,
    "max_tokens": 1200,
}
with open(path, "w", encoding="utf-8") as f:
    json.dump(payload, f)
PYCODE
  then
    return 1
  fi

  cat > "$curl_cfg" <<EOF
url = https://openrouter.ai/api/v1/chat/completions
request = POST
header = Content-Type: application/json
header = Authorization: Bearer ${OPENROUTER_API_KEY}
header = HTTP-Referer: https://github.com/keithah/multi-provider-code-review
header = X-Title: Multi-Provider Code Review
data = @${payload_file}
silent
show-error
write-out = %{http_code}
output = ${response_file}
EOF

  http_status=$(run_with_timeout curl --config "$curl_cfg")
  curl_rc=$?
  rm -f "$curl_cfg"
  if [ $curl_rc -ne 0 ]; then
    echo "curl failed for OpenRouter provider ${provider} (rc=${curl_rc})" >&2
    return 1
  fi
  if ! [[ "$http_status" =~ ^2[0-9][0-9]$ ]]; then
    echo "OpenRouter provider ${provider} returned HTTP ${http_status}" >&2
    if [ "$http_status" = "429" ] && [[ "$provider" == "openrouter/google/gemini-2.0-flash-exp:free" ]]; then
      echo "Gemini free model rate limited; will avoid for synthesis." >&2
      echo "limited" > "$GEMINI_RATE_FILE"
    fi
    head -c 500 "${response_file}" >&2 || true
    return 1
  fi

  python - "$response_file" "$outfile" "$usagefile" >/dev/null <<'PYCODE'
import json, sys, os
resp_path, out_path, usage_path = sys.argv[1], sys.argv[2], sys.argv[3]
data = json.load(open(resp_path, encoding="utf-8"))
choices = data.get("choices") or []
if not choices:
    raise SystemExit("No choices in response")
content = choices[0].get("message", {}).get("content", "")
with open(out_path, "w", encoding="utf-8") as f:
    f.write(content)
usage = data.get("usage") or {}
if usage_path:
    try:
        with open(usage_path, "w", encoding="utf-8") as uf:
            json.dump({
                "prompt_tokens": usage.get("prompt_tokens"),
                "completion_tokens": usage.get("completion_tokens"),
                "total_tokens": usage.get("total_tokens")
            }, uf)
    except Exception:
        pass
PYCODE
  if [ $? -ne 0 ]; then
    echo "Failed to parse OpenRouter response for ${provider}" >&2
    cat "${response_file}" >&2 || true
    return 1
  fi

  return 0
}

PR_TITLE_VALUE="${PR_TITLE}"
PR_BODY_VALUE="${PR_BODY}"

AGENTS_SECTION=""
if [ "${HAS_AGENTS}" = "true" ] && [ -f "AGENTS.md" ]; then
  AGENTS_CONTENT=$(head -c 2000 AGENTS.md)
  AGENTS_SECTION=$'\n\n## Project Guidelines (from AGENTS.md)\n'"${AGENTS_CONTENT}"
fi

gh api "/repos/${REPO}/pulls/${PR_NUMBER}/files" > "$PR_FILES" || true
DIFF_TRUNCATED="false"
TOTAL_ADDITIONS=0
TOTAL_DELETIONS=0
CHANGED_FILES=0
LABELS_CSV=""
SKIP_REASON=""

if gh api "/repos/${REPO}/pulls/${PR_NUMBER}" > "$PR_META"; then
  if command -v jq >/dev/null 2>&1; then
    TOTAL_ADDITIONS=$(jq -r '.additions // 0' "$PR_META")
    TOTAL_DELETIONS=$(jq -r '.deletions // 0' "$PR_META")
    CHANGED_FILES=$(jq -r '.changed_files // 0' "$PR_META")
    LABELS_CSV=$(jq -r '[.labels[]?.name] | join(",")' "$PR_META")
  else
    python - "$PR_META" <<'PYCODE' >"$PR_META_FIELDS" 2>/dev/null || true
import json, sys
data = json.load(open(sys.argv[1]))
adds = data.get("additions", 0)
dels = data.get("deletions", 0)
files = data.get("changed_files", 0)
labels = [l.get("name","") for l in data.get("labels", []) if l.get("name")]
print(f"{adds} {dels} {files} {','.join(labels)}")
PYCODE
    read -r TOTAL_ADDITIONS TOTAL_DELETIONS CHANGED_FILES LABELS_CSV < "$PR_META_FIELDS" || true
  fi
fi

if gh api "/repos/${REPO}/pulls/${PR_NUMBER}" -H "Accept: application/vnd.github.v3.diff" > "$DIFF_FILE"; then
  DIFF_SIZE=$(wc -c < "$DIFF_FILE")
  if [ "$DIFF_SIZE" -gt "$DIFF_MAX_BYTES" ]; then
    echo "Diff is ${DIFF_SIZE} bytes, truncating to ${DIFF_MAX_BYTES}."
    head -c "$DIFF_MAX_BYTES" "$DIFF_FILE" > "${DIFF_FILE}.tmp"
    echo $'\n\n[Diff truncated for length]' >> "${DIFF_FILE}.tmp"
    mv "${DIFF_FILE}.tmp" "$DIFF_FILE"
    DIFF_TRUNCATED="true"
  fi
else
  echo "Warning: Unable to fetch PR diff via gh api."
  DIFF_FILE=""
fi

# Detect likely missing tests (repo-aware) before building the prompt
python - "$PR_FILES" "$MISSING_TEST_FILES" "${GITHUB_WORKSPACE:-}" <<'PYCODE' 2>/dev/null || true
import json, sys, os, re
files_path, out_path, repo_root = sys.argv[1:]
repo_root = repo_root or "."
try:
    files = json.load(open(files_path, encoding="utf-8"))
except Exception:
    files = []

changed = set()
for f in files:
    if isinstance(f, dict):
        name = f.get("filename") or ""
        if name:
            changed.add(name)

test_patterns = re.compile(r"(test|spec|__tests__|__snapshots__|\.test\.|\.spec\.|Tests/|Spec/)", re.IGNORECASE)
missing = []
for f in files:
    if not isinstance(f, dict):
        continue
    name = f.get("filename") or ""
    if not name or test_patterns.search(name):
        continue
    base = os.path.basename(name)
    root, ext = os.path.splitext(base)
    candidates = [
        name.replace(base, f"{root}.test{ext}"),
        name.replace(base, f"{root}.spec{ext}"),
    ]
    has_match = False
    for cand in candidates:
        ws_path = os.path.join(repo_root, cand)
        if cand in changed or os.path.exists(ws_path):
            has_match = True
            break
    if not has_match:
        missing.append(name)

missing = missing[:5]
if missing:
    with open(out_path, "w", encoding="utf-8") as f:
        f.write("\n".join(missing))
else:
    try:
        os.remove(out_path)
    except OSError:
        pass
PYCODE

cat > "$PROMPT_FILE" <<EOF
REPO: ${REPO}
PR NUMBER: ${PR_NUMBER}
PR TITLE: ${PR_TITLE_VALUE}
PR DESCRIPTION:
${PR_BODY_VALUE}

Please review this pull request and provide a comprehensive code review focusing on:

## Code Quality & Best Practices
- Clean code principles and readability
- Proper error handling and edge cases
- TypeScript/JavaScript best practices
- Consistent naming conventions

## Bug Detection
- Logic errors and edge cases
- Unhandled error scenarios
- Race conditions and concurrency issues
- Input validation and sanitization

## Performance
- Inefficient algorithms or operations
- Memory leaks and unnecessary allocations
- Large file handling

## Security
- SQL injection, XSS, CSRF vulnerabilities
- Authentication/authorization issues
- Sensitive data exposure

## Testing
- Test coverage gaps
- Missing edge case handling${AGENTS_SECTION}

## AI-Generated Code Likelihood
- Estimate the likelihood (0-100%) that the changed code was AI-generated. Give a brief rationale.

## Output Format
- Provide specific file and line numbers when possible
- Include code suggestions in fenced code blocks using the GitHub suggestion format when appropriate:
  ```suggestion
  // code change
  ```
- Return a structured JSON block at the end, on its own line, containing findings. Use this shape exactly:
  ```json
  {
    "findings": [
      {
        "file": "path/to/file.ext",
        "line": 123,
        "severity": "critical|major|minor",
        "title": "short title",
        "message": "concise description",
        "suggestion": "optional code snippet or empty string"
      }
    ]
  }
  ```
- Summarize key findings and risks at the end

IMPORTANT: Only flag actual issues. If everything looks good, respond with 'lgtm'.
EOF

if [ -s "$PR_FILES" ]; then
  echo $'\n\n## Changed Files' >> "$PROMPT_FILE"
  if command -v jq >/dev/null 2>&1; then
    jq -r '.[] | "- " + .filename + " (+" + (.additions|tostring) + "/-" + (.deletions|tostring) + ")"' "$PR_FILES" >> "$PROMPT_FILE"
  else
    python - <<'PYCODE' "$PR_FILES" >> "$PROMPT_FILE" || true
import json, sys
try:
    files = json.load(open(sys.argv[1]))
    for f in files:
        additions = f.get("additions", 0)
        deletions = f.get("deletions", 0)
        print(f"- {f.get('filename', 'unknown')} (+{additions}/-{deletions})")
except Exception:
    pass
PYCODE
  fi
fi

ONLY_BINARY="false"
TEST_HINT=""
TEST_HINT_FLAG="false"
if [ -s "$PR_FILES" ]; then
  if command -v jq >/dev/null 2>&1; then
    PATCH_COUNT=$(jq '[.[] | has("patch")] | map(select(.==true)) | length' "$PR_FILES")
    FILE_COUNT=$(jq 'length' "$PR_FILES")
    if [ "$FILE_COUNT" -gt 0 ] && [ "$PATCH_COUNT" -eq 0 ]; then
      ONLY_BINARY="true"
    fi
    TEST_COUNT=$(jq '[.[] | select(.filename|test("test|spec|__tests__|__snapshots__|\\.test\\.|\\.spec\\.|Tests/|Spec/"))] | length' "$PR_FILES")
    SOURCE_COUNT=$(jq 'length' "$PR_FILES")
  else
    PATCH_COUNT=0; FILE_COUNT=0; TEST_COUNT=0; SOURCE_COUNT=0
  fi

  if [ "$SOURCE_COUNT" -gt 0 ] && [ "$TEST_COUNT" -eq 0 ]; then
    TEST_HINT=$'\n\n## Test Coverage Hints\nNo tests were changed in this PR; consider adding coverage for the touched files.'
    TEST_HINT_FLAG="true"
  fi
fi

if [ "$ONLY_BINARY" = "true" ]; then
  SKIP_REASON="Skipping review: only binary changes detected."
fi

TOTAL_CHANGES=$((TOTAL_ADDITIONS + TOTAL_DELETIONS))
if [ "$MIN_CHANGED_LINES" -gt 0 ] && [ "$TOTAL_CHANGES" -lt "$MIN_CHANGED_LINES" ]; then
  SKIP_REASON="Skipping review: changes ($TOTAL_CHANGES lines) below min_changed_lines=$MIN_CHANGED_LINES."
fi
if [ "$MAX_CHANGED_FILES" -gt 0 ] && [ "$CHANGED_FILES" -gt "$MAX_CHANGED_FILES" ]; then
  SKIP_REASON="Skipping review: changed_files ($CHANGED_FILES) exceeds max_changed_files=$MAX_CHANGED_FILES."
fi

if [ -n "$SKIP_LABELS_RAW" ] && [ -n "$LABELS_CSV" ]; then
  IFS=',' read -ra SKIP_L <<< "$SKIP_LABELS_RAW"
  for lbl in "${SKIP_L[@]}"; do
    ltrim="$(echo "$lbl" | xargs)"
    [ -z "$ltrim" ] && continue
    case ",$LABELS_CSV," in
      *",$ltrim,"*) SKIP_REASON="Skipping review: label '$ltrim' is in skip_labels."; break;;
    esac
  done
fi

if [ -n "$SKIP_REASON" ]; then
  echo "$SKIP_REASON"
  echo "$SKIP_REASON" > "$SKIP_COMMENT"
  gh api --method POST -H "Accept: application/vnd.github+json" "/repos/${REPO}/issues/${PR_NUMBER}/comments" -F body=@"$SKIP_COMMENT"
  exit 0
fi

export TOTAL_ADDITIONS TOTAL_DELETIONS CHANGED_FILES ONLY_BINARY TEST_HINT_FLAG

if [ -n "${DIFF_FILE}" ] && [ -f "${DIFF_FILE}" ]; then
  echo $'\n\n## Diff' >> "$PROMPT_FILE"
  cat "${DIFF_FILE}" >> "$PROMPT_FILE"
fi

if [ -n "$TEST_HINT" ]; then
  echo "$TEST_HINT" >> "$PROMPT_FILE"
fi
if [ -s "$MISSING_TEST_FILES" ]; then
  echo $'\n\n## Possible missing tests' >> "$PROMPT_FILE"
  while IFS= read -r line; do
    printf -- "- %s\n" "$line" >> "$PROMPT_FILE"
  done < "$MISSING_TEST_FILES"
fi

PROMPT_CONTENT="$(cat "$PROMPT_FILE")"
PROMPT_SIZE="$(wc -c < "$PROMPT_FILE")"

echo "========================================"
echo "Running multi-provider code review"
echo "========================================"
echo "Review prompt size: $(wc -c < "$PROMPT_FILE") bytes"
echo "Providers: ${PROVIDERS[*]}"
echo "Synthesis model: ${SYNTHESIS_MODEL}"
echo ""

mkdir -p "$REVIEWS_DIR"
: > "$PROVIDER_REPORT_JL"
PROVIDER_LIST=()
PIDS=()
for raw_provider in "${PROVIDERS[@]}"; do
  provider="$(echo "$raw_provider" | xargs)"
  [ -z "$provider" ] && continue
  PROVIDER_LIST+=("$provider")
  outfile="${REVIEWS_DIR}/$(echo "$provider" | tr '/:' '__').txt"
  log_file="${outfile}.log"
  usage_file="${outfile}.usage.json"
  report_line="${outfile}.report"
  (
    echo "Running provider: ${provider}"
    provider_start=$(date +%s)
    status_label="failed"
    attempt=1
    while [ $attempt -le "$PROVIDER_RETRIES" ]; do
      if [[ "$provider" == openrouter/* ]]; then
        if run_openrouter "${provider}" "${PROMPT_CONTENT}" "${outfile}" "${usage_file}" > "${log_file}" 2>&1; then
          status_label="success"
        fi
      else
        if run_with_timeout opencode run -m "${provider}" -- "${PROMPT_CONTENT}" > "$outfile" 2> "${log_file}"; then
          status_label="success"
        fi
      fi
      if [ "$status_label" = "success" ]; then
        echo "✅ ${provider} completed (attempt ${attempt}/${PROVIDER_RETRIES})"
        break
      else
        if [ $attempt -lt "$PROVIDER_RETRIES" ]; then
          echo "Retrying ${provider} (attempt ${attempt}/${PROVIDER_RETRIES})..."
          sleep $((attempt))
        fi
      fi
      attempt=$((attempt + 1))
    done
    if [ "$status_label" != "success" ]; then
      echo "⚠️ ${provider} failed after ${PROVIDER_RETRIES} attempt(s) (see log), capturing partial output"
      echo "Provider ${provider} failed. Log:" > "$outfile"
      cat "${log_file}" >> "$outfile" || true
    fi
    provider_end=$(date +%s)
    duration=$((provider_end - provider_start))
    python - "$provider" "$status_label" "$duration" "$outfile" "$log_file" > "$report_line" <<'PYCODE'
import json, sys, os
name, status, duration_s, out_path, log_path = sys.argv[1:]
try:
    duration = float(duration_s)
except Exception:
    duration = None
usage = {}
usage_path = f"{out_path}.usage.json"
if os.path.exists(usage_path):
    try:
        usage = json.load(open(usage_path, encoding="utf-8"))
    except Exception:
        usage = {}
print(json.dumps({
    "name": name,
    "status": status,
    "duration_seconds": duration,
    "output_path": out_path,
    "log_path": log_path,
    "kind": "openrouter" if name.startswith("openrouter/") else "opencode",
    "usage": usage
}))
PYCODE
  ) &
  PIDS+=($!)
done

if [ "${#PIDS[@]}" -gt 0 ]; then
  if ! wait "${PIDS[@]}"; then
    echo "One or more providers exited with failure status (continuing with available outputs)." >&2
  fi
fi

cat "${REVIEWS_DIR}"/*.report > "$PROVIDER_REPORT_JL" 2>/dev/null || true

# Recompute totals and success count from provider reports (do not hard-fail if empty)
TOTALS_TMP="${PROVIDER_REPORT_JL}.totals"
python - "$PROVIDER_REPORT_JL" <<'PYCODE' > "$TOTALS_TMP" || true
import json, sys
path = sys.argv[1]
total_prompt = total_completion = total_tokens = 0
success = 0
try:
    with open(path, encoding="utf-8") as f:
        for line in f:
            line = line.strip()
            if not line:
                continue
            r = json.loads(line)
            if r.get("status") == "success":
                success += 1
            usage = r.get("usage") or {}
            pt = int(usage.get("prompt_tokens") or 0)
            ct = int(usage.get("completion_tokens") or 0)
            tt = int(usage.get("total_tokens") or (pt + ct))
            total_prompt += pt
            total_completion += ct
            total_tokens += tt
except Exception:
    pass
print(total_prompt)
print(total_completion)
print(total_tokens)
print(success)
PYCODE

if [ -s "$TOTALS_TMP" ]; then
  read -r TOTAL_PROMPT_TOKENS TOTAL_COMPLETION_TOKENS TOTAL_TOKENS PROVIDER_SUCCESS_COUNT < "$TOTALS_TMP"
else
  TOTAL_PROMPT_TOKENS=0
  TOTAL_COMPLETION_TOKENS=0
  TOTAL_TOKENS=0
  PROVIDER_SUCCESS_COUNT=0
fi

# ensure safe defaults
TOTAL_PROMPT_TOKENS=${TOTAL_PROMPT_TOKENS:-0}
TOTAL_COMPLETION_TOKENS=${TOTAL_COMPLETION_TOKENS:-0}
TOTAL_TOKENS=${TOTAL_TOKENS:-0}
PROVIDER_SUCCESS_COUNT=${PROVIDER_SUCCESS_COUNT:-0}

if [ "$PROVIDER_SUCCESS_COUNT" -eq 0 ]; then
  echo "⚠️ All providers reported failure; proceeding with best-effort outputs" >&2
fi

if [ "${#PROVIDER_LIST[@]}" -eq 0 ]; then
  echo "No valid providers ran successfully."
  exit 1
fi

# If Gemini free is rate-limited, avoid using it for synthesis
if [ -f "$GEMINI_RATE_FILE" ]; then
  RATE_LIMITED_GEMINI="true"
fi
if [ "$RATE_LIMITED_GEMINI" = "true" ] && [ "$SYNTHESIS_MODEL" = "openrouter/google/gemini-2.0-flash-exp:free" ]; then
  if [ -n "$OPENROUTER_API_KEY" ]; then
    SYNTHESIS_MODEL="openrouter/mistralai/devstral-2512:free"
  else
    SYNTHESIS_MODEL="opencode/big-pickle"
  fi
  echo "Synthesis model switched due to Gemini free rate limit: ${SYNTHESIS_MODEL}"
fi

USES_OPENROUTER="false"
for p in "${PROVIDER_LIST[@]}"; do
  if [[ "$p" == openrouter/* ]]; then
    USES_OPENROUTER="true"
    break
  fi
done

if [ "$USES_OPENROUTER" = "true" ] && [ -n "$OPENROUTER_API_KEY" ]; then
  if [ ! -f "$PRICING_CACHE" ]; then
    curl -sS -H "Authorization: Bearer ${OPENROUTER_API_KEY}" https://openrouter.ai/api/v1/models > "$PRICING_CACHE" || true
  fi
fi

if [ "$USES_OPENROUTER" = "true" ] && [ -f "$PRICING_CACHE" ]; then
  python - "$PROVIDER_REPORT_JL" "$PRICING_CACHE" "$COST_INFO" <<'PYCODE' || true
import json, sys
from decimal import Decimal
prov_path, models_path, out_path = sys.argv[1:]
models = {}
try:
    data = json.load(open(models_path, encoding="utf-8"))
    for m in data.get("data", []):
        mid = m.get("id")
        pricing = m.get("pricing") or {}
        if mid:
            models[mid] = {
                "prompt": Decimal(str(pricing.get("prompt", "0") or "0")),
                "completion": Decimal(str(pricing.get("completion", "0") or "0")),
            }
except Exception:
    pass

reports = []
try:
    with open(prov_path, encoding="utf-8") as f:
        for line in f:
            line = line.strip()
            if not line:
                continue
            reports.append(json.loads(line))
except Exception:
    pass

total = Decimal("0")
details = []
total_prompt = 0
total_completion = 0
total_tokens = 0
for r in reports:
    name = r.get("name") or ""
    usage = r.get("usage") or {}
    pt = int(usage.get("prompt_tokens") or 0)
    ct = int(usage.get("completion_tokens") or 0)
    tt = int(usage.get("total_tokens") or (pt + ct))
    total_prompt += pt
    total_completion += ct
    total_tokens += tt
    if not name.startswith("openrouter/"):
        continue
    model_id = name.split("/", 1)[1]
    rates = models.get(model_id)
    if not rates:
        details.append(f"{name}: unknown (no pricing)")
        continue
    cost = rates["prompt"] * pt + rates["completion"] * ct
    total += cost
    details.append(f"{name}: ${cost} (prompt={pt}, completion={ct})")

out = {
    "total": str(total) if total else "",
    "details": details,
    "prompt_tokens": total_prompt,
    "completion_tokens": total_completion,
    "total_tokens": total_tokens,
}
with open(out_path, "w", encoding="utf-8") as f:
    json.dump(out, f)
PYCODE
  if [ -f "$COST_INFO" ]; then
    ESTIMATED_COST_TOTAL="$(jq -r '.total // ""' "$COST_INFO" 2>/dev/null || echo "")"
    mapfile -t ESTIMATED_COST_DETAILS < <(jq -r '.details[]' "$COST_INFO" 2>/dev/null || true)
    TOTAL_PROMPT_TOKENS="$(jq -r '.prompt_tokens // 0' "$COST_INFO" 2>/dev/null || echo 0)"
    TOTAL_COMPLETION_TOKENS="$(jq -r '.completion_tokens // 0' "$COST_INFO" 2>/dev/null || echo 0)"
    TOTAL_TOKENS="$(jq -r '.total_tokens // 0' "$COST_INFO" 2>/dev/null || echo 0)"
    ESTIMATED_COST_DETAILS_STR="$(printf "%s\n" "${ESTIMATED_COST_DETAILS[@]}")"
    export ESTIMATED_COST_TOTAL ESTIMATED_COST_DETAILS_STR TOTAL_PROMPT_TOKENS TOTAL_COMPLETION_TOKENS TOTAL_TOKENS
    # backward compat: expose details under expected name
    ESTIMATED_COST_DETAILS="${ESTIMATED_COST_DETAILS_STR}"
    export ESTIMATED_COST_DETAILS
  fi
fi

budget_positive=$(python - "$BUDGET_MAX_USD" <<'PYCODE' || echo "0"
import sys, decimal
try:
    val = decimal.Decimal(sys.argv[1])
    print("1" if val > 0 else "0")
except Exception:
    print("0")
PYCODE
)
if [ "$budget_positive" = "1" ] && [ -n "$ESTIMATED_COST_TOTAL" ]; then
  over_budget=$(python - "$ESTIMATED_COST_TOTAL" "$BUDGET_MAX_USD" <<'PYCODE' || echo "0"
import sys, decimal
try:
    total = decimal.Decimal(sys.argv[1])
    budget = decimal.Decimal(sys.argv[2])
    print("1" if total > budget else "0")
except Exception:
    print("0")
PYCODE
)
  if [ "$over_budget" = "1" ]; then
    echo "Estimated cost ${ESTIMATED_COST_TOTAL} exceeds budget ${BUDGET_MAX_USD}; skipping review posting."
    cat > "$BUDGET_SKIP" <<EOF
Skipping review: estimated cost \$${ESTIMATED_COST_TOTAL} exceeds budget cap \$${BUDGET_MAX_USD}.
Token usage (OpenRouter): total=${TOTAL_TOKENS} (prompt=${TOTAL_PROMPT_TOKENS}, completion=${TOTAL_COMPLETION_TOKENS})
EOF
    gh api --method POST -H "Accept: application/vnd.github+json" "/repos/${REPO}/issues/${PR_NUMBER}/comments" -F body=@"$BUDGET_SKIP"
    exit 0
  fi
fi

python - "$PROVIDER_REPORT_JL" "$PROVIDER_FINDINGS_FILE" <<'PYCODE'
import json, sys, re
report_path, out_path = sys.argv[1:]
providers = []
try:
    with open(report_path, encoding="utf-8") as f:
        for line in f:
            line = line.strip()
            if not line:
                continue
            providers.append(json.loads(line))
except Exception:
    providers = []

all_findings = []
def extract_findings(text, provider):
    try:
        for line in text.splitlines():
            s = line.strip()
            if not s.startswith("{") or '"findings"' not in s:
                continue
            data = json.loads(s)
            for f in data.get("findings") or []:
                f["provider"] = provider
                yield f
    except Exception:
        return

for p in providers:
    path = p.get("output_path")
    name = p.get("name")
    if not path or not name:
        continue
    try:
        with open(path, encoding="utf-8") as f:
            text = f.read()
        for f in extract_findings(text, name):
            all_findings.append(f)
    except Exception:
        continue

with open(out_path, "w", encoding="utf-8") as f:
    json.dump(all_findings, f)
print(f"Extracted {len(all_findings)} findings from providers to {out_path}")
PYCODE

echo "Synthesizing results with ${SYNTHESIS_MODEL}"
cat > "$SYN_PROMPT" <<'SYN_HEAD'
You are an expert code reviewer. Combine the provider reviews below into a single, concise GitHub PR review.

Requirements:
- Merge overlapping feedback; avoid duplicate points.
- Highlight unique insights from each provider.
- Include file and line references when present.
- Provide code suggestions in fenced blocks where applicable.
- Keep output under GitHub's comment limits.
- Summarize per-provider estimates of AI-generated code likelihood (0-100%) and provide an overall estimate.

Output structure:
1) Summary (bullet list)
2) Findings (grouped by severity: Critical, Major, Minor)
3) Recommendations / tests to run
4) Verdict (Approve, Approve with recommendations, or Request changes)

Provider reviews:
SYN_HEAD

for provider in "${PROVIDER_LIST[@]}"; do
  fname="${REVIEWS_DIR}/$(echo "$provider" | tr '/:' '__').txt"
  {
    echo ""
    echo "### ${provider}"
    echo ""
    cat "$fname"
    echo ""
    echo "---"
  } >> "$SYN_PROMPT"
done

synthesis_log="$SYNTHESIS_LOG"
SYNTHESIS_SUCCESS="false"
synth_start=$(date +%s)

run_synthesis_model() {
  local model="$1"
  local prompt_file="$2"
  local out_file="$3"
  local log_file="$4"
  if [[ "$model" == openrouter/* ]]; then
    if run_openrouter "$model" "$(cat "$prompt_file")" "$out_file" > "$log_file" 2>&1; then
      return 0
    fi
  else
    if run_with_timeout opencode run -m "$model" -- "$(cat "$prompt_file")" > "$out_file" 2> "$log_file"; then
      return 0
    fi
  fi
  return 1
}

fallback_synth_models=()
# prefer configured synthesis model first, then other successful providers, then defaults
fallback_synth_models+=("$SYNTHESIS_MODEL")
for p in "${PROVIDER_LIST[@]}"; do
  [[ "$p" == "$SYNTHESIS_MODEL" ]] && continue
  fallback_synth_models+=("$p")
done
fallback_synth_models+=("openrouter/mistralai/devstral-2512:free" "openrouter/xiaomi/mimo-v2-flash:free" "opencode/grok-code")
# dedupe
deduped=()
for m in "${fallback_synth_models[@]}"; do
  skip="false"
  for d in "${deduped[@]}"; do
    if [ "$d" = "$m" ]; then
      skip="true"
      break
    fi
  done
  [ "$skip" = "true" ] && continue
  deduped+=("$m")
done
fallback_synth_models=("${deduped[@]}")

for synth_model in "${fallback_synth_models[@]}"; do
  if run_synthesis_model "$synth_model" "$SYN_PROMPT" "$SYNTHESIS_OUTPUT" "$synthesis_log"; then
    echo "✅ Synthesis complete using ${synth_model}"
    SYNTHESIS_SUCCESS="true"
    SYNTHESIS_MODEL="$synth_model"
    break
  else
    status=$?
    if [ "$status" -eq 124 ]; then
      echo "⚠️ Synthesis timed out with ${synth_model}; trying next fallback"
    else
      echo "⚠️ Synthesis failed with ${synth_model}; trying next fallback"
    fi
  fi
done

synth_end=$(date +%s)
synth_duration=$((synth_end - synth_start))

if [ "$SYNTHESIS_SUCCESS" != "true" ]; then
  python - "$PROVIDER_REPORT_JL" "$REVIEWS_DIR" "$SYNTHESIS_OUTPUT" <<'PYCODE'
import json, sys, os
prov_path, reviews_dir, out_path = sys.argv[1:]
providers = []
try:
    with open(prov_path, encoding="utf-8") as f:
        for line in f:
            line = line.strip()
            if not line:
                continue
            providers.append(json.loads(line))
except Exception:
    providers = []

lines = ["Review synthesis failed; showing provider outputs instead.", ""]
if providers:
    lines.append("Provider status:")
    for p in providers:
        name = p.get("name") or "unknown"
        status = p.get("status") or "unknown"
        dur = p.get("duration_seconds")
        dur_txt = f"{dur:.1f}s" if isinstance(dur, (int, float)) else "n/a"
        lines.append(f"- {name}: {status} ({dur_txt})")
    lines.append("")
    for p in providers:
        name = p.get("name") or "provider"
        path = p.get("output_path")
        if not path or not os.path.exists(path):
            continue
        lines.append(f"### {name}")
        try:
            text = open(path, encoding="utf-8").read()
        except Exception:
            text = ""
        if text:
            lines.append("")
            lines.append(text)
            lines.append("")
else:
    lines.append("No provider reports available.")

with open(out_path, "w", encoding="utf-8") as f:
    f.write("\n".join(lines))
PYCODE
fi

PROVIDER_STATUS_SUMMARY="$(python - "$PROVIDER_REPORT_JL" "$COST_INFO" <<'PYCODE'
import json, sys
prov_path, cost_path = sys.argv[1:]
providers = []
try:
    with open(prov_path, encoding="utf-8") as f:
        for line in f:
            line = line.strip()
            if not line:
                continue
            providers.append(json.loads(line))
except Exception:
    providers = []
cost_map = {}
try:
    data = json.load(open(cost_path, encoding="utf-8"))
    for entry in data.get("details", []):
        if isinstance(entry, str) and ":" in entry:
            name, val = entry.split(":", 1)
            cost_map[name.strip()] = val.strip()
except Exception:
    cost_map = {}

lines = []
for p in providers:
    name = p.get("name") or "provider"
    status = p.get("status") or "unknown"
    dur = p.get("duration_seconds")
    dur_txt = f"{dur:.1f}s" if isinstance(dur, (int, float)) else "n/a"
    usage = p.get("usage") or {}
    pt = usage.get("prompt_tokens") or 0
    ct = usage.get("completion_tokens") or 0
    tt = usage.get("total_tokens") or (pt + ct)
    cost = cost_map.get(name, "")
    cost_txt = f", cost {cost}" if cost else ""
    lines.append(f"- {name}: {status} ({dur_txt}); tokens p={pt}, c={ct}, t={tt}{cost_txt}")
print("\n".join(lines))
PYCODE
)"

{
  echo "**Multi-Provider Code Review**"
  echo ""
  echo "**Review**"
  echo ""
  cat "$SYNTHESIS_OUTPUT"
  echo ""
  echo "<details><summary>Run details (usage, cost, providers, status)</summary>"
  echo ""
  echo "- Token usage: total=${TOTAL_TOKENS} (prompt=${TOTAL_PROMPT_TOKENS}, completion=${TOTAL_COMPLETION_TOKENS})"
  if [ -n "${ESTIMATED_COST_TOTAL}" ]; then
    echo "- Estimated cost: ${ESTIMATED_COST_TOTAL}"
  fi
  if [ "${#ESTIMATED_COST_DETAILS[@]}" -gt 0 ]; then
    for c in "${ESTIMATED_COST_DETAILS[@]}"; do
      echo "  - ${c}"
    done
  fi
  echo "- Providers: ${PROVIDER_LIST[*]}"
  echo "- Synthesis model: ${SYNTHESIS_MODEL}"
  echo "- AI-generated code likelihood: see Review section"
  echo ""
  echo "Provider status, usage, cost:"
  if [ -n "$PROVIDER_STATUS_SUMMARY" ]; then
    printf "%s\n" "$PROVIDER_STATUS_SUMMARY"
  else
    echo "- not available"
  fi
  echo ""
  echo "</details>"
  echo "<details><summary>Raw provider outputs</summary>"
  echo ""
  for provider in "${PROVIDER_LIST[@]}"; do
    fname="${REVIEWS_DIR}/$(echo "$provider" | tr '/:' '__').txt"
    echo ""
    echo "#### ${provider}"
    echo ""
    cat "$fname"
  done
  echo ""
  echo "</details>"
} > "$COMMENT_FILE"

# Post summary comment
post_comment_with_retry() {
  local body_file="$1"
  local max_attempts=3
  local attempt=1
  while [ $attempt -le $max_attempts ]; do
    if gh api --method POST -H "Accept: application/vnd.github+json" "/repos/${REPO}/issues/${PR_NUMBER}/comments" -F "body=@${body_file}"; then
      return 0
    fi
    sleep $((2 ** attempt))
    attempt=$((attempt + 1))
  done
  return 1
}

comment_size_limit=60000
COMMENT_CHUNKS_POSTED=0
if [ "$(wc -c < "$COMMENT_FILE")" -gt "$comment_size_limit" ]; then
  echo "Summary comment exceeds ${comment_size_limit} bytes; chunking output."
  chunk_count=$(python - "$COMMENT_FILE" "$comment_size_limit" "$COMMENT_CHUNK_PREFIX" <<'PYCODE'
import sys, os
path, limit, prefix = sys.argv[1], int(sys.argv[2]), sys.argv[3]
text = open(path, encoding="utf-8").read()
chunks = []
current = []
current_bytes = 0
for line in text.splitlines(keepends=True):
    b = line.encode("utf-8")
    if current_bytes + len(b) > limit and current:
        chunks.append("".join(current))
        current = []
        current_bytes = 0
    current.append(line)
    current_bytes += len(b)
if current:
    chunks.append("".join(current))

for idx, chunk in enumerate(chunks, 1):
    out_path = f"{prefix}-{idx}.md"
    with open(out_path, "w", encoding="utf-8") as f:
        f.write(f"(Part {idx}/{len(chunks)})\n\n")
        f.write(chunk)
print(len(chunks))
PYCODE
)
  for file in "${COMMENT_CHUNK_PREFIX}"-*.md; do
    [ -f "$file" ] || continue
    if post_comment_with_retry "$file"; then
      COMMENT_CHUNKS_POSTED=$((COMMENT_CHUNKS_POSTED + 1))
    fi
  done
else
  if post_comment_with_retry "$COMMENT_FILE"; then
    COMMENT_CHUNKS_POSTED=1
  fi
fi

# Attempt inline review comments from structured JSON with consensus and suggestions
REVIEW_BODY="$(cat "$SYNTHESIS_OUTPUT")"
STRUCT_LINE="$(
printf "%s\n" "$REVIEW_BODY" | python - <<'PYCODE'
import sys, json
lines = sys.stdin.read().splitlines()
for line in lines:
    s = line.strip()
    if s.startswith('{') and '"findings"' in s:
        print(s)
        sys.exit(0)
sys.exit(1)
PYCODE
)" || true

INLINE_POSTED="false"
INLINE_PAYLOAD=$(python - "$PROVIDER_FINDINGS_FILE" "$STRUCT_LINE" "$INLINE_MAX_COMMENTS" "$INLINE_MIN_SEVERITY" "$INLINE_MIN_AGREEMENT" "$SYNTHESIS_MODEL" "$PR_FILES" "${PROVIDER_LIST[*]}" <<'PYCODE'
import json, sys
prov_path, struct_line, max_comments, min_sev, min_agree, synth_model, files_path, providers = sys.argv[1:]
providers_list = providers.split()
severity_order = {"critical": 3, "major": 2, "minor": 1}
min_rank = severity_order.get(min_sev.lower(), 1)
try:
    min_agree = max(1, int(min_agree))
except Exception:
    min_agree = 1
max_comments = int(max_comments)

changed_files = set()
try:
    files = json.load(open(files_path, encoding="utf-8"))
    for f in files:
        name = f.get("filename")
        if name:
            changed_files.add(name)
except Exception:
    pass

def load_provider_findings():
    try:
        with open(prov_path, encoding="utf-8") as f:
            return json.load(f)
    except Exception:
        return []

def load_struct_findings():
    if not struct_line:
        return []
    try:
        data = json.loads(struct_line)
        return data.get("findings") or []
    except Exception:
        return []

def key_for(f):
    file = (f.get("file") or "").strip()
    try:
        line = int(f.get("line", 0))
    except Exception:
        line = 0
    msg = (f.get("title") or f.get("message") or "").strip()
    return file, line, msg.lower()

provider_findings = load_provider_findings()
struct_findings = load_struct_findings()
if struct_findings:
    for f in struct_findings:
        f["provider"] = f.get("provider") or "synthesis"

all_findings = provider_findings + struct_findings
by_key = {}
for f in all_findings:
    file, line, msg = key_for(f)
    if not file or line <= 0 or not msg:
        continue
    if changed_files and file not in changed_files:
        continue
    severity = (f.get("severity") or "").lower()
    if severity_order.get(severity, 0) < min_rank:
        continue
    suggestion = f.get("suggestion") or ""
    if not suggestion.strip():
        suggestion = "No specific suggestion provided; please adjust accordingly."
    key = (file, line, msg)
    entry = by_key.setdefault(key, {"providers": set(), "finding": f, "max_sev": severity})
    if severity_order.get(severity, 0) > severity_order.get(entry["max_sev"], 0):
        entry["max_sev"] = severity
        entry["finding"] = f
    if f.get("provider"):
        entry["providers"].add(f["provider"])

comments = []
for (file, line, msg), entry in by_key.items():
    if len(entry["providers"]) < min_agree:
        continue
    f = entry["finding"]
    severity = entry["max_sev"] or f.get("severity") or "issue"
    body_lines = [f"**{severity}**: {f.get('title') or f.get('message') or msg}"]
    detail = f.get("message") or ""
    if detail and detail != msg:
        body_lines.append(detail)
    suggestion = f.get("suggestion") or ""
    body_lines.append("```suggestion")
    body_lines.append(suggestion)
    body_lines.append("```")
    comments.append({
        "path": file,
        "line": line,
        "side": "RIGHT",
        "body": "\n".join(body_lines)
    })
comments = comments[:max_comments]

if not comments:
    sys.exit(0)

payload = {
    "event": "COMMENT",
    "body": f"Inline suggestions (consensus >= {min_agree}) from {synth_model} synthesis; providers: {providers_list}",
    "comments": comments
}
print(json.dumps(payload))
PYCODE
) || true

if [ -n "$INLINE_PAYLOAD" ]; then
  echo "Posting inline review comments from structured findings"
  for attempt in 1 2 3; do
    if printf "%s" "$INLINE_PAYLOAD" | gh api --method POST -H "Accept: application/vnd.github+json" "/repos/${REPO}/pulls/${PR_NUMBER}/reviews" --input -; then
      INLINE_POSTED="true"
      break
    fi
    sleep $((2 ** attempt))
  done
  if [ "$INLINE_POSTED" != "true" ]; then
    echo "⚠️ Inline comments failed after retries; proceeding without inline posts." >&2
  fi
fi

REPORT_JSON="${REPORT_DIR}/${REPORT_BASENAME}.json"
REPORT_SARIF="${REPORT_DIR}/${REPORT_BASENAME}.sarif"

python - "$PROVIDER_REPORT_JL" "$STRUCT_LINE" "$SYNTHESIS_MODEL" "$COMMENT_FILE" "$INLINE_POSTED" "$REPORT_JSON" "$SYNTHESIS_OUTPUT" "$CONFIG_SOURCE" "$PROMPT_SIZE" "$DIFF_TRUNCATED" "$synth_duration" "$COMMENT_CHUNKS_POSTED" "$INLINE_MIN_AGREEMENT" "$INLINE_MAX_COMMENTS" "$INLINE_MIN_SEVERITY" "$PROVIDER_FINDINGS_FILE" <<'PYCODE'
import json, sys, time, os
prov_path, struct_line, synth_model, comment_path, inline_posted, out_path, synth_output_path, config_source, prompt_size, diff_truncated, synth_duration, chunk_count, min_agree, max_comments, min_sev, prov_findings_path = sys.argv[1:]
providers = []
try:
    with open(prov_path, encoding="utf-8") as f:
        for line in f:
            line = line.strip()
            if not line:
                continue
            providers.append(json.loads(line))
except Exception:
    providers = []

findings = []
if struct_line:
    try:
        findings = json.loads(struct_line).get("findings") or []
    except Exception:
        findings = []

try:
    prov_findings_count = len(json.load(open(prov_findings_path, encoding="utf-8")))
except Exception:
    prov_findings_count = 0

report = {
    "generated_at": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
    "synthesis_model": synth_model,
    "providers": providers,
    "findings": findings,
    "inline_comments_posted": inline_posted.lower() == "true",
    "summary_comment_path": comment_path,
    "synthesis_output_path": synth_output_path,
    "config_source": config_source,
    "prompt_size_bytes": int(prompt_size),
    "diff_truncated": diff_truncated.lower() == "true",
    "synthesis_duration_seconds": int(synth_duration),
    "summary_comment_chunks": int(chunk_count),
    "inline_min_agreement": int(min_agree),
    "inline_min_severity": min_sev,
    "inline_max_comments": int(max_comments),
    "provider_structured_findings": prov_findings_count,
    "totals": {
        "additions": int(os.getenv("TOTAL_ADDITIONS", 0)),
        "deletions": int(os.getenv("TOTAL_DELETIONS", 0)),
        "changed_files": int(os.getenv("CHANGED_FILES", 0)),
    },
    "only_binary": os.getenv("ONLY_BINARY", "false").lower() == "true",
    "test_hint_added": os.getenv("TEST_HINT_FLAG", "false").lower() == "true",
    "cost": {
        "estimated_total": os.getenv("ESTIMATED_COST_TOTAL") or None,
        "details": os.getenv("ESTIMATED_COST_DETAILS", "").splitlines() if os.getenv("ESTIMATED_COST_DETAILS") else [],
    },
    "usage_tokens": {
        "prompt": int(os.getenv("TOTAL_PROMPT_TOKENS", 0)),
        "completion": int(os.getenv("TOTAL_COMPLETION_TOKENS", 0)),
        "total": int(os.getenv("TOTAL_TOKENS", 0)),
    },
}
os.makedirs(os.path.dirname(out_path), exist_ok=True)
with open(out_path, "w", encoding="utf-8") as f:
    json.dump(report, f, indent=2)
print(f"Wrote JSON report to {out_path}")
PYCODE

python - "$REPORT_JSON" "$REPORT_SARIF" <<'PYCODE'
import json, sys, os, time
json_path, sarif_path = sys.argv[1:]
try:
    data = json.load(open(json_path, encoding="utf-8"))
    findings = data.get("findings") or []
except Exception:
    findings = []

def sev_to_level(sev: str) -> str:
    sev = (sev or "").lower()
    if sev == "critical":
        return "error"
    if sev == "major":
        return "warning"
    return "note"

results = []
for f in findings:
    file = f.get("file")
    line = f.get("line")
    msg = f.get("message") or f.get("title") or "Finding"
    if not file or not isinstance(line, int) or line <= 0:
        continue
    results.append({
        "ruleId": f.get("title") or "code-review",
        "level": sev_to_level(f.get("severity")),
        "message": {"text": msg},
        "locations": [{
            "physicalLocation": {
                "artifactLocation": {"uri": file},
                "region": {"startLine": line}
            }
        }]
    })

sarif = {
    "version": "2.1.0",
    "runs": [{
        "tool": {"driver": {"name": "multi-provider-review", "rules": []}},
        "results": results
    }]
}
os.makedirs(os.path.dirname(sarif_path), exist_ok=True)
with open(sarif_path, "w", encoding="utf-8") as f:
    json.dump(sarif, f, indent=2)
print(f"Wrote SARIF report to {sarif_path} with {len(results)} result(s)")
PYCODE

echo ""
echo "✅ Review posted to PR #${PR_NUMBER}"
python - "$PR_META" "$PR_FILES" "$MISSING_TEST_FILES" <<'PYCODE' 2>/dev/null || true
import json, sys, os, re
meta_path, files_path, out_path = sys.argv[1:]
try:
    files = json.load(open(files_path, encoding="utf-8"))
except Exception:
    sys.exit(0)

test_patterns = re.compile(r"(test|spec|__tests__|__snapshots__|\\.test\\.|\\.spec\\.|Tests/|Spec/)", re.IGNORECASE)
missing = []
for f in files:
    name = f.get("filename") or ""
    if not name:
        continue
    if test_patterns.search(name):
        continue
    # guess a sibling test path
    base = os.path.basename(name)
    root, ext = os.path.splitext(base)
    candidates = [
        name.replace(base, f"{root}.test{ext}"),
        name.replace(base, f"{root}.spec{ext}"),
    ]
    has_match = False
    for cand in candidates:
        if os.path.exists(cand):
            has_match = True
            break
    if not has_match:
        missing.append(name)

missing = missing[:5]
if missing:
    with open(out_path, "w", encoding="utf-8") as f:
        f.write("\n".join(missing))
PYCODE
