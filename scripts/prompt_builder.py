#!/usr/bin/env python3
"""
Build the provider prompt from repo metadata, PR content, diff, and hints.
"""
from __future__ import annotations

import json
import os
import sys
from typing import Any, Dict, List


def load_json(path: str) -> Any:
    try:
        with open(path, "r", encoding="utf-8") as f:
            return json.load(f)
    except Exception:
        return None


def append_changed_files(lines: List[str], pr_files_path: str) -> None:
    files = load_json(pr_files_path)
    if not isinstance(files, list) or not files:
        return
    lines.append("")
    lines.append("## Changed Files")
    for f in files:
        if not isinstance(f, dict):
            continue
        name = f.get("filename") or "unknown"
        adds = f.get("additions", 0)
        dels = f.get("deletions", 0)
        lines.append(f"- {name} (+{adds}/-{dels})")


def append_diff(lines: List[str], diff_path: str) -> None:
    if not diff_path or not os.path.isfile(diff_path):
        return
    lines.append("")
    lines.append("## Diff")
    try:
        with open(diff_path, "r", encoding="utf-8") as f:
            lines.append(f.read())
    except Exception:
        return


def append_missing_tests(lines: List[str], missing_tests_path: str) -> None:
    if not missing_tests_path or not os.path.isfile(missing_tests_path):
        return
    try:
        entries = [ln.strip() for ln in open(missing_tests_path, encoding="utf-8").read().splitlines() if ln.strip()]
    except Exception:
        entries = []
    if entries:
        lines.append("")
        lines.append("## Possible missing tests")
        for e in entries:
            lines.append(f"- {e}")


def append_test_hint(lines: List[str], test_hint: str) -> None:
    if test_hint:
        lines.append(test_hint)


def main() -> None:
    if len(sys.argv) < 9:
        raise SystemExit(0)
    (
        out_path,
        repo,
        pr_number,
        pr_title,
        pr_body,
        agents_section,
        pr_files_path,
        diff_path,
        test_hint,
        missing_tests_path,
    ) = sys.argv[1:11]

    lines: List[str] = []
    lines.append(f"REPO: {repo}")
    lines.append(f"PR NUMBER: {pr_number}")
    lines.append(f"PR TITLE: {pr_title}")
    lines.append("PR DESCRIPTION:")
    lines.append(pr_body)
    lines.append("")
    lines.append("Please review this pull request and provide a comprehensive code review focusing on:")
    lines.append("")
    lines.extend(
        [
            "## Code Quality & Best Practices",
            "- Clean code principles and readability",
            "- Proper error handling and edge cases",
            "- TypeScript/JavaScript best practices",
            "- Consistent naming conventions",
            "",
            "## Bug Detection",
            "- Logic errors and edge cases",
            "- Unhandled error scenarios",
            "- Race conditions and concurrency issues",
            "- Input validation and sanitization",
            "",
            "## Performance",
            "- Inefficient algorithms or operations",
            "- Memory leaks and unnecessary allocations",
            "- Large file handling",
            "",
            "## Security",
            "- SQL injection, XSS, CSRF vulnerabilities",
            "- Authentication/authorization issues",
            "- Sensitive data exposure",
            "",
            "## Testing",
            "- Test coverage gaps",
            "- Missing edge case handling",
        ]
    )

    if agents_section:
        lines.append(agents_section)

    lines.extend(
        [
            "",
            "## AI-Generated Code Likelihood",
            "- Estimate the likelihood (0-100%) that the changed code was AI-generated. Give a brief rationale.",
            "",
            "## Output Format",
            "- Provide specific file and line numbers when possible",
            "- Include code suggestions in fenced code blocks using the GitHub suggestion format when appropriate:",
            "  ```suggestion",
            "  // code change",
            "  ```",
            "- Return a structured JSON block at the end, on its own line, containing findings. Use this shape exactly:",
            '  ```json',
            '  {',
            '    "findings": [',
            '      {',
            '        "file": "path/to/file.ext",',
            '        "line": 123,',
            '        "severity": "critical|major|minor",',
            '        "title": "short title",',
            '        "message": "concise description",',
            '        "suggestion": "optional code snippet or empty string"',
            '      }',
            '    ]',
            '  }',
            '  ```',
            "- Summarize key findings and risks at the end",
            "",
            "IMPORTANT: Only flag actual issues. If everything looks good, respond with 'lgtm'.",
        ]
    )

    append_changed_files(lines, pr_files_path)
    append_diff(lines, diff_path)
    append_test_hint(lines, test_hint)
    append_missing_tests(lines, missing_tests_path)

    with open(out_path, "w", encoding="utf-8") as f:
        f.write("\n".join(lines))


if __name__ == "__main__":
    main()
