---
phase: 02-llm-fix-generation-integration
plan: 04
subsystem: llm
tags: [token-estimation, context-window, prompt-engineering, llm-prompts]

# Dependency graph
requires:
  - phase: 02-01
    provides: Suggestion instructions in prompt template
  - phase: 02-03
    provides: LLM parser suggestion extraction
provides:
  - Token-aware suggestion instruction control
  - Conditional prompt building based on diff size
  - Large diff safety mechanism to prevent hallucinated fixes
affects: [integration-testing, end-to-end-validation]

# Tech tracking
tech-stack:
  added: []
  patterns: [conditional-prompt-building, token-aware-instruction-control]

key-files:
  created: []
  modified: [src/analysis/llm/prompt-builder.ts, __tests__/unit/analysis/llm/prompt-builder.test.ts]

key-decisions:
  - "Use single 50k token threshold (not tiered) for simplicity - conservative for small windows, reasonable for large"
  - "Skip entire suggestion instructions (not just examples) when diff is large - cleaner schema reduction"
  - "Log skip at debug level (not warn/info) - normal flow, not exceptional condition"

patterns-established:
  - "Token-aware prompt control: Check context window fit before adding optional sections"
  - "Conditional schema: Simplify JSON schema when features must be disabled due to constraints"

# Metrics
duration: 3min
completed: 2026-02-05
---

# Phase 2 Plan 4: Token-Aware Context Management Summary

**Large diff detection with 50k token threshold conditionally skips suggestion instructions to prevent hallucinated fixes from truncated context**

## Performance

- **Duration:** 3 min
- **Started:** 2026-02-05T05:31:18Z
- **Completed:** 2026-02-05T05:33:50Z
- **Tasks:** 3
- **Files modified:** 2

## Accomplishments
- Added shouldSkipSuggestions helper method with 50k token threshold for large diff detection
- Modified build() to conditionally include suggestion instructions based on diff size
- Small diffs (<50k tokens) get full SUGGESTION FIELD instructions with schema
- Large diffs (>50k tokens) get simplified schema without suggestion field
- Debug logging when suggestions are skipped
- Test coverage for both small and large diff scenarios

## Task Commits

Each task was committed atomically:

1. **Task 1: Add helper function to determine if suggestions should be skipped** - `9c5f869` (feat)
2. **Task 2: Conditionally include suggestion instructions in build()** - `ac73ada` (feat)
3. **Task 3: Add tests for token-aware skip logic** - `d1ec82a` (test)

## Files Created/Modified
- `src/analysis/llm/prompt-builder.ts` - Added shouldSkipSuggestions helper and conditional suggestion instruction logic
- `__tests__/unit/analysis/llm/prompt-builder.test.ts` - Added token-aware suggestion skip tests

## Decisions Made

**1. Use single 50k token threshold instead of tiered approach**
- **Rationale:** Simplicity while maintaining safety across all context window sizes
- **Conservative enough:** 50k tokens fits safely in medium windows (128k-200k) with room for response
- **Safe margin for small:** Small windows (4k-16k) already get diff trimming earlier, this is secondary protection
- **Reasonable for large:** Large windows (1M+) can handle suggestions easily, threshold won't trigger

**2. Skip entire suggestion instructions block when threshold exceeded**
- **Rationale:** Cleaner schema reduction than partial instructions
- **Alternatives considered:** Could keep instructions but note "optional" - rejected as confusing
- **Result:** Schema cleanly drops `suggestion` field when context is tight

**3. Log skip at debug level (not warn/info)**
- **Rationale:** Per CONTEXT.md guidance - this is normal flow, not exceptional condition
- **Not a failure:** Large PRs are expected, skipping suggestions is correct behavior
- **Monitoring:** Debug level allows operators to observe behavior without alert fatigue

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None - all tasks completed smoothly with no blocking issues.

## Next Phase Readiness

**Ready for Phase 2 completion:**
- Suggestion generation instructions (02-01) ✓
- Structured validation with sanity checks (02-02) ✓
- LLM parser suggestion extraction (02-03) ✓
- Token-aware context management (02-04) ✓

**Phase 2 complete.** All LLM fix generation integration capabilities delivered:
- LLMs receive instructions to generate fix suggestions
- Parser extracts and validates suggestions
- Large diffs gracefully skip suggestion generation to prevent hallucination
- Test coverage confirms end-to-end flow

**Ready for Phase 3:** Multi-line suggestion support (GitHub API patterns for multi-line diffs)

**No blockers.** System can safely generate single-line suggestions with automatic fallback for large diffs.

---
*Phase: 02-llm-fix-generation-integration*
*Completed: 2026-02-05*
