---
phase: 01-core-suggestion-formatting
plan: 02
subsystem: formatting
tags: [github-suggestions, diff-validation, line-mapping, tdd, jest]

# Dependency graph
requires:
  - mapLinesToPositions from diff.ts (existing utility)
provides:
  - validateSuggestionLine() - Validates line exists in diff, returns position
  - isSuggestionLineValid() - Boolean convenience wrapper
  - Line validation foundation for suggestion formatting
affects: [01-03-formatter-integration, phase-2-llm-integration]

# Tech tracking
tech-stack:
  added: []
  patterns: [TDD with Jest, Pure utility functions, Integration with existing diff utilities]

key-files:
  created:
    - src/utils/suggestion-validator.ts
    - __tests__/unit/utils/suggestion-validator.test.ts
  modified: []

key-decisions:
  - "Use mapLinesToPositions directly instead of reimplementing line mapping logic"
  - "Return null (not undefined) for invalid lines for explicit null checks"
  - "Provide both position-returning and boolean variants for different use cases"

patterns-established:
  - "TDD workflow: RED (failing test) → GREEN (implementation) → minimal implementation"
  - "Integration testing with existing utilities rather than mocking"
  - "Atomic commits per TDD phase for clear git history"

# Metrics
duration: 3min
completed: 2026-02-05
---

# Phase 1 Plan 02: Suggestion Line Validator Summary

**Line validation utilities integrating with diff.ts mapLinesToPositions to validate suggestion target lines exist in RIGHT side of diff**

## Performance

- **Duration:** 3 min
- **Started:** 2026-02-05T04:26:16Z
- **Completed:** 2026-02-05T04:29:01Z
- **Tasks:** 1 (TDD: 2 commits)
- **Files created:** 2

## Accomplishments
- Line validation utility with 12 passing tests
- Integration with existing diff.ts mapLinesToPositions utility
- Handles edge cases: undefined patch, empty patch, lines not in diff, complex patches with deletions
- Foundation ready for formatter integration in plan 01-03

## Task Commits

Each TDD phase was committed atomically:

1. **Task 1 - RED phase: Write failing tests** - `93aa45e` (test)
2. **Task 1 - GREEN phase: Implement validator** - `760990b` (feat)

_Note: No refactoring needed - implementation clean and minimal on first pass_

## Files Created/Modified
- `src/utils/suggestion-validator.ts` - Pure functions for validating suggestion lines exist in diff (57 lines)
- `__tests__/unit/utils/suggestion-validator.test.ts` - Comprehensive test suite with 12 test cases covering edge cases (98 lines)

## Decisions Made

1. **Reuse mapLinesToPositions instead of reimplementing**
   - **Rationale:** DRY principle - mapLinesToPositions already correctly handles diff parsing
   - **Impact:** Minimal code, reduced maintenance burden, consistent behavior
   - **Tradeoffs:** None - this is the correct approach

## Deviations from Plan

None - plan executed exactly as written using TDD methodology.

## Issues Encountered

None - implementation straightforward. Integration with existing diff.ts utility worked perfectly on first attempt.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

**Ready for Plan 01-03:** Formatter integration can now validate lines before creating suggestions.

**Integration points for 01-03:**
- Import validateSuggestionLine to check line validity before formatting
- Use returned position for GitHub PR review comment API
- isSuggestionLineValid for quick boolean checks in conditional logic

**Blockers:** None

**Concerns:** None - validation foundation is solid and well-tested

---
*Phase: 01-core-suggestion-formatting*
*Completed: 2026-02-05*
