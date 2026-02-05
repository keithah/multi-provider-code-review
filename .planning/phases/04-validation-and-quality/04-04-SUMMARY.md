---
phase: 04-validation-and-quality
plan: 04
subsystem: learning
tags: [feedback, suppression, provider-weights, learning, tdd]
completed: 2026-02-05
duration: 3min
type: tdd

dependencies:
  requires:
    - cache-storage (existing)
    - logger (existing)
  provides:
    - suppression-tracker
    - provider-weights
  affects:
    - 04-05 (will integrate into confidence calculation)
    - 04-06 (may use for filtering suggestions)

tech-stack:
  added: []
  patterns:
    - feedback-based-learning
    - pattern-matching
    - time-based-expiry

key-files:
  created:
    - src/learning/suppression-tracker.ts
    - src/learning/provider-weights.ts
    - __tests__/learning/suppression-tracker.test.ts
    - __tests__/learning/provider-weights.test.ts
  modified: []

decisions:
  - id: suppression-scope
    choice: "Support both PR-scoped and repo-scoped suppression"
    rationale: "PR scope for temporary noise reduction, repo scope for persistent patterns"
    impact: "Flexible suppression across different use cases"
  - id: similarity-heuristic
    choice: "Simple file+category+line-proximity matching (within 5 lines)"
    rationale: "Balances precision and recall without complex NLP"
    impact: "Fast matching, may miss semantically similar suggestions"
  - id: weight-formula
    choice: "weight = 0.3 + (0.7 * positiveRate) with 5-feedback threshold"
    rationale: "Never fully exclude providers (0.3 floor), gradual adjustment"
    impact: "Poor providers still contribute but with reduced influence"
  - id: ttl-values
    choice: "7 days (PR scope), 30 days (repo scope)"
    rationale: "PR scope short-lived, repo scope allows longer learning period"
    impact: "Patterns expire automatically without manual cleanup"

metrics:
  tests: 29
  coverage: suppression (13 tests), provider-weights (16 tests)
  loc: 360 (implementation) + 540 (tests)
---

# Phase 04 Plan 04: Suppression Tracker and Provider Weights Summary

**One-liner:** Feedback-based learning with dismissal suppression (PR/repo scoped) and provider weight adjustment (0.3-1.0 range) using TDD methodology.

## What Was Built

Implemented two learning mechanisms for improving suggestion quality based on user feedback:

### 1. Suppression Tracker
Tracks dismissed suggestions and suppresses similar findings to reduce noise:

- **PR-scoped suppression**: Only affects suggestions in the same PR (7-day TTL)
- **Repo-scoped suppression**: Affects all PRs in the repository (30-day TTL)
- **Similarity detection**: Matches category + file + line proximity (within 5 lines)
- **Automatic expiry**: Patterns expire based on TTL

### 2. Provider Weight Tracker
Adjusts provider weights based on user feedback (thumbs up/down):

- **Weight formula**: `weight = 0.3 + (0.7 * positiveRate)`
- **Range**: 0.3 (0% positive) to 1.0 (100% positive)
- **Threshold**: Requires 5+ feedback records before adjusting from default 1.0
- **Minimum weight**: 0.3 floor ensures providers never fully excluded

## Technical Approach

**TDD Methodology:**
1. **RED**: Created 29 failing tests for both trackers
2. **GREEN**: Implemented classes to pass all tests
3. **REFACTOR**: Enhanced JSDoc, extracted helpers, improved clarity

**Key Design Decisions:**

1. **Scope flexibility**: Support both PR-scoped (temporary) and repo-scoped (persistent) suppression
2. **Simple heuristics**: File + category + line proximity matching (no complex NLP)
3. **Gradual adjustment**: Weight floor of 0.3 prevents complete provider exclusion
4. **Minimum feedback threshold**: Requires 5 feedbacks before weight adjustment to avoid premature penalties

## Files Changed

**Created:**
- `src/learning/suppression-tracker.ts` - Dismissal tracking and pattern matching (188 LOC)
- `src/learning/provider-weights.ts` - Feedback-based weight adjustment (172 LOC)
- `__tests__/learning/suppression-tracker.test.ts` - 13 comprehensive tests (270 LOC)
- `__tests__/learning/provider-weights.test.ts` - 16 comprehensive tests (270 LOC)

## Testing

**Test Coverage:**

