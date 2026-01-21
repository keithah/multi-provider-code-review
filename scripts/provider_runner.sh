#!/usr/bin/env bash

# Timeout wrapper to allow systems without coreutils timeout
run_with_timeout() {
  if command -v timeout >/dev/null 2>&1; then
    timeout "${RUN_TIMEOUT_SECONDS}s" "$@"
  else
    "$@"
  fi
}

run_openrouter() {
  local provider="$1"
  local prompt_file="${2:-$PROMPT_FILE}"
  local outfile="$3"
  local usagefile="${4:-}"
  local rate_rc=1

  if [ -z "$OPENROUTER_API_KEY" ]; then
    echo "OpenRouter provider ${provider} requested but OPENROUTER_API_KEY is not set."
    return 1
  fi

  # Ensure lock file exists for flock
  : > "$RATE_LOCK_FILE" 2>/dev/null || true
  if [ ! -w "$RATE_LOCK_FILE" ]; then
    echo "Rate limit lock file not writable: ${RATE_LOCK_FILE}" >&2
    return 1
  fi

  local model="${provider#openrouter/}"
  local payload_file
  local response_file
  local header_file
  payload_file=$(mktemp) || return 1
  response_file=$(mktemp) || { rm -f "$payload_file"; return 1; }
  header_file=$(mktemp) || { rm -f "$payload_file" "$response_file"; return 1; }
  chmod 600 "$header_file" || true

  if ! python - "$prompt_file" "$model" "$payload_file" >/dev/null <<'PYCODE'
import json, sys, os
prompt_path, model, path = sys.argv[1], sys.argv[2], sys.argv[3]
try:
    with open(prompt_path, "r", encoding="utf-8") as f:
        prompt = f.read()
except Exception:
    prompt = ""
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
    rm -f "$payload_file" "$response_file" "$header_file"
    return 1
  fi

  {
    printf 'header = "Content-Type: application/json"\n'
    printf 'header = "Authorization: Bearer %s"\n' "$OPENROUTER_API_KEY"
    printf 'header = "HTTP-Referer: https://github.com/keithah/multi-provider-code-review"\n'
    printf 'header = "X-Title: Multi-Provider Code Review"\n'
  } > "$header_file"

  http_status=$(run_with_timeout curl -sS -w "%{http_code}" -o "${response_file}" -X POST "https://openrouter.ai/api/v1/chat/completions" \
    -K "${header_file}" \
    --data-binary @"${payload_file}")
  curl_rc=$?
  rm -f "$payload_file" "$header_file"
  if [ $curl_rc -ne 0 ]; then
    echo "curl failed for OpenRouter provider ${provider} (rc=${curl_rc})" >&2
    rm -f "$response_file"
    return 1
  fi
  if ! [[ "$http_status" =~ ^2[0-9][0-9]$ ]]; then
    echo "OpenRouter provider ${provider} returned HTTP ${http_status}" >&2
    if [ "$http_status" = "429" ] || [ "$http_status" = "401" ]; then
      (
        flock -x 200
        echo "$provider" >> "$RATE_LIMIT_FILE"
      ) 200>"${RATE_LOCK_FILE}"
      if [ "$provider" = "openrouter/google/gemini-2.0-flash-exp:free" ]; then
        echo "Gemini free model rate limited; will avoid for synthesis." >&2
        echo "limited" > "$GEMINI_RATE_FILE"
      fi
      rm -f "$response_file"
      return 9
    fi
    if [ "${DEBUG_MODE:-false}" = "true" ]; then
      head -c 500 "${response_file}" >&2 || true
    else
      echo "API request failed for ${provider}" >&2
    fi
    rm -f "$response_file"
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
    rm -f "$response_file"
    return 1
  fi

  rm -f "$response_file"
  return 0
}

