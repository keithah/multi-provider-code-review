#!/usr/bin/env python3
"""
Merge defaults with config overrides and emit space-delimited values for the shell.
"""
from __future__ import annotations

import json
import sys
from typing import Any, Dict, List


FIELDS: List[str] = [
    "REVIEW_PROVIDERS",
    "SYNTHESIS_MODEL",
    "INLINE_MAX_COMMENTS",
    "INLINE_MIN_SEVERITY",
    "INLINE_MIN_AGREEMENT",
    "DIFF_MAX_BYTES",
    "RUN_TIMEOUT_SECONDS",
    "MIN_CHANGED_LINES",
    "MAX_CHANGED_FILES",
    "PROVIDER_ALLOWLIST",
    "PROVIDER_BLOCKLIST",
    "SKIP_LABELS",
]


def main() -> None:
    if len(sys.argv) < len(FIELDS) + 2:
        print("Error: insufficient arguments to config_merge", file=sys.stderr)
        sys.exit(1)
    config_raw = sys.argv[1]
    defaults = sys.argv[2:]
    try:
        config: Dict[str, Any] = json.loads(config_raw) if config_raw else {}
    except Exception:
        config = {}

    out: List[str] = []
    for idx, key in enumerate(FIELDS):
        default = defaults[idx] if idx < len(defaults) else ""
        val = config.get(key, default)
        out.append("" if val is None else str(val))

    print(" ".join(out))


if __name__ == "__main__":
    main()