**Suppression Tracker (13 tests):**
- Recording dismissals (PR/repo scoped, TTL verification)
- Suppression matching (exact/near/boundary cases)
- Scope enforcement (PR isolation, repo-wide)
- Expiry handling (clearExpired functionality)

**Provider Weights (16 tests):**
- Feedback recording (positive/negative/accumulation)
- Weight calculation (formula verification across all percentages)
- Threshold behavior (default 1.0 until 5+ feedbacks)
- Boundary testing (0% to 100% positive rates)

**Result:** All 29 tests passing

## Integration Points

**Inputs:**
- User feedback events (thumbs up/down reactions)
- Dismissal events (when users dismiss suggestions)
- Finding metadata (category, file, line, provider)

**Outputs:**
- Suppression decisions (boolean: should suppress?)
- Provider weights (0.3-1.0 range for confidence calculation)

**Storage:**
- Uses existing `CacheStorage` with JSON serialization
- Suppression patterns: `suppression-{repoKey}.json`
- Provider weights: `provider-weights.json`

## Decisions Made

### 1. Suppression Scope Design
**Decision:** Support both PR-scoped and repo-scoped suppression

**Rationale:** PR scope handles temporary noise in specific PRs, while repo scope learns persistent patterns across all PRs. Different use cases require different scopes.

**Impact:** Flexibility for both short-term (PR) and long-term (repo) learning

### 2. Similarity Heuristic
**Decision:** Use simple file+category+line-proximity matching (within 5 lines)

**Context:** Could have used semantic similarity (embeddings, AST comparison) but chose simple heuristics

**Rationale:**
- Fast matching (no API calls or complex parsing)
- Good enough for most cases (same category + file + nearby line)
- Per CONTEXT.md: Claude's discretion on similarity detection

**Trade-offs:**
- May miss semantically similar suggestions in different locations
- May suppress legitimate suggestions if categories are too broad
- Simple to understand and debug

**Impact:** Fast, predictable suppression matching without external dependencies

### 3. Provider Weight Formula
**Decision:** `weight = 0.3 + (0.7 * positiveRate)` with 5-feedback threshold

**Rationale:**
- 0.3 floor ensures no provider is completely excluded (always contributes)
- Linear formula (simple, predictable)
- 5-feedback threshold prevents premature penalties from small samples
- 0.7 variable weight allows significant adjustment range (0.3-1.0)

**Impact:** Gradual weight adjustment that penalizes poor performers but never excludes them entirely

### 4. Time-To-Live Values
**Decision:** 7 days (PR scope), 30 days (repo scope)

**Rationale:**
- PR scope: Short TTL matches typical PR lifecycle
- Repo scope: Longer TTL allows sustained learning across multiple PRs
- Automatic expiry prevents stale patterns from accumulating

**Impact:** Patterns expire naturally without manual maintenance

## Deviations from Plan

None - plan executed exactly as written.

## Next Phase Readiness

**Blockers:** None

**Dependencies for 04-05 (Quality Metrics):**
- ✅ Provider weights available via `getWeight(provider)`
- ✅ Suppression patterns available via `shouldSuppress(finding, prNumber)`

**Integration Notes:**
1. Plan 04-05 will integrate provider weights into confidence calculation
2. Suppression tracker should be called before posting suggestions
3. Feedback tracker (existing) will need hooks to call these new trackers

**Known Limitations:**
1. Similarity detection is basic (no semantic understanding)
2. Weight adjustment is global per provider (not category-specific)
3. No cross-repo learning (each repo has isolated patterns)

## Lessons Learned

**TDD Effectiveness:**
- Writing tests first clarified interfaces and edge cases
- 29 tests provided excellent confidence in refactoring
- Test coverage caught several edge cases (expired patterns, scope isolation)

**Design Clarity:**
- Simple formulas (0.3 + 0.7*rate) easier to reason about than complex curves
- Explicit TTLs better than implicit "old data" thresholds
- Helper methods (getCacheKey) improved testability

**Performance Considerations:**
- In-memory pattern matching scales well for typical suppression pattern counts
- JSON serialization adequate for current cache sizes
- May need optimization if pattern counts grow large

---

**Commits:**
- fe21d19: test(04-04): add failing tests for suppression tracker and provider weights
- 646e6ad: feat(04-04): implement suppression tracker and provider weights
- de6225e: refactor(04-04): improve JSDoc and extract cache key helper

**Duration:** 3 minutes
**Status:** Complete ✓
