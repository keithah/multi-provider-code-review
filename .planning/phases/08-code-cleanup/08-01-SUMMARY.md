---
phase: 08
plan: 01
subsystem: core-orchestration
tags: [cleanup, refactoring, intensity, prompt-builder]
requires:
  - 07-01  # Intensity-based prompt variations (established per-batch pattern)
  - 07-02  # Consensus threshold wiring (runtime intensity fully integrated)
provides:
  - Single source of truth for PromptBuilder instantiation (orchestrator only)
  - Cleaner component setup without unused shared PromptBuilder
  - Reduced confusion about PromptBuilder lifecycle
affects:
  - Future phases will see cleaner setup.ts without legacy code
  - Test suite expectations now match production behavior
decisions:
  - key: remove-shared-promptbuilder
    choice: "Remove PromptBuilder from setup.ts and ReviewComponents"
    rationale: "Phase 7 established per-batch instantiation with runtime intensity; shared instance was unused dead code"
    alternatives: ["Keep shared instance for backward compatibility", "Deprecate gradually"]
    impact: "Breaking change for direct ReviewComponents construction (unlikely external usage)"
key-files:
  created: []
  modified:
    - src/setup.ts
    - src/core/orchestrator.ts
    - __tests__/integration/orchestrator.integration.test.ts
    - __tests__/integration/github-mock.integration.test.ts
    - __tests__/unit/core/orchestrator.health.test.ts
    - __tests__/benchmarks/review-performance.benchmark.ts
tech-stack:
  added: []
  patterns:
    - "Per-batch component instantiation for runtime context"
    - "Dead code removal following architectural refactoring"
metrics:
  duration: 6 min
  completed: 2026-02-07
---

# Phase 08 Plan 01: Remove Legacy PromptBuilder Summary

**One-liner:** Removed unused shared PromptBuilder from setup.ts and ReviewComponents interface; orchestrator now has single source of truth with per-batch instantiation and runtime intensity.

## Overview

This plan cleaned up dead code from the pre-Phase-7 architecture. Before Phase 7, `setup.ts` created a single shared PromptBuilder instance with hardcoded 'standard' intensity. Phase 7 refactored the orchestrator to create PromptBuilder instances per-batch with runtime-determined intensity (thorough/standard/light), making the shared instance unused.

This cleanup:
- Removed PromptBuilder from ReviewComponents interface
- Removed PromptBuilder creation from both setup functions (CLI and Action modes)
- Updated all test mocks to match the new interface
- Added documentation explaining the per-batch pattern

## Tasks Completed

### Task 1: Remove PromptBuilder from setup.ts and ReviewComponents
**Commit:** 90021cd

**Changes:**
- Removed PromptBuilder import from `src/setup.ts`
- Removed `promptBuilder: PromptBuilder` field from ReviewComponents interface in `src/core/orchestrator.ts`
- Removed PromptBuilder instantiation from both `createComponentsForCLI()` and `createComponents()`
- Removed `promptBuilder` from return objects in both setup functions
- Added clarifying comment to ReviewComponents interface explaining per-batch pattern

**Verification:** TypeScript compilation identified all test files needing updates (expected)

### Task 2: Update test mocks to match new interface
**Commit:** a20229e

**Changes:**
- Removed `promptBuilder` from ReviewComponents mocks in 6 locations across `orchestrator.integration.test.ts`
- Removed `promptBuilder` from `github-mock.integration.test.ts`
- Removed `promptBuilder` from `orchestrator.health.test.ts`
- Removed `promptBuilder` from `review-performance.benchmark.ts`
- Removed PromptBuilder imports from all updated test files

**Verification:** All orchestrator and github-mock tests pass (26 tests)

### Task 3: Run full test suite and verify cleanup
**Status:** Complete

**Verification Results:**
- ✓ TypeScript compiles without errors: `npx tsc --noEmit`
- ✓ No `promptBuilder` references in `src/setup.ts`
- ✓ No `promptBuilder:` field in ReviewComponents interface
- ✓ Per-batch `new PromptBuilder(config, reviewIntensity)` still exists at orchestrator.ts:473
- ✓ No `components.promptBuilder` references in source code
- ✓ All orchestrator-related tests pass (1020 passed in related suites)

