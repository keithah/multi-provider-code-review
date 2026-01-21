import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT))

from scripts.prompt_builder import append_changed_files, append_missing_tests, append_diff  # noqa: E402


def test_append_changed_files():
    files = [
        {"filename": "a.txt", "additions": 2, "deletions": 1},
        {"filename": "b.txt", "additions": 0, "deletions": 0},
    ]
    path = "tmp_files.json"
    with open(path, "w", encoding="utf-8") as f:
        json.dump(files, f)
    lines = []
    append_changed_files(lines, path)
    assert any("a.txt" in ln for ln in lines)
    assert any("b.txt" in ln for ln in lines)


def test_append_missing_tests(tmp_path):
    missing = tmp_path / "missing.txt"
    missing.write_text("foo\nbar\n", encoding="utf-8")
    lines = []
    append_missing_tests(lines, str(missing))
    assert any("Possible missing tests" in ln for ln in lines)
    assert any("foo" in ln for ln in lines)


def test_append_diff(tmp_path):
    diff = tmp_path / "diff.patch"
    diff.write_text("diff --git a/b\n", encoding="utf-8")
    lines = []
    append_diff(lines, str(diff))
    assert any("## Diff" in ln for ln in lines)
    assert any("diff --git" in ln for ln in lines)
