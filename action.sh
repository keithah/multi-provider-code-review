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

export GH_TOKEN="${GITHUB_TOKEN}"

REPO="${GITHUB_REPOSITORY:-}"
if [ -z "$REPO" ]; then
  echo "GITHUB_REPOSITORY is not set; unable to determine repository."
  exit 1
fi

CONFIG_FILE=".github/multi-review.yml"
CONFIG_SOURCE="defaults"
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
            subprocess.run([sys.executable, "-m", "pip", "install", "pyyaml", "--quiet"], check=True, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
            import yaml  # type: ignore
        except Exception:
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
IFS=',' read -ra RAW_PROVIDERS <<< "$REVIEW_PROVIDERS"
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

# Estimate costs (simple: free if name contains :free, unknown otherwise)
ESTIMATED_COST_DETAILS=()
export ESTIMATED_COST_TOTAL ESTIMATED_COST_DETAILS
TOTAL_PROMPT_TOKENS=0
TOTAL_COMPLETION_TOKENS=0
TOTAL_TOKENS=0

if [[ "$SYNTHESIS_MODEL" == openrouter/* ]] && [ -z "$OPENROUTER_API_KEY" ]; then
  echo "OpenRouter synthesis model requested but OPENROUTER_API_KEY is not set; falling back to opencode/big-pickle."
  SYNTHESIS_MODEL="opencode/big-pickle"
fi

# Limit providers if requested (deterministic rotation based on PR number)
if [ "$PROVIDER_LIMIT" -gt 0 ] && [ "${#PROVIDERS[@]}" -gt "$PROVIDER_LIMIT" ]; then
  pr_hash=${PR_NUMBER//[^0-9]/}
  [ -z "$pr_hash" ] && pr_hash=0
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
REPORT_BASENAME="${REPORT_BASENAME:-multi-provider-review}"
REPORT_DIR="${GITHUB_WORKSPACE:-$PWD}/multi-provider-report"
mkdir -p "$REPORT_DIR"

DEFAULT_OPENROUTER_PROVIDERS=("openrouter/google/gemini-2.0-flash-exp:free" "openrouter/mistralai/devstral-2512:free" "openrouter/xiaomi/mimo-v2-flash:free")
FALLBACK_OPENCODE_PROVIDERS=("opencode/big-pickle" "opencode/grok-code" "opencode/minimax-m2.1-free" "opencode/glm-4.7-free")

PROVIDER_ALLOWLIST=()
PROVIDER_BLOCKLIST=()
SKIP_LABELS=()

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
  payload_file=$(mktemp) || return 1
  response_file=$(mktemp) || return 1

  python - "$prompt" "$model" "$payload_file" >/dev/null <<'PYCODE'
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
  if [ $? -ne 0 ]; then
    return 1
  fi

  if run_with_timeout curl -sS -X POST "https://openrouter.ai/api/v1/chat/completions" \
    -H "Content-Type: application/json" \
    -H "Authorization: Bearer ${OPENROUTER_API_KEY}" \
    -H "HTTP-Referer: https://github.com/keithah/multi-provider-code-review" \
    -H "X-Title: Multi-Provider Code Review" \
    -d @"${payload_file}" > "${response_file}"; then
    :
  else
    status=$?
    echo "curl failed for OpenRouter provider ${provider}" >&2
    cat "${response_file}" >&2 || true
    return "$status"
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

gh api "/repos/${REPO}/pulls/${PR_NUMBER}/files" > /tmp/pr-files.json || true
DIFF_FILE="/tmp/pr.diff"
DIFF_TRUNCATED="false"
PR_META="/tmp/pr-meta.json"
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
    python - "$PR_META" <<'PYCODE' >/tmp/pr-meta-fields 2>/dev/null || true
import json, sys
data = json.load(open(sys.argv[1]))
adds = data.get("additions", 0)
dels = data.get("deletions", 0)
files = data.get("changed_files", 0)
labels = [l.get("name","") for l in data.get("labels", []) if l.get("name")]
print(f"{adds} {dels} {files} {','.join(labels)}")
PYCODE
    read -r TOTAL_ADDITIONS TOTAL_DELETIONS CHANGED_FILES LABELS_CSV < /tmp/pr-meta-fields || true
  fi
fi

PRICING_CACHE="/tmp/openrouter-models.json"
if [ -n "$OPENROUTER_API_KEY" ]; then
  curl -sS -H "Authorization: Bearer ${OPENROUTER_API_KEY}" https://openrouter.ai/api/v1/models > "$PRICING_CACHE" || true
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

cat > /tmp/review-prompt.txt <<EOF
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

if [ -s /tmp/pr-files.json ]; then
  echo $'\n\n## Changed Files' >> /tmp/review-prompt.txt
  if command -v jq >/dev/null 2>&1; then
    jq -r '.[] | "- " + .filename + " (+" + (.additions|tostring) + "/-" + (.deletions|tostring) + ")"' /tmp/pr-files.json >> /tmp/review-prompt.txt
  else
    python - <<'PYCODE' /tmp/pr-files.json >> /tmp/review-prompt.txt || true
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
if [ -s /tmp/pr-files.json ]; then
  if command -v jq >/dev/null 2>&1; then
    PATCH_COUNT=$(jq '[.[] | has("patch")] | map(select(.==true)) | length' /tmp/pr-files.json)
    FILE_COUNT=$(jq 'length' /tmp/pr-files.json)
    if [ "$FILE_COUNT" -gt 0 ] && [ "$PATCH_COUNT" -eq 0 ]; then
      ONLY_BINARY="true"
    fi
    TEST_COUNT=$(jq '[.[] | select(.filename|test("test|spec|__tests__|__snapshots__|\\.test\\.|\\.spec\\.|Tests/|Spec/"))] | length' /tmp/pr-files.json)
    SOURCE_COUNT=$(jq 'length' /tmp/pr-files.json)
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
  echo "$SKIP_REASON" > /tmp/skip-comment.md
  gh api --method POST -H "Accept: application/vnd.github+json" "/repos/${REPO}/issues/${PR_NUMBER}/comments" -F body="@/tmp/skip-comment.md"
  exit 0
fi

export TOTAL_ADDITIONS TOTAL_DELETIONS CHANGED_FILES ONLY_BINARY TEST_HINT_FLAG

if [ -n "${DIFF_FILE}" ] && [ -f "${DIFF_FILE}" ]; then
  echo $'\n\n## Diff' >> /tmp/review-prompt.txt
  cat "${DIFF_FILE}" >> /tmp/review-prompt.txt
fi

if [ -n "$TEST_HINT" ]; then
  echo "$TEST_HINT" >> /tmp/review-prompt.txt
fi
if [ -s "$MISSING_TEST_FILES" ]; then
  echo $'\n\n## Possible missing tests' >> /tmp/review-prompt.txt
  while IFS= read -r line; do
    echo "- $line" >> /tmp/review-prompt.txt
  done < "$MISSING_TEST_FILES"
fi

PROMPT_CONTENT="$(cat /tmp/review-prompt.txt)"
PROMPT_SIZE="$(wc -c < /tmp/review-prompt.txt)"

echo "========================================"
echo "Running multi-provider code review"
echo "========================================"
echo "Review prompt size: $(wc -c < /tmp/review-prompt.txt) bytes"
echo "Providers: ${PROVIDERS[*]}"
echo "Synthesis model: ${SYNTHESIS_MODEL}"
echo ""

mkdir -p /tmp/reviews
PROVIDER_REPORT_JL=/tmp/provider-report.jsonl
: > "$PROVIDER_REPORT_JL"
PROVIDER_LIST=()
for raw_provider in "${PROVIDERS[@]}"; do
  provider="$(echo "$raw_provider" | xargs)"
  [ -z "$provider" ] && continue
  PROVIDER_LIST+=("$provider")
  outfile="/tmp/reviews/$(echo "$provider" | tr '/:' '__').txt"
  log_file="${outfile}.log"
  usage_file="${outfile}.usage.json"
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
      if [ -f "$usage_file" ]; then
        pt=$(jq -r '.prompt_tokens // 0' "$usage_file" 2>/dev/null || echo 0)
        ct=$(jq -r '.completion_tokens // 0' "$usage_file" 2>/dev/null || echo 0)
        tt=$(jq -r '.total_tokens // 0' "$usage_file" 2>/dev/null || echo 0)
        TOTAL_PROMPT_TOKENS=$((TOTAL_PROMPT_TOKENS + pt))
        TOTAL_COMPLETION_TOKENS=$((TOTAL_COMPLETION_TOKENS + ct))
        TOTAL_TOKENS=$((TOTAL_TOKENS + tt))
      fi
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
    # capture log in output
    if [[ "$provider" == openrouter/* ]]; then
      echo "⚠️ ${provider} failed after ${PROVIDER_RETRIES} attempt(s) (see log), capturing partial output"
    else
      echo "⚠️ ${provider} failed after ${PROVIDER_RETRIES} attempt(s) (see log), capturing partial output"
    fi
    echo "Provider ${provider} failed. Log:" > "$outfile"
    cat "${log_file}" >> "$outfile" || true
  fi
  provider_end=$(date +%s)
  duration=$((provider_end - provider_start))
  python - "$provider" "$status_label" "$duration" "$outfile" "$log_file" >> "$PROVIDER_REPORT_JL" <<'PYCODE'
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
done

if [ "${#PROVIDER_LIST[@]}" -eq 0 ]; then
  echo "No valid providers ran successfully."
  exit 1
fi

if [ -f "$PRICING_CACHE" ]; then
  COST_INFO="/tmp/cost-info.json"
  python /tmp/calc_cost.py "$PROVIDER_REPORT_JL" "$PRICING_CACHE" "$COST_INFO" || true
  if [ -f "$COST_INFO" ]; then
    ESTIMATED_COST_TOTAL="$(jq -r '.total // ""' "$COST_INFO" 2>/dev/null || echo "")"
    mapfile -t ESTIMATED_COST_DETAILS < <(jq -r '.details[]' "$COST_INFO" 2>/dev/null || true)
    TOTAL_PROMPT_TOKENS="$(jq -r '.prompt_tokens // 0' "$COST_INFO" 2>/dev/null || echo 0)"
    TOTAL_COMPLETION_TOKENS="$(jq -r '.completion_tokens // 0' "$COST_INFO" 2>/dev/null || echo 0)"
    TOTAL_TOKENS="$(jq -r '.total_tokens // 0' "$COST_INFO" 2>/dev/null || echo 0)"
  fi
fi

if [ "$BUDGET_MAX_USD" -gt 0 ] && [ -n "$ESTIMATED_COST_TOTAL" ]; then
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
    cat > /tmp/budget-skip.md <<EOF
Skipping review: estimated cost \$${ESTIMATED_COST_TOTAL} exceeds budget cap \$${BUDGET_MAX_USD}.
Token usage (OpenRouter): total=${TOTAL_TOKENS} (prompt=${TOTAL_PROMPT_TOKENS}, completion=${TOTAL_COMPLETION_TOKENS})
EOF
    gh api --method POST -H "Accept: application/vnd.github+json" "/repos/${REPO}/issues/${PR_NUMBER}/comments" -F body="@/tmp/budget-skip.md"
    exit 0
  fi
fi

PROVIDER_FINDINGS_FILE=/tmp/provider-findings.json
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

SYN_PROMPT=/tmp/synthesis-prompt.txt
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
  fname="/tmp/reviews/$(echo "$provider" | tr '/:' '__').txt"
  {
    echo ""
    echo "### ${provider}"
    echo ""
    cat "$fname"
    echo ""
    echo "---"
  } >> "$SYN_PROMPT"
done

SYNTHESIS_OUTPUT=/tmp/synthesis.txt
synthesis_log=/tmp/synthesis.log
synth_start=$(date +%s)
if [[ "${SYNTHESIS_MODEL}" == openrouter/* ]]; then
  if run_openrouter "${SYNTHESIS_MODEL}" "$(cat "$SYN_PROMPT")" "$SYNTHESIS_OUTPUT" > "$synthesis_log" 2>&1; then
    echo "✅ Synthesis complete"
  else
    status=$?
    if [ "$status" -eq 124 ]; then
      echo "⚠️ Synthesis timed out after ${RUN_TIMEOUT_SECONDS}s, using concatenated provider outputs"
    else
      echo "⚠️ Synthesis failed, using concatenated provider outputs"
    fi
    cat "$SYN_PROMPT" > "$SYNTHESIS_OUTPUT"
  fi
else
  if run_with_timeout opencode run -m "${SYNTHESIS_MODEL}" -- "$(cat "$SYN_PROMPT")" > "$SYNTHESIS_OUTPUT" 2> "$synthesis_log"; then
    echo "✅ Synthesis complete"
  else
    status=$?
    if [ "$status" -eq 124 ]; then
      echo "⚠️ Synthesis timed out after ${RUN_TIMEOUT_SECONDS}s, using concatenated provider outputs"
    else
      echo "⚠️ Synthesis failed, using concatenated provider outputs"
    fi
    cat "$SYN_PROMPT" > "$SYNTHESIS_OUTPUT"
  fi
fi
synth_end=$(date +%s)
synth_duration=$((synth_end - synth_start))

COMMENT_FILE=/tmp/final-review.md
{
  echo "**Multi-Provider Code Review**"
  echo ""
  echo "**Token usage (where available):** total=${TOTAL_TOKENS} (prompt=${TOTAL_PROMPT_TOKENS}, completion=${TOTAL_COMPLETION_TOKENS})"
  if [ -n "${ESTIMATED_COST_TOTAL}" ]; then
    echo "**Estimated cost:** ${ESTIMATED_COST_TOTAL}"
  fi
  if [ "${#ESTIMATED_COST_DETAILS[@]}" -gt 0 ]; then
    echo "<details><summary>Per-provider cost notes</summary>"
    for c in "${ESTIMATED_COST_DETAILS[@]}"; do
      echo "- $c"
    done
    echo "</details>"
  fi
  echo "**Providers:** ${PROVIDER_LIST[*]}"
  echo "**Synthesis model:** ${SYNTHESIS_MODEL}"
  echo ""
  cat "$SYNTHESIS_OUTPUT"
  echo ""
    echo "<details><summary>Raw provider outputs</summary>"
  echo ""
  for provider in "${PROVIDER_LIST[@]}"; do
    fname="/tmp/reviews/$(echo "$provider" | tr '/:' '__').txt"
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
  chunk_count=$(python - "$COMMENT_FILE" "$comment_size_limit" "/tmp/comment-chunk" <<'PYCODE'
import sys, os
path, limit, prefix = sys.argv[1], int(sys.argv[2]), sys.argv[3]
text = open(path, encoding="utf-8").read()
chunks = [text[i:i+limit] for i in range(0, len(text), limit)]
for idx, chunk in enumerate(chunks, 1):
    out_path = f"{prefix}-{idx}.md"
    with open(out_path, "w", encoding="utf-8") as f:
        f.write(f"(Part {idx}/{len(chunks)})\n\n")
        f.write(chunk)
print(len(chunks))
PYCODE
)
  for file in /tmp/comment-chunk-*.md; do
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
STRUCT_LINE="$(printf "%s\n" "$REVIEW_BODY" | python - <<'PYCODE' || true
import sys, json
lines = sys.stdin.read().splitlines()
for line in lines:
    s = line.strip()
    if s.startswith('{') and '"findings"' in s:
        print(s)
        sys.exit(0)
sys.exit(1)
PYCODE
)"

INLINE_POSTED="false"
INLINE_PAYLOAD=$(python - "$PROVIDER_FINDINGS_FILE" "$STRUCT_LINE" "$INLINE_MAX_COMMENTS" "$INLINE_MIN_SEVERITY" "$INLINE_MIN_AGREEMENT" "$SYNTHESIS_MODEL" "/tmp/pr-files.json" "${PROVIDER_LIST[*]}" || true
import json, sys
prov_path, struct_line, max_comments, min_sev, min_agree, synth_model, files_path, providers = sys.argv[1:]
providers_list = providers.split()
severity_order = {"critical": 3, "major": 2, "minor": 1}
min_rank = severity_order.get(min_sev.lower(), 1)
min_agree = max(1, int(min_agree))
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
        continue  # require suggestion to post inline
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
)

if [ -n "$INLINE_PAYLOAD" ]; then
  echo "Posting inline review comments from structured findings"
  for attempt in 1 2 3; do
    if printf "%s" "$INLINE_PAYLOAD" | gh api --method POST -H "Accept: application/vnd.github+json" "/repos/${REPO}/pulls/${PR_NUMBER}/reviews" --input -; then
      INLINE_POSTED="true"
      break
    fi
    sleep $((2 ** attempt))
  done
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
        "details": os.getenv("ESTIMATED_COST_DETAILS", "").split("||") if os.getenv("ESTIMATED_COST_DETAILS") else [],
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
MISSING_TEST_FILES="/tmp/missing-tests.txt"
python - "$PR_META" /tmp/pr-files.json "$MISSING_TEST_FILES" <<'PYCODE' 2>/dev/null || true
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
        f.write("\\n".join(missing))
PYCODE
