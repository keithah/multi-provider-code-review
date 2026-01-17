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

if [ "${#PROVIDERS[@]}" -eq 0 ]; then
  echo "No review providers available after processing configuration."
  exit 1
fi

if [[ "$SYNTHESIS_MODEL" == openrouter/* ]] && [ -z "$OPENROUTER_API_KEY" ]; then
  echo "OpenRouter synthesis model requested but OPENROUTER_API_KEY is not set; falling back to opencode/big-pickle."
  SYNTHESIS_MODEL="opencode/big-pickle"
fi

SYNTHESIS_MODEL="${SYNTHESIS_MODEL:-openrouter/google/gemini-2.0-flash-exp:free}"
DIFF_MAX_BYTES="${DIFF_MAX_BYTES:-120000}"
RUN_TIMEOUT_SECONDS="${RUN_TIMEOUT_SECONDS:-600}"
OPENROUTER_API_KEY="${OPENROUTER_API_KEY:-}"
INLINE_MAX_COMMENTS="${INLINE_MAX_COMMENTS:-5}"
INLINE_MIN_SEVERITY="${INLINE_MIN_SEVERITY:-major}"
REPORT_BASENAME="${REPORT_BASENAME:-multi-provider-review}"
REPORT_DIR="${GITHUB_WORKSPACE:-$PWD}/multi-provider-report"
mkdir -p "$REPORT_DIR"

DEFAULT_OPENROUTER_PROVIDERS=("openrouter/google/gemini-2.0-flash-exp:free" "openrouter/mistralai/devstral-2512:free" "openrouter/xiaomi/mimo-v2-flash:free")
FALLBACK_OPENCODE_PROVIDERS=("opencode/big-pickle" "opencode/grok-code" "opencode/minimax-m2.1-free" "opencode/glm-4.7-free")

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

  python - "$response_file" "$outfile" >/dev/null <<'PYCODE'
import json, sys
resp_path, out_path = sys.argv[1], sys.argv[2]
data = json.load(open(resp_path, encoding="utf-8"))
choices = data.get("choices") or []
if not choices:
    raise SystemExit("No choices in response")
content = choices[0].get("message", {}).get("content", "")
with open(out_path, "w", encoding="utf-8") as f:
    f.write(content)
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
if gh api "/repos/${REPO}/pulls/${PR_NUMBER}" -H "Accept: application/vnd.github.v3.diff" > "$DIFF_FILE"; then
  DIFF_SIZE=$(wc -c < "$DIFF_FILE")
  if [ "$DIFF_SIZE" -gt "$DIFF_MAX_BYTES" ]; then
    echo "Diff is ${DIFF_SIZE} bytes, truncating to ${DIFF_MAX_BYTES}."
    head -c "$DIFF_MAX_BYTES" "$DIFF_FILE" > "${DIFF_FILE}.tmp"
    echo $'\n\n[Diff truncated for length]' >> "${DIFF_FILE}.tmp"
    mv "${DIFF_FILE}.tmp" "$DIFF_FILE"
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

if [ -n "${DIFF_FILE}" ] && [ -f "${DIFF_FILE}" ]; then
  echo $'\n\n## Diff' >> /tmp/review-prompt.txt
  cat "${DIFF_FILE}" >> /tmp/review-prompt.txt
fi

PROMPT_CONTENT="$(cat /tmp/review-prompt.txt)"

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
  echo "Running provider: ${provider}"
   provider_start=$(date +%s)
   status_label="success"
  if [[ "$provider" == openrouter/* ]]; then
    if run_openrouter "${provider}" "${PROMPT_CONTENT}" "${outfile}" > "${log_file}" 2>&1; then
      echo "✅ ${provider} completed"
    else
      status=$?
      status_label="failed"
      if [ "$status" -eq 124 ]; then
        echo "⚠️ ${provider} timed out after ${RUN_TIMEOUT_SECONDS}s"
        status_label="timeout"
      else
        echo "⚠️ ${provider} failed (see log), capturing partial output"
      fi
      echo "Provider ${provider} failed. Log:" > "$outfile"
      cat "${log_file}" >> "$outfile" || true
    fi
  else
    if run_with_timeout opencode run -m "${provider}" -- "${PROMPT_CONTENT}" > "$outfile" 2> "${log_file}"; then
      echo "✅ ${provider} completed"
    else
      status=$?
      status_label="failed"
      if [ "$status" -eq 124 ]; then
        echo "⚠️ ${provider} timed out after ${RUN_TIMEOUT_SECONDS}s"
        status_label="timeout"
      else
        echo "⚠️ ${provider} failed (see log), capturing partial output"
      fi
      echo "Provider ${provider} failed. Log:" > "$outfile"
      cat "${log_file}" >> "$outfile" || true
    fi
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
print(json.dumps({
    "name": name,
    "status": status,
    "duration_seconds": duration,
    "output_path": out_path,
    "log_path": log_path,
    "kind": "openrouter" if name.startswith("openrouter/") else "opencode"
}))
PYCODE
done

if [ "${#PROVIDER_LIST[@]}" -eq 0 ]; then
  echo "No valid providers ran successfully."
  exit 1
fi

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

COMMENT_FILE=/tmp/final-review.md
{
  echo "**Multi-Provider Code Review**"
  echo ""
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
gh api --method POST -H "Accept: application/vnd.github+json" "/repos/${REPO}/issues/${PR_NUMBER}/comments" -F body="@${COMMENT_FILE}"

# Attempt inline review comments from structured JSON in synthesis output
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
if [ -n "$STRUCT_LINE" ]; then
  INLINE_PAYLOAD=$(python - <<'PYCODE' "$STRUCT_LINE" "$INLINE_MAX_COMMENTS" "$INLINE_MIN_SEVERITY" "$SYNTHESIS_MODEL" "${PROVIDER_LIST[*]}" || true
import json, sys
struct_line, max_comments, min_severity, synth_model, providers = sys.argv[1:]
try:
    data = json.loads(struct_line)
    findings = data.get("findings") or []
except Exception:
    sys.exit(1)

severity_order = {"critical": 3, "major": 2, "minor": 1}
min_rank = severity_order.get(min_severity.lower(), 1)

comments = []
seen = set()
for f in findings:
    try:
        file = f.get("file") or ""
        line = int(f.get("line", 0))
        msg = f.get("title") or f.get("message") or ""
        detail = f.get("message") or ""
        suggestion = f.get("suggestion") or ""
        severity = (f.get("severity") or "").lower()
        if not file or line <= 0 or not msg:
            continue
        if severity_order.get(severity, 0) < min_rank:
            continue
        key = (file, line, msg.strip())
        if key in seen:
            continue
        seen.add(key)
        body_lines = [f"**{severity or 'issue'}**: {msg}"]
        if detail and detail != msg:
            body_lines.append(detail)
        if suggestion:
            body_lines.append("```suggestion")
            body_lines.append(suggestion)
            body_lines.append("```")
        comments.append({
            "path": file,
            "line": line,
            "side": "RIGHT",
            "body": "\n".join(body_lines)
        })
        if len(comments) >= int(max_comments):
            break
    except Exception:
        continue

if not comments:
    sys.exit(1)

payload = {
    "event": "COMMENT",
    "body": f"Inline findings from synthesis model {synth_model} (providers: {providers})",
    "comments": comments
}
print(json.dumps(payload))
PYCODE
  )

  if [ -n "$INLINE_PAYLOAD" ]; then
    echo "Posting inline review comments from structured findings"
    printf "%s" "$INLINE_PAYLOAD" | gh api --method POST -H "Accept: application/vnd.github+json" "/repos/${REPO}/pulls/${PR_NUMBER}/reviews" --input -
    INLINE_POSTED="true"
  fi
fi

REPORT_JSON="${REPORT_DIR}/${REPORT_BASENAME}.json"
REPORT_SARIF="${REPORT_DIR}/${REPORT_BASENAME}.sarif"

python - "$PROVIDER_REPORT_JL" "$STRUCT_LINE" "$SYNTHESIS_MODEL" "$COMMENT_FILE" "$INLINE_POSTED" "$REPORT_JSON" "$SYNTHESIS_OUTPUT" <<'PYCODE'
import json, sys, time, os
prov_path, struct_line, synth_model, comment_path, inline_posted, out_path, synth_output_path = sys.argv[1:]
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

report = {
    "generated_at": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
    "synthesis_model": synth_model,
    "providers": providers,
    "findings": findings,
    "inline_comments_posted": inline_posted.lower() == "true",
    "summary_comment_path": comment_path,
    "synthesis_output_path": synth_output_path,
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
