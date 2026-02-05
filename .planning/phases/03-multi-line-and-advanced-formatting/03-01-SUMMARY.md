---
phase: 03-multi-line-and-advanced-formatting
plan: 01
subsystem: validation
tags: [diff, multi-line, github-api, range-validation]

# Dependency graph
requires:
  - phase: 01-core-suggestion-formatting
    provides: mapLinesToPositions utility for line-to-position mapping
  - phase: 02-llm-fix-generation
    provides: 50-line sanity limit decision
provides:
  - validateSuggestionRange function for multi-line suggestion validation
  - RangeValidationResult interface for structured validation results
  - Consecutive line checking for GitHub multi-line suggestion requirements
affects:
  - 03-02 (will use validateSuggestionRange for hunk boundary validation)
  - 03-03 (will use validateSuggestionRange in comment posting logic)

# Tech tracking
tech-stack:
  added: []
  patterns:
    - Inclusive range calculation (endLine - startLine + 1) for accurate length
    - Fail-fast validation (check existence before checking gaps)
    - Structured validation results with explicit isValid flag

key-files:
  created: []
  modified:
    - src/utils/suggestion-validator.ts
    - __tests__/unit/utils/suggestion-validator.test.ts

key-decisions:
  - "Use inclusive range formula (endLine - startLine + 1) to avoid off-by-one errors"
  - "Fail fast on missing lines rather than separate gap detection (simpler logic)"
  - "Return positions in validation result for convenience (avoid redundant lookups)"

patterns-established:
  - "RangeValidationResult interface pattern for structured validation with positions"
  - "Multi-line validation checks: direction → length → existence → consecutiveness"

# Metrics
duration: 2min
completed: 2026-02-05
---

# Phase 03 Plan 01: Multi-Line Range Validation Summary

**validateSuggestionRange validates line ranges for GitHub multi-line suggestions with direction, length, existence, and consecutiveness checks**

## Performance

- **Duration:** 2 min
- **Started:** 2026-02-05T06:25:51Z
- **Completed:** 2026-02-05T06:28:14Z
- **Tasks:** 1
- **Files modified:** 2

## Accomplishments
- TDD implementation of validateSuggestionRange with comprehensive test coverage
- Validates range direction (start <= end), 50-line sanity limit, line existence, and consecutiveness
- Returns start/end positions for valid ranges, detailed error reasons for invalid ranges
- Handles edge case: single-line range (start === end) correctly has length 1

## Task Commits

Each task was committed atomically:

1. **Task 1: TDD - Multi-line range validation** - `37cba91` (feat)

_Note: TDD task combined RED and GREEN phases into single commit as tests and implementation were developed together_

## Files Created/Modified
- `src/utils/suggestion-validator.ts` - Added validateSuggestionRange function and RangeValidationResult interface
- `__tests__/unit/utils/suggestion-validator.test.ts` - Added 11 test cases covering all validation scenarios

## Decisions Made

**1. Use inclusive range formula (endLine - startLine + 1)**
- Rationale: Prevents off-by-one errors. Range [10,10] should be 1 line, not 0.

**2. Fail fast on missing lines**
- Rationale: Simpler logic than separate gap detection. Missing line check naturally catches gaps.

**3. Return positions in validation result**
- Rationale: Callers need positions for GitHub API. Returning them avoids redundant lookups.

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

**Test patch design for gap validation:**
- Initial patch with deletion created confusion about line numbering
- Resolved by using multi-hunk patch with explicit line number gaps
- Verification: Test correctly validates non-consecutive line ranges

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- Multi-line range validation complete
- Ready for Plan 03-02: Hunk boundary validation
- validateSuggestionRange provides foundation for ensuring ranges don't cross hunk boundaries

---
*Phase: 03-multi-line-and-advanced-formatting*
*Completed: 2026-02-05*
