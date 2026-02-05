---
phase: 02-llm-fix-generation-integration
plan: 01
subsystem: llm
tags: [prompt-engineering, llm, fix-generation, code-review]

# Dependency graph
requires:
  - phase: 01-core-suggestion-formatting
    provides: suggestion formatter infrastructure
provides:
  - LLM prompts now request fix suggestions alongside findings
  - JSON schema includes optional suggestion field
  - Fixable vs non-fixable issue type guidance
affects: [02-02, 02-03, prompt-templates, llm-providers]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "System message includes fix generation instructions"
    - "Allowlist approach for fixable issue types"
    - "Strict schema validation (no retries)"

key-files:
  created:
    - __tests__/unit/analysis/llm/prompt-builder.test.ts
  modified:
    - src/analysis/llm/prompt-builder.ts

key-decisions:
  - "Add instructions to system message (applies to all requests)"
  - "Uniform prompts across all providers (no provider-specific templates)"
  - "Allowlist approach for fixable types (explicit is safer than heuristic)"
  - "Strict validation approach (no retries for malformed suggestions)"

patterns-established:
  - "Suggestion field marked as optional in schema"
  - "Fixed code must be exact replacement, no explanations"
  - "Fixable types: null reference, type error, off-by-one, missing null check, resource leak"

# Metrics
duration: 2min
completed: 2026-02-05
---

# Phase 02 Plan 01: Prompt Builder Extension Summary

**LLM prompts now request fix suggestions via JSON schema with fixable/non-fixable guidance and example**

## Performance

- **Duration:** 2 min
- **Started:** 2026-02-05T05:19:12Z
- **Completed:** 2026-02-05T05:21:25Z
- **Tasks:** 2
- **Files modified:** 2

## Accomplishments
- Extended PromptBuilder to request fix suggestions in LLM responses
- Added comprehensive test coverage for suggestion instructions
- Established fixable vs non-fixable issue categorization
- Provided clear example JSON showing suggestion field usage

## Task Commits

Each task was committed atomically:

1. **Task 1: Add fix generation instructions to PromptBuilder** - `0e9ed38` (feat)
2. **Task 2: Add/update tests for suggestion instructions** - `3b5edad` (test)

## Files Created/Modified
- `src/analysis/llm/prompt-builder.ts` - Extended JSON schema to include suggestion field, added SUGGESTION FIELD guidance section with fixable types, non-fixable types, and example JSON
- `__tests__/unit/analysis/llm/prompt-builder.test.ts` - Created comprehensive test suite verifying suggestion instructions are present in prompts (7 test cases)

## Decisions Made

All decisions followed CONTEXT.md specifications:
- Add to system message (applies to all requests uniformly)
- Uniform prompts across all providers (no provider-specific variations)
- Allowlist approach for fixable types (safer than heuristic detection)
- Strict validation (LLM must get schema right, no retries)

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

**Pre-existing test failure:** Found `suggestion-sanity.test.ts` references non-existent `src/utils/suggestion-sanity.ts` (from Phase 1). This is unrelated to Phase 02-01 work. All prompt-builder tests pass (23/23).

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

Ready for Phase 02-02 (Response Parsing):
- Prompts now request suggestion field
- JSON schema clearly defined
- Fixable type guidance provided
- Next step: Parse LLM responses and extract suggestion field

Blockers/Concerns:
- Phase 1 left incomplete: `suggestion-sanity.ts` implementation missing (test exists but file doesn't)

---
*Phase: 02-llm-fix-generation-integration*
*Completed: 2026-02-05*
