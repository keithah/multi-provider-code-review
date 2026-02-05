---
phase: 01-core-suggestion-formatting
verified: 2026-02-05T04:39:47Z
status: human_needed
score: 8/9 must-haves verified
human_verification:
  - test: "Create a PR with a finding that has a suggestion, verify GitHub UI shows 'Commit suggestion' button"
    expected: "Comment renders with code suggestion block and clickable 'Commit suggestion' button"
    why_human: "GitHub UI rendering can't be verified programmatically - requires actual PR posting"
---

# Phase 1: Core Suggestion Formatting Verification Report

**Phase Goal:** Convert Finding.suggestion text to valid GitHub suggestion markdown blocks with accurate line mapping

**Verified:** 2026-02-05T04:39:47Z

**Status:** human_needed (automated checks passed, awaiting human verification)

**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | formatSuggestionBlock() produces valid GitHub suggestion markdown | ✓ VERIFIED | Implementation exists with 15 passing tests covering normal, backtick-escaped, and edge cases |
| 2 | Backticks in suggestion content do not break markdown rendering | ✓ VERIFIED | Dynamic fence delimiter calculation (max backticks + 1) implemented and tested |
| 3 | Empty or whitespace-only suggestions return empty string (no block) | ✓ VERIFIED | Tests confirm empty/whitespace returns '', block only created for substantive content |
| 4 | validateSuggestionLine() returns position when line exists in diff | ✓ VERIFIED | Implementation leverages mapLinesToPositions, 12 tests confirm position mapping |
| 5 | validateSuggestionLine() returns null when line is not in diff | ✓ VERIFIED | Tests confirm null for missing lines, undefined patch, empty patch |
| 6 | isSuggestionLineValid() provides boolean convenience wrapper | ✓ VERIFIED | Implementation wraps validateSuggestionLine !== null, tests confirm behavior |
| 7 | Inline comments with Finding.suggestion include GitHub commit suggestion blocks | ✓ VERIFIED | Both formatters call formatSuggestionBlock when f.suggestion exists |
| 8 | Suggestions render with 'Commit suggestion' button in GitHub UI | ? HUMAN | Automated checks pass (formatters produce ```suggestion syntax), requires real PR test |
| 9 | Invalid suggestion lines are rejected with warning log (finding still posts without suggestion) | ✓ VERIFIED | CommentPoster validates with isSuggestionLineValid, logs warning, strips block via regex, preserves finding |

**Score:** 8/9 truths verified (1 requires human verification)

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `src/utils/suggestion-formatter.ts` | Exports formatSuggestionBlock, countMaxConsecutiveBackticks; 40+ lines | ✓ VERIFIED | 70 lines, exports correct, substantive implementation with dynamic escaping |
| `__tests__/unit/utils/suggestion-formatter.test.ts` | Test coverage; 60+ lines | ✓ VERIFIED | 81 lines, 15 passing tests, covers edge cases (empty, whitespace, nested backticks) |
| `src/utils/suggestion-validator.ts` | Exports validateSuggestionLine, isSuggestionLineValid; 30+ lines | ✓ VERIFIED | 57 lines, exports correct, integrates with mapLinesToPositions |
| `__tests__/unit/utils/suggestion-validator.test.ts` | Test coverage; 50+ lines | ✓ VERIFIED | 98 lines, 12 passing tests, covers edge cases (undefined/empty patch, complex diffs) |
| `src/output/formatter.ts` | Contains formatSuggestionBlock import/usage | ✓ VERIFIED | Import at line 2, usage at line 101-106 in printSeveritySection |
| `src/output/formatter-v2.ts` | Contains formatSuggestionBlock import/usage | ✓ VERIFIED | Import at line 2, usage at line 244-250 in formatFinding |
| `src/github/comment-poster.ts` | Contains validateSuggestionLine/isSuggestionLineValid import/usage | ✓ VERIFIED | Import at line 7, usage at line 172-178 in postInline with warning log |

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|----|--------|---------|
| formatter.ts | suggestion-formatter.ts | import formatSuggestionBlock | ✓ WIRED | Line 2 import, line 101 call, result rendered in output |
| formatter-v2.ts | suggestion-formatter.ts | import formatSuggestionBlock | ✓ WIRED | Line 2 import, line 244 call, result rendered in output |
| comment-poster.ts | suggestion-validator.ts | import isSuggestionLineValid | ✓ WIRED | Line 7 import, line 174 validation check, strips block if invalid (line 177) |
| suggestion-validator.ts | diff.ts | import mapLinesToPositions | ✓ WIRED | Line 9 import, line 37 call, returns mapped position |
| formatters | Finding.suggestion field | check f.suggestion/finding.suggestion | ✓ WIRED | Both formatters check for suggestion field existence before formatting |

### Requirements Coverage

| Requirement | Status | Evidence |
|-------------|--------|----------|
| FR-1.1: Single-line suggestion formatting | ✓ SATISFIED | formatSuggestionBlock produces valid ```suggestion blocks with tests |
| FR-1.2: Suggestion block escaping | ✓ SATISFIED | Dynamic fence delimiter (max backticks + 1) prevents markdown conflicts |
| FR-1.3: Line number accuracy | ✓ SATISFIED | validateSuggestionLine leverages mapLinesToPositions for RIGHT-side validation |

### Anti-Patterns Found

**None.**

No TODO/FIXME comments, no placeholder content, no empty implementations, no console.log-only functions found in any modified files.

### Human Verification Required

#### 1. GitHub UI Suggestion Button Rendering

**Test:** Create a test PR with a code change, trigger a review that posts a finding with a suggestion (modify a provider's prompt to return Finding.suggestion), verify the posted PR comment.

**Expected:**
- Comment renders with a code block showing the suggestion
- GitHub displays a "Commit suggestion" button next to the code block
- Clicking the button creates a commit with the suggested change

**Why human:** GitHub's UI rendering of ```suggestion blocks requires posting to a real PR. Automated tests verify the markdown syntax is correct, but only GitHub's UI can confirm the button appears and functions correctly.

---

_Verified: 2026-02-05T04:39:47Z_
_Verifier: Claude (gsd-verifier)_