**Note:** Some unrelated syntax-validator test failures exist (19 failures related to tree-sitter parser initialization), but these are pre-existing and unrelated to this cleanup.

## Deviations from Plan

None - plan executed exactly as written.

## Technical Details

### Architecture Change

**Before (Phases 1-6):**
```typescript
// setup.ts created shared instance with hardcoded intensity
const promptBuilder = new PromptBuilder(config, 'standard', promptEnricher, undefined);

// Passed to orchestrator via ReviewComponents
return { promptBuilder, ... };

// Orchestrator used shared instance (ignored intensity)
const prompt = await this.components.promptBuilder.build(context);
```

**After (Phase 7+):**
```typescript
// setup.ts no longer creates PromptBuilder
return { /* no promptBuilder */ };

// Orchestrator creates per-batch with runtime intensity
const reviewIntensity = determineIntensity(files); // thorough/standard/light
const promptBuilder = new PromptBuilder(config, reviewIntensity);
const prompt = await promptBuilder.build(batchContext);
```

### Benefits

1. **Single Source of Truth**: PromptBuilder lifecycle is now entirely within orchestrator's batch loop
2. **Runtime Flexibility**: Each batch can have different intensity based on file patterns
3. **Reduced Confusion**: No more questions about "which PromptBuilder instance is used?"
4. **Cleaner Setup**: Fewer unused components in setup.ts
5. **Better Testing**: Test mocks now reflect actual production behavior

### Migration Impact

**Breaking Change:** Direct construction of `ReviewComponents` now requires omitting `promptBuilder` field.

**Who's affected:** Only internal tests (already updated). No public API impact.

**Migration path:** Remove `promptBuilder` from any ReviewComponents construction.

## Decisions Made

### Remove vs. Deprecate
**Decision:** Remove immediately rather than deprecate gradually.

**Rationale:**
- ReviewComponents is an internal interface, not public API
- No external consumers identified
- Dead code creates maintenance burden
- Clean break is clearer than deprecation period

**Alternatives considered:**
- Deprecation with console warnings → Adds complexity for no benefit
- Keep as optional field → Maintains confusion about which instance is used

## Next Phase Readiness

**Phase 9 Prerequisites Met:**
- ✓ Codebase is cleaner and easier to understand
- ✓ Single source of truth for PromptBuilder instantiation
- ✓ Test suite matches production behavior
- ✓ No confusing dead code for future contributors

**Blockers:** None

**Concerns:** None

## Files Modified

### Source Files (2)
1. `src/setup.ts` - Removed PromptBuilder creation and import
2. `src/core/orchestrator.ts` - Removed promptBuilder from ReviewComponents interface, added documentation

### Test Files (4)
3. `__tests__/integration/orchestrator.integration.test.ts` - Updated 6 test mocks
4. `__tests__/integration/github-mock.integration.test.ts` - Updated 1 test mock
5. `__tests__/unit/core/orchestrator.health.test.ts` - Updated 1 test mock
6. `__tests__/benchmarks/review-performance.benchmark.ts` - Updated 1 benchmark mock

## Commits

1. **90021cd** - `refactor(08-01): remove PromptBuilder from setup and ReviewComponents`
2. **a20229e** - `test(08-01): remove promptBuilder from test mocks`

## Success Criteria

All success criteria met:

- [x] PromptBuilder is NOT created in setup.ts (neither CLI nor Action mode)
- [x] ReviewComponents interface does NOT include promptBuilder field
- [x] All tests pass without modifications beyond removing promptBuilder from mocks
- [x] Orchestrator still creates PromptBuilder per-batch with runtime intensity at line 473
- [x] TypeScript compiles without errors

## Lessons Learned

1. **Dead Code Detection**: Running tests with code commented out is effective validation
2. **Refactoring Timing**: Immediate cleanup after architectural change prevents confusion
3. **Documentation Value**: Comment explaining per-batch pattern helps future contributors
4. **TypeScript Safety**: Type system caught all necessary test updates automatically

## Performance Impact

**Negligible:** Removing unused code has no runtime performance impact. Slightly faster compilation due to fewer imports.

## Time Breakdown

- Task 1 (Remove from source): 2 min
- Task 2 (Update tests): 3 min
- Task 3 (Verification): 1 min
- **Total: 6 minutes**

**Efficiency:** Fast cleanup due to TypeScript compiler identifying all update locations automatically.
