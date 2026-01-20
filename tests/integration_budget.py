#!/usr/bin/env python3
"""
Integration-style smoke test for cost/usage parsing and budget guard logic.
Uses fixture provider reports and pricing to verify totals and budget enforcement.
"""
import json
from decimal import Decimal
from pathlib import Path

ROOT = Path(__file__).parent
prov_path = ROOT / "fixtures" / "provider-report.jsonl"
pricing_path = ROOT / "fixtures" / "pricing.json"

reports = []
with prov_path.open(encoding="utf-8") as f:
    for line in f:
        line = line.strip()
        if line:
            reports.append(json.loads(line))

pricing_raw = json.loads(pricing_path.read_text(encoding="utf-8"))
models = {
    m["id"]: {
        "prompt": Decimal(str(m.get("pricing", {}).get("prompt", "0"))),
        "completion": Decimal(str(m.get("pricing", {}).get("completion", "0"))),
    }
    for m in pricing_raw.get("data", [])
}

total_prompt = total_completion = total_tokens = 0
total_cost = Decimal("0")
for r in reports:
    usage = r.get("usage") or {}
    pt = int(usage.get("prompt_tokens") or 0)
    ct = int(usage.get("completion_tokens") or 0)
    tt = int(usage.get("total_tokens") or (pt + ct))
    total_prompt += pt
    total_completion += ct
    total_tokens += tt
    if r.get("name", "").startswith("openrouter/"):
        model_id = r["name"].split("/", 1)[1]
        rate = models.get(model_id)
        if rate:
            total_cost += rate["prompt"] * pt + rate["completion"] * ct

assert total_prompt == 15000
assert total_completion == 1500
assert total_tokens == 16500
assert total_cost == Decimal("0.42"), f"unexpected cost {total_cost}"

def over_budget(est: str, budget: str) -> bool:
    return Decimal(est) > Decimal(budget)

assert over_budget("0.42", "0.10") is True
assert over_budget("0.42", "0.50") is False

print("integration_budget: OK")
