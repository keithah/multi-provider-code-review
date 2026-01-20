#!/usr/bin/env python
"""
Lightweight smoke checks for config parsing and defaults.
Ensures PyYAML is importable and that a sample config produces expected fields.
"""
import json
from pathlib import Path

import yaml  # type: ignore

fixture = Path(__file__).parent / "fixtures" / "config.yml"
data = yaml.safe_load(fixture.read_text(encoding="utf-8"))

# Basic shape checks
assert isinstance(data, dict), "Config fixture should parse to a mapping"
assert data.get("providers"), "providers should not be empty"
assert data.get("synthesis_model"), "synthesis_model required"

# Expected values
assert "openrouter/" in data["providers"][0]
merged = {
    "INLINE_MAX_COMMENTS": data.get("inline_max_comments", 5),
    "INLINE_MIN_SEVERITY": data.get("inline_min_severity", "major"),
}
print(json.dumps(merged))
