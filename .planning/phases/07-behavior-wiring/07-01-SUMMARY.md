---
phase: 07-behavior-wiring
plan: 01
subsystem: analysis
tags: [llm, prompt-generation, intensity, tdd]

# Dependency graph
requires:
  - phase: 06-configuration-validation
    provides: Intensity configuration and validation
provides:
  - Intensity-aware prompt generation with thorough/standard/light variations
  - Switch-based instruction generation with exhaustiveness checking
  - Tests verifying distinct prompt content per intensity level
affects: [08-analysis-pipeline-wiring, 09-end-to-end-integration]

# Tech tracking
tech-stack:
  added: []
  patterns: [switch-based intensity handling with never type exhaustiveness]

key-files:
  created: []
  modified:
    - src/analysis/llm/prompt-builder.ts
    - __tests__/unit/analysis/llm/prompt-builder.test.ts
    - __tests__/unit/core/intensity.test.ts

key-decisions:
  - "Thorough mode includes COMPREHENSIVE analysis with edge cases and boundary conditions"
  - "Standard mode preserves exact current production behavior (baseline)"
  - "Light mode uses QUICK scan for CRITICAL issues only (crashes, data loss, security)"
  - "Exhaustiveness check uses never type in default case for compile-time safety"

patterns-established:
  - "getInstructionsByIntensity() method pattern for intensity-based configuration"
  - "Switch statement with never type for exhaustive enum handling"

# Metrics
duration: 6min
completed: 2026-02-06
---

# Phase 7 Plan 01: Intensity-Aware Prompt Generation Summary

**PromptBuilder generates visibly different prompts for thorough/standard/light intensities using switch-based instruction selection with TypeScript exhaustiveness checking**

## Performance

- **Duration:** 6 minutes
- **Started:** 2026-02-06T16:30:43Z
- **Completed:** 2026-02-06T16:36:39Z
- **Tasks:** 1 (TDD: RED + GREEN phases)
- **Files modified:** 3

## Accomplishments
- PromptBuilder.build() generates distinct instructions based on intensity parameter
- Thorough mode includes comprehensive analysis (edge cases, boundary conditions, race conditions)
- Light mode generates brief QUICK scan instructions (critical issues only)
- Standard mode maintains exact current production behavior as baseline
- Exhaustiveness check prevents unhandled intensity values at compile time

## Task Commits

TDD task produced 2 commits:

1. **RED Phase: Add failing tests** - `1c7ab86` (test)
   - Added tests for COMPREHENSIVE instructions in thorough mode
   - Added tests for QUICK scan instructions in light mode
   - Added tests verifying standard mode baseline behavior
   - Added tests for prompt length variations by intensity

2. **GREEN Phase: Implement feature** - `fba1a1c` (feat)
   - Added getInstructionsByIntensity() method with switch statement
   - Thorough case: COMPREHENSIVE analysis with edge cases
   - Standard case: baseline "ONLY report actual bugs" behavior
   - Light case: QUICK scan for CRITICAL issues only
   - Default case: exhaustiveness check using never type
   - Updated build() to use getInstructionsByIntensity()

No REFACTOR phase needed - implementation is clean and well-structured.

## Files Created/Modified
- `src/analysis/llm/prompt-builder.ts` - Added getInstructionsByIntensity() method, updated build() to use it
- `__tests__/unit/analysis/llm/prompt-builder.test.ts` - Added intensity-aware prompt generation test suite
- `__tests__/unit/core/intensity.test.ts` - Updated tests to verify async build() calls and intensity variations

## Decisions Made

**Thorough mode instruction design:**
- Includes COMPREHENSIVE analysis directive
- Lists specific issue types: edge cases, boundary conditions, race conditions, resource leaks
- Adds ANALYZE section for deeper inspection areas
- Rationale: Provides LLM with explicit guidance for more thorough review

**Standard mode preservation:**
- Keeps exact current production instructions unchanged
- Rationale: Baseline for comparison, proven behavior, no regression risk

**Light mode instruction design:**
- QUICK scan directive with CRITICAL issues only
- Explicitly skips lower-severity issues (style, performance, architecture)
- Brief findings instruction
- Rationale: Faster reviews for time-sensitive contexts, focuses on showstoppers

**Exhaustiveness check pattern:**
- Uses `const _exhaustive: never = this.intensity` in default case
- TypeScript compiler errors if new intensity value added to ReviewIntensity type
- Rationale: Compile-time safety prevents runtime errors from unhandled cases

## Deviations from Plan

None - plan executed exactly as written.

TDD cycle followed:
1. RED: Tests written and verified failing
2. GREEN: Implementation added to pass tests
3. REFACTOR: Not needed (code already clean)

## Issues Encountered

None - implementation proceeded smoothly.

## Next Phase Readiness

PromptBuilder is ready for integration:
- Intensity parameter drives visible prompt variations
- All tests pass (prompt-builder, intensity, validation suites)
- TypeScript compiles without errors
- Exhaustiveness check prevents future bugs

**Ready for:**
- Phase 07-02: Wire intensity through analysis pipeline
- Phase 08: Analysis orchestrator integration

**No blockers or concerns.**

---
*Phase: 07-behavior-wiring*
*Completed: 2026-02-06*
