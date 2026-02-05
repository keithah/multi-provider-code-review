---
phase: 01-core-suggestion-formatting
plan: 03
subsystem: output
tags: [markdown, github-suggestions, formatting, validation]

# Dependency graph
requires:
  - phase: 01-01
    provides: formatSuggestionBlock utility for GitHub suggestion syntax
  - phase: 01-02
    provides: isSuggestionLineValid validator for diff line validation
provides:
  - Integrated suggestion formatting into both MarkdownFormatter and MarkdownFormatterV2
  - Suggestion validation in CommentPoster with graceful degradation
  - End-to-end pipeline from Finding.suggestion to GitHub commit suggestion UI
affects: [inline-comments, output-pipeline, pr-posting]

# Tech tracking
tech-stack:
  added: []
  patterns: [graceful-degradation-for-invalid-suggestions]

key-files:
  created: []
  modified:
    - src/output/formatter.ts
    - src/output/formatter-v2.ts
    - src/github/comment-poster.ts
    - __tests__/unit/output/formatter.test.ts

key-decisions:
  - "Use formatSuggestionBlock for consistent suggestion rendering across both formatters"
  - "Validate suggestion lines in CommentPoster before posting to prevent API errors"
  - "Gracefully degrade invalid suggestions to plain text rather than dropping finding"

patterns-established:
  - "Suggestion validation pattern: check isSuggestionLineValid and strip block if invalid"
  - "Regex-based suggestion block removal: /```suggestion[\s\S]*?```/g for graceful degradation"

# Metrics
duration: 4min
completed: 2026-02-05
---

# Phase 01 Plan 03: Output Pipeline Integration Summary

**Both formatters now render GitHub commit suggestion blocks with validation, enabling one-click fix application in PR comments**

## Performance

- **Duration:** 4 minutes
- **Started:** 2026-02-05T04:31:49Z
- **Completed:** 2026-02-05T04:35:51Z
- **Tasks:** 3
- **Files modified:** 4

## Accomplishments
- Integrated formatSuggestionBlock into both MarkdownFormatter and MarkdownFormatterV2
- Added suggestion line validation to CommentPoster with graceful degradation
- Updated test expectations to match new suggestion block format
- Achieved end-to-end pipeline: Finding.suggestion → GitHub suggestion syntax → "Commit suggestion" button

## Task Commits

Each task was committed atomically:

1. **Task 1: Update MarkdownFormatter to use suggestion blocks** - `e95c851` (feat)
2. **Task 2: Update MarkdownFormatterV2 to use suggestion blocks** - `d51ac98` (feat)
3. **Task 3: Add suggestion validation to CommentPoster** - `5a9cdde` (feat)
4. **Test fix: Update formatter test for suggestion block format** - `6eaf4bf` (test)

**Plan metadata:** (to be added after this commit)

## Files Created/Modified
- `src/output/formatter.ts` - Replaced plain text suggestion with formatSuggestionBlock call
- `src/output/formatter-v2.ts` - Replaced manual backtick handling with formatSuggestionBlock utility
- `src/github/comment-poster.ts` - Added isSuggestionLineValid check with graceful degradation
- `__tests__/unit/output/formatter.test.ts` - Updated test expectations for suggestion block format

## Decisions Made

**1. Validate suggestions in CommentPoster rather than formatters**
- Rationale: Formatters don't have access to diff context; CommentPoster has file patches available
- Pattern: Check validity just before API call, strip suggestion block if invalid, keep finding text

**2. Use regex replacement for graceful degradation**
- Pattern: `/```suggestion[\s\S]*?```/g` with replacement text "_Suggestion not available for this line_"
- Rationale: Ensures finding still gets posted with explanation rather than failing silently

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Updated formatter test expectations**
- **Found during:** Full test suite run after Task 1
- **Issue:** Test asserted old plain text format "Suggestion: Use const instead of let"
- **Fix:** Updated to expect suggestion block format with "**Suggested fix:**" header and "```suggestion" fence
- **Files modified:** `__tests__/unit/output/formatter.test.ts`
- **Verification:** Test passes, formatter output validated
- **Committed in:** `6eaf4bf` (separate test commit)

---

**Total deviations:** 1 auto-fixed (1 bug - test expectation)
**Impact on plan:** Test assertion was incorrect after implementation change. No scope creep.

## Issues Encountered

None

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

**Core suggestion formatting complete.** The pipeline now:
1. Accepts `Finding.suggestion` from LLM providers
2. Formats as GitHub suggestion blocks with proper escaping
3. Validates suggestion lines exist in diff
4. Gracefully degrades invalid suggestions
5. Posts to GitHub with "Commit suggestion" button

**Ready for:**
- Real-world testing with actual PR comments
- Multi-line suggestion support (Phase 3)
- Provider prompt tuning to generate better suggestions

**No blockers.**

---
*Phase: 01-core-suggestion-formatting*
*Completed: 2026-02-05*
