---
phase: 04-validation-and-quality
plan: 01
subsystem: validation
tags: [tree-sitter, syntax-validation, ast, error-detection]

# Dependency graph
requires:
  - phase: 03-multi-line-and-advanced-formatting
    provides: Multi-line suggestions with validation pipeline
provides:
  - Syntax validation using tree-sitter for all suggestions
  - ERROR and MISSING node detection for robust validation
  - Language-agnostic validation interface
affects: [04-02-consensus, 04-06-integration]

# Tech tracking
tech-stack:
  added: []
  patterns: [tree-sitter-validation, error-recovery-detection]

key-files:
  created:
    - src/validation/syntax-validator.ts
    - src/validation/index.ts
    - __tests__/validation/syntax-validator.test.ts
  modified: []

key-decisions:
  - "Check both ERROR and MISSING nodes for complete validation"
  - "Return skip result for unsupported languages (not failure)"
  - "Use 1-indexed line/column numbers for consistency with GitHub"
  - "Reuse getParser from ast/parsers.ts instead of reimplementing"

patterns-established:
  - "TDD cycle with RED-GREEN-REFACTOR commits"
  - "Validation returns structured result with explicit skip state"

# Metrics
duration: 2min
completed: 2026-02-05
---

# Phase 04 Plan 01: Syntax Validator Summary

**Tree-sitter syntax validation with ERROR and MISSING node detection for TypeScript, JavaScript, Python, and Go**

## Performance

- **Duration:** 2 min
- **Started:** 2026-02-05T07:29:44Z
- **Completed:** 2026-02-05T07:31:41Z
- **Tasks:** 1 (TDD feature)
- **Files modified:** 3 (test, implementation, index)

## Accomplishments
- Implemented validateSyntax function using tree-sitter
- Comprehensive test coverage for all 4 supported languages
- Detects both ERROR nodes (syntax errors) and MISSING nodes (parser recovery)
- Graceful handling of unsupported languages and unavailable parsers
- Reuses existing getParser infrastructure from ast/parsers.ts

## Task Commits

TDD cycle produced 3 atomic commits:

1. **RED - Failing test** - `e16e3eb` (test)
2. **GREEN - Minimal implementation** - `cfd36a5` (feat)
3. **REFACTOR - Clean exports** - `fb5e212` (refactor)

## Files Created/Modified
- `src/validation/syntax-validator.ts` - Tree-sitter validation implementation
- `src/validation/index.ts` - Public API exports
- `__tests__/validation/syntax-validator.test.ts` - Comprehensive test suite (18 tests)

## Decisions Made
- **Check both ERROR and MISSING nodes:** Tree-sitter has two error representations - ERROR nodes (unparseable text) and MISSING nodes (parser-inserted recovery tokens). Only checking hasError misses MISSING nodes. Implementation explicitly checks both.
- **Skip unsupported languages gracefully:** Returns `{ isValid: true, skipped: true }` for unknown/rust languages rather than failing. This prevents suggestion generation from crashing on edge cases.
- **1-indexed line/column numbers:** Matches GitHub's conventions and other validators in the codebase for consistency.
- **Reuse getParser:** Leverages existing ast/parsers.ts infrastructure instead of duplicating grammar loading logic.

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None

## Next Phase Readiness
- Syntax validator ready for integration into suggestion pipeline
- Foundation for Phase 4 Plan 02 (AST comparator for consensus)
- All 4 supported languages tested and working

---
*Phase: 04-validation-and-quality*
*Completed: 2026-02-05*