# Run providers in parallel respecting MAX_PARALLEL and populate report file.
run_providers() {
  PROVIDER_RETRIES="${PROVIDER_RETRIES:-2}"
  if [ "$PROVIDER_RETRIES" -lt 1 ]; then
    PROVIDER_RETRIES=1
  fi
  if [ -z "${PROMPT_FILE:-}" ]; then
    echo "Error: PROMPT_FILE is not set" >&2
    return 1
  fi
  local providers=("$@")
  PROVIDER_LIST=()
  SUCCESS_PROVIDERS=()
  FAILED_PROVIDERS=()
  mkdir -p "$REVIEWS_DIR"
  : > "$PROVIDER_REPORT_JL"
  local pids=()

  for raw_provider in "${providers[@]}"; do
    provider="$(echo "$raw_provider" | xargs)"
    [ -z "$provider" ] && continue
    PROVIDER_LIST+=("$provider")
    safe_provider="${provider//[^A-Za-z0-9._-]/_}"
    outfile="${REVIEWS_DIR}/${safe_provider}.txt"
    log_file="${outfile}.log"
    usage_file="${outfile}.usage.json"
    report_line="${outfile}.report"
    (
      echo "Running provider: ${provider}"
      provider_start=$(date +%s)
      status_label="failed"
      rc=1
      attempt=1
      while [ $attempt -le "$PROVIDER_RETRIES" ]; do
        if [[ "$provider" == openrouter/* ]]; then
          if run_openrouter "${provider}" "$PROMPT_FILE" "${outfile}" "${usage_file}" > "${log_file}" 2>&1; then
            status_label="success"
            rc=0
          fi
        else
          if run_with_timeout opencode run -m "${provider}" --file "$PROMPT_FILE" -- "Review the attached PR context and provide structured findings." > "$outfile" 2> "${log_file}"; then
            status_label="success"
            rc=0
          fi
        fi
        if [ "$status_label" = "success" ]; then
          echo "✅ ${provider} completed (attempt ${attempt}/${PROVIDER_RETRIES})"
          break
        else
          if [ "$rc" -eq 9 ]; then
            echo "Rate-limited or fatal response for ${provider}; not retrying." >&2
            break
          fi
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
    pids+=($!)
    if [ "${#pids[@]}" -ge "$MAX_PARALLEL" ]; then
      wait -n || true
      tmp_pids=()
      for pid in "${pids[@]}"; do
        if kill -0 "$pid" 2>/dev/null; then
          tmp_pids+=("$pid")
        fi
      done
      pids=("${tmp_pids[@]}")
    fi
  done

  if [ "${#pids[@]}" -gt 0 ]; then
    if ! wait "${pids[@]}"; then
      echo "One or more providers exited with failure status (continuing with available outputs)." >&2
    fi
  fi

  if compgen -G "${REVIEWS_DIR}"/*.report >/dev/null 2>&1; then
    cat "${REVIEWS_DIR}"/*.report > "$PROVIDER_REPORT_JL" 2>/dev/null || true
  else
    : > "$PROVIDER_REPORT_JL"
  fi
  mapfile -t SUCCESS_PROVIDERS < <(python - "$PROVIDER_REPORT_JL" <<'PYCODE' 2>/dev/null || true
import json, sys
names = []
try:
    with open(sys.argv[1], encoding="utf-8") as f:
        for line in f:
            line = line.strip()
            if not line:
                continue
            r = json.loads(line)
            if r.get("status") == "success" and r.get("name"):
                names.append(r["name"])
except Exception:
    sys.stderr.write("Failed to parse provider success reports\n")
for n in names:
    print(n)
PYCODE
)
  mapfile -t FAILED_PROVIDERS < <(python - "$PROVIDER_REPORT_JL" <<'PYCODE' 2>/dev/null || true
import json, sys
names = []
try:
    with open(sys.argv[1], encoding="utf-8") as f:
        for line in f:
            line = line.strip()
            if not line:
                continue
            r = json.loads(line)
            if r.get("status") != "success" and r.get("name"):
                names.append(r["name"])
except Exception:
    sys.stderr.write("Failed to parse provider failure reports\n")
for n in names:
    print(n)
PYCODE
)
}
