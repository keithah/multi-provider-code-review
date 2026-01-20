#!/usr/bin/env python3
"""
Tests for provider name validation and allowlist/blocklist filtering logic.
"""
import re

VALID_RE = re.compile(r"^(opencode|openrouter)/[A-Za-z0-9._-]+(:free)?$")


def validate_provider_name(name: str) -> bool:
    return bool(VALID_RE.match(name))


def filter_providers(raw, allowlist=None, blocklist=None):
    allowset = {p.strip() for p in (allowlist or []) if p.strip()}
    blockset = {p.strip() for p in (blocklist or []) if p.strip()}
    out = []
    for p in raw:
        if not validate_provider_name(p):
            continue
        if allowset and p not in allowset:
            continue
        if blockset and p in blockset:
            continue
        if p not in out:
            out.append(p)
    return out


def test_validate_provider_name():
    assert validate_provider_name("opencode/big-pickle")
    assert validate_provider_name("openrouter/mistralai/devstral-2512:free")
    assert not validate_provider_name("openrouter/../etc/passwd")
    assert not validate_provider_name("badprefix/model")
    assert not validate_provider_name("openrouter/model with space")


def test_filter_allow_block():
    raw = [
        "opencode/big-pickle",
        "openrouter/mistralai/devstral-2512:free",
        "bad/model",
    ]
    allow = ["opencode/big-pickle"]
    block = ["openrouter/mistralai/devstral-2512:free"]
    filtered = filter_providers(raw, allow, block)
    assert filtered == ["opencode/big-pickle"]


if __name__ == "__main__":
    test_validate_provider_name()
    test_filter_allow_block()
    print("provider_validation_test: OK")
