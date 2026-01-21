#!/usr/bin/env python3
"""
Lightweight config loader for multi-provider-code-review.

Reads YAML or JSON from the provided path and emits a JSON object of normalized
key/value pairs for the action shell to consume.
"""
from __future__ import annotations

import json
import sys
from typing import Any, Dict


def load_yaml(path: str) -> Dict[str, Any] | None:
    try:
        import yaml  # type: ignore
    except Exception:
        return None
    try:
        with open(path, "r", encoding="utf-8") as f:
            return yaml.safe_load(f)
    except Exception:
        return None


def load_json(path: str) -> Dict[str, Any] | None:
    try:
        with open(path, "r", encoding="utf-8") as f:
            return json.load(f)
    except Exception:
        return None


def main() -> None:
    if len(sys.argv) < 2:
        return
    path = sys.argv[1]
    data = load_yaml(path)
    if data is None:
        data = load_json(path)
    if not isinstance(data, dict):
        return

    exports: Dict[str, Any] = {}

    def set_if(key: str, env_key: str, cast=None) -> None:
        if key not in data or data[key] is None:
            return
        val = data[key]
        if cast:
            try:
                val = cast(val)
            except Exception:
                print(f"Warning: failed to cast {key} value '{val}' to {cast.__name__}", file=sys.stderr)
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

    for key, env_key in (
        ("provider_allowlist", "PROVIDER_ALLOWLIST"),
        ("provider_blocklist", "PROVIDER_BLOCKLIST"),
        ("skip_labels", "SKIP_LABELS"),
    ):
        if key not in data or data[key] is None:
            continue
        val = data[key]
        if isinstance(val, list):
            exports[env_key] = ",".join(str(x) for x in val)
        elif isinstance(val, str):
            exports[env_key] = val

    print(json.dumps(exports))


if __name__ == "__main__":
    main()
