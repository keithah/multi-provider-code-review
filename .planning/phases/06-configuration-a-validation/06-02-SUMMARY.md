---
phase: 06-configuration-a-validation
plan: 02
subsystem: configuration
tags: [validation, tdd, config, intensity]
requires:
  - 06-01  # Intensity config schema
provides:
  - Validation helper functions for intensity config
  - Levenshtein distance calculation for typo detection
  - Percentage clamping with warnings
  - Severity enum validation with suggestions
affects:
  - 06-03  # Main validation logic will use these helpers
  - 06-04  # Path pattern validation might use these
decisions:
  - Consensus percentages clamp with warning (don't fail)
  - Severity enums fail strictly with typo suggestions
  - Levenshtein distance threshold <= 2 for suggestions
tech-stack:
  added: []
  patterns:
    - TDD (RED-GREEN-REFACTOR)
    - Levenshtein algorithm for typo detection
key-files:
  created:
    - src/config/validators.ts
    - __tests__/unit/config/validators.test.ts
  modified: []
metrics:
  duration: 2.3 min
  completed: 2026-02-05
---

# Phase 6 Plan 02: Validation Helpers Summary

**One-liner:** TDD implementation of validation helpers with Levenshtein-based typo suggestions for severity enums and warning-based percentage clamping.

## What Was Built

Created validation helper functions for intensity configuration with full TDD approach:

**Core Functions:**
1. `levenshteinDistance(a, b)` - Calculate edit distance between strings for typo detection
2. `clampPercentage(value, fieldName)` - Clamp percentages to 0-100 with warnings (not failures)
3. `validateSeverityWithSuggestion(value, field)` - Strict severity enum validation with typo suggestions

**Validation Strategy:**
- **Consensus percentages:** Clamp to valid range with warning logged, continue running
- **Severity enums:** Fail fast with helpful error messages and typo suggestions
- **Typo detection:** Suggest closest match if Levenshtein distance <= 2

**Test Coverage:** 16 tests covering all edge cases:
- Empty strings, identical strings, transpositions
- Negative values, values over 100, NaN, Infinity, -Infinity
- Valid severities, case insensitivity, close typos, distant strings, non-string input

## Decisions Made

| Decision | Rationale | Impact |
|----------|-----------|--------|
| Clamp percentages vs fail | Per CONTEXT.md: warnings allow config to continue working | User-friendly degradation |
| Strict severity validation | Enums need exact matches to prevent runtime errors | Fail-fast with helpful hints |
| Levenshtein distance <= 2 | Prevents bad suggestions (e.g., "xyz" shouldn't suggest "major") | Better UX |
| Return 50 for NaN | Sensible default when percentage is invalid | Reasonable fallback |
| Handle Infinity explicitly | Treat as extreme values (0 or 100) not as NaN | Intuitive behavior |

## Files Created/Modified

**Created:**
- `src/config/validators.ts` - Validation helper functions (134 lines)
- `__tests__/unit/config/validators.test.ts` - Comprehensive test suite (127 lines)

**Dependencies:**
- Uses existing `ValidationError` from `src/utils/validation.ts`
- Uses existing `logger.warn` from `src/utils/logger.ts`
- Imports `Severity` type from `src/types/index.ts`

## Test Results

```
PASS __tests__/unit/config/validators.test.ts
  validators
    levenshteinDistance (5 tests)
    clampPercentage (5 tests)
    validateSeverityWithSuggestion (6 tests)

Test Suites: 1 passed, 1 total
Tests:       16 passed, 16 total
```

**Build:** ✓ Compiles successfully
**Coverage:** All branches covered

## TDD Cycle Summary

**RED Phase (Commit 9af1502):**
- Created comprehensive test suite with 16 tests
- Tests failed with "Cannot find module" (expected)
- All test cases documented expected behavior

**GREEN Phase (Commit dfc955b):**
- Implemented all three validation functions
- Fixed Infinity handling after initial test failure
- All 16 tests passing

**REFACTOR Phase:**
- No changes needed - code already clean and well-documented
- JSDoc comments explain purpose and usage
- Consistent with existing codebase style

## Integration Points

**Exports for use in main validation:**
```typescript
export function levenshteinDistance(a: string, b: string): number
export function clampPercentage(value: number, fieldName: string): number
export function validateSeverityWithSuggestion(value: unknown, field: string): Severity
```

**Usage pattern:**
```typescript
// Percentage clamping (logs warning, continues)
const threshold = clampPercentage(config.thorough, 'consensusThreshold');

// Severity validation (throws ValidationError with hint)
const severity = validateSeverityWithSuggestion(config.minSeverity, 'minSeverity');
// Error: minSeverity has invalid value: "majr"
// Hint: Did you mean 'major'?
```

## Next Phase Readiness

**Ready for 06-03:** Main validation logic can now import these helpers.

**Validation functions available:**
- ✓ Percentage clamping with warnings
- ✓ Severity validation with typo suggestions
- ✓ Levenshtein distance for suggestion quality

**No blockers or concerns.**

## Commits

1. `9af1502` - test(06-02): add failing test for validation helpers (RED)
2. `dfc955b` - feat(06-02): implement validation helpers (GREEN)

**Total:** 2 commits (REFACTOR phase was no-op)

## Deviations from Plan

None - plan executed exactly as written.

---

*Completed: 2026-02-05*
*Duration: 2.3 minutes*
*Commits: 2*
