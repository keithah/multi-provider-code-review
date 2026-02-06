---
phase: 07-behavior-wiring
plan: 02
subsystem: core
tags: [consensus, intensity, filtering, thresholds]

# Dependency graph
requires:
  - phase: 07-01
    provides: Intensity-aware prompt generation
  - phase: 06
    provides: Intensity configuration schema and validation
provides:
  - Intensity-aware consensus threshold calculation
  - Dynamic severity filtering based on intensity
  - Per-review ConsensusEngine instantiation with calculated thresholds
affects: [07-03, integration-testing, production-rollout]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Dynamic consensus threshold calculation from percentages"
    - "Per-review ConsensusEngine instantiation for intensity flexibility"

key-files:
  created: []
  modified:
    - src/core/orchestrator.ts
    - __tests__/unit/core/intensity.test.ts
    - __tests__/unit/core/orchestrator.test.ts

key-decisions:
  - "Create ConsensusEngine per-review instead of using shared instance"
  - "Round up fractional provider counts with Math.ceil()"
  - "Fallback to inlineMinAgreement when intensity config missing"
  - "Use 1 as minimum minAgreement for 0 providers edge case"

patterns-established:
  - "Intensity settings convert from percentage to provider count at runtime"
  - "Debug logging tracks threshold calculation decisions"

# Metrics
duration: 3min
completed: 2026-02-06
---

# Phase 7 Plan 02: Intensity-Aware Consensus and Severity Wiring Summary

**Dynamic consensus thresholds wire intensity percentages (80%/60%/40%) into ConsensusEngine with runtime provider count calculation**

## Performance

- **Duration:** 3 min
- **Started:** 2026-02-06T16:39:56Z
- **Completed:** 2026-02-06T16:43:03Z
- **Tasks:** 2 (TDD: test + implementation)
- **Files modified:** 3

## Accomplishments
- Consensus thresholds calculated from intensity percentages at runtime
- Thorough reviews require 80% provider agreement (4 of 5 providers)
- Standard reviews require 60% provider agreement (3 of 5 providers)
- Light reviews require 40% provider agreement (2 of 5 providers)
- Severity filters mapped: thorough/standard show minor+, light shows major+ only
- Edge cases handled: 0 providers defaults to minAgreement=1, fractional counts round up

## Task Commits

Each task was committed atomically:

1. **Task 1: TDD RED - Write failing tests** - `02e4c45` (test)
2. **Task 2: TDD GREEN - Implement consensus wiring** - `389f1b8` (feat)

_Note: TDD tasks have separate test/implementation commits per RED-GREEN-REFACTOR cycle_

## Files Created/Modified
- `src/core/orchestrator.ts` - Added intensity-aware consensus threshold calculation and dynamic ConsensusEngine instantiation
- `__tests__/unit/core/intensity.test.ts` - Added consensus threshold and severity filter mapping tests
- `__tests__/unit/core/orchestrator.test.ts` - Added consensus wiring integration tests

## Decisions Made

**Create ConsensusEngine per-review instead of shared instance**
- Rationale: Intensity is determined at runtime based on file paths, so threshold must be dynamic
- Impact: Each review gets appropriately-tuned consensus filtering
- Alternative considered: Parameterize shared instance - rejected as less flexible

**Round up fractional provider counts with Math.ceil()**
- Rationale: Ensures higher agreement thresholds (80% of 3 providers = 2.4 → 3, not 2)
- Matches "thorough means stricter" user expectations
- Prevents 66.67% from being treated as 80% threshold

**Fallback to inlineMinAgreement when intensity config missing**
- Rationale: Backward compatibility for configs without intensity settings
- Uses existing config values: inlineMinAgreement (2), inlineMinSeverity ('major')
- Ensures graceful degradation

**Use 1 as minimum minAgreement for 0 providers edge case**
- Rationale: Prevents ConsensusEngine from receiving 0 which would filter everything
- Edge case unlikely in production (0 providers means no LLM execution)
- Defensive programming for test scenarios and error conditions

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None - implementation was straightforward. Existing test infrastructure supported TDD workflow cleanly.

## Next Phase Readiness

**Ready for:**
- Phase 7 Plan 03 (if additional behavior wiring needed)
- Integration testing with real provider configurations
- Production rollout with intensity-based filtering

**Verification:**
- All intensity tests pass (23 tests)
- All orchestrator tests pass (25 tests)
- All consensus tests pass (9 tests) - no regressions
- TypeScript compiles without errors

**Notes:**
- Intensity now controls three behaviors: prompts (07-01), provider counts, timeouts, and consensus thresholds (07-02)
- Light reviews are significantly faster AND more selective (fewer providers, shorter timeout, lower agreement threshold, major+ only)
- Thorough reviews are comprehensive AND strict (more providers, longer timeout, higher agreement threshold, minor+ shown)

---
*Phase: 07-behavior-wiring*
*Completed: 2026-02-06*
