#!/usr/bin/env python3
"""
Exercise inline consensus generation similar to action.sh.
"""
import json


def build_inline_payload(provider_findings, struct_line, max_comments, min_sev, min_agree, providers, changed_files):
    severity_order = {"critical": 3, "major": 2, "minor": 1}
    min_rank = severity_order.get(min_sev.lower(), 1)
    max_comments = int(max_comments)
    min_agree = max(1, int(min_agree))

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

    struct_findings = load_struct_findings()
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
            entry["finding"]["suggestion"] = suggestion
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
        if not suggestion.strip():
            suggestion = "No specific suggestion provided; please adjust accordingly."
        body_lines.append("```suggestion")
        body_lines.append(suggestion)
        body_lines.append("```")
        comments.append(
            {
                "path": file,
                "line": line,
                "side": "RIGHT",
                "body": "\n".join(body_lines),
            }
        )
    comments = comments[:max_comments]
    return comments


def test_consensus_min_agree():
    prov_findings = [
        {"file": "a.py", "line": 10, "severity": "major", "title": "Bug A", "message": "msg", "suggestion": "fix", "provider": "p1"},
        {"file": "a.py", "line": 10, "severity": "major", "title": "Bug A", "message": "msg", "suggestion": "fix2", "provider": "p2"},
        {"file": "a.py", "line": 20, "severity": "major", "title": "Solo", "message": "msg", "suggestion": "fix3", "provider": "p3"},
    ]
    struct_line = json.dumps({"findings": []})
    comments = build_inline_payload(prov_findings, struct_line, max_comments=5, min_sev="minor", min_agree=2, providers=["p1", "p2", "p3"], changed_files={"a.py"})
    assert len(comments) == 1
    assert "Bug A" in comments[0]["body"]


def test_placeholder_suggestion():
    prov_findings = [
        {"file": "b.py", "line": 5, "severity": "major", "title": "Missing", "message": "msg", "suggestion": "", "provider": "p1"},
        {"file": "b.py", "line": 5, "severity": "major", "title": "Missing", "message": "msg", "suggestion": "", "provider": "p2"},
    ]
    struct_line = ""
    comments = build_inline_payload(prov_findings, struct_line, max_comments=5, min_sev="minor", min_agree=2, providers=["p1", "p2"], changed_files={"b.py"})
    assert len(comments) == 1
    assert "No specific suggestion provided" in comments[0]["body"]


def test_empty_inputs_no_crash():
    comments = build_inline_payload([], "", max_comments=5, min_sev="minor", min_agree=2, providers=[], changed_files=set())
    assert comments == []


def test_invalid_json_struct_line():
    prov_findings = [
        {"file": "c.py", "line": 1, "severity": "critical", "title": "T1", "message": "m", "suggestion": "s", "provider": "p1"},
        {"file": "c.py", "line": 1, "severity": "critical", "title": "T1", "message": "m", "suggestion": "s", "provider": "p2"},
    ]
    struct_line = "{invalid json"
    comments = build_inline_payload(prov_findings, struct_line, max_comments=5, min_sev="minor", min_agree=2, providers=["p1", "p2"], changed_files={"c.py"})
    assert len(comments) == 1
    assert "T1" in comments[0]["body"]


if __name__ == "__main__":
    test_consensus_min_agree()
    test_placeholder_suggestion()
    test_empty_inputs_no_crash()
    test_invalid_json_struct_line()
    print("inline_consensus_test: OK")
