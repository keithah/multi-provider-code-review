---
phase: 04-validation-and-quality
plan: 08
subsystem: learning
tags: [acceptance-tracking, feedback, provider-weights, learning, tdd, github-commits, reactions]
completed: 2026-02-05
duration: 4min
type: tdd

dependencies:
  requires:
    - phase: 04-04
      provides: provider-weights, suppression-tracker
  provides:
    - acceptance-detector
    - commit-based-acceptance-tracking
    - reaction-based-acceptance-tracking
  affects:
    - feedback-integration (future)
    - github-webhook-handlers (future)

tech-stack:
  added: []
  patterns:
    - dual-source-acceptance-tracking
    - github-commit-pattern-matching
    - positive-feedback-loop

key-files:
  created:
    - src/learning/acceptance-detector.ts
    - __tests__/learning/acceptance-detector.test.ts
  modified:
    - src/learning/index.ts

decisions:
  - id: dual-acceptance-sources
    choice: "Track both commit-based and reaction-based acceptances"
    rationale: "GitHub's 'Commit suggestion' creates commits with patterns, thumbs-up reactions indicate approval"
    impact: "Comprehensive acceptance tracking from multiple signals"
  - id: commit-patterns
    choice: "Use regex patterns for 'Apply suggestions' detection"
    rationale: "GitHub uses consistent commit message format for suggestion commits"
    impact: "Reliable detection without API calls"
  - id: unknown-provider-handling
    choice: "Use 'unknown' fallback for missing provider attribution"
    rationale: "Graceful degradation when provider metadata unavailable"
    impact: "Acceptances still tracked even without full metadata"

metrics:
  tests: 20
  coverage: commits (9 tests), reactions (6 tests), recording (5 tests)
  loc: 185 (implementation) + 405 (tests)
---

# Phase 04 Plan 08: Acceptance Detector Summary

**Dual-source acceptance tracking via GitHub commit patterns and thumbs-up reactions, feeding positive feedback to provider weights with TDD methodology**

## Performance

- **Duration:** 4 min
- **Started:** 2026-02-05T07:45:21Z
- **Completed:** 2026-02-05T07:49:04Z
- **Tasks:** 1 TDD task (3 commits: test/feat/refactor)
- **Files modified:** 3

## Accomplishments

- Detection of accepted suggestions from GitHub's "Commit suggestion" feature
- Detection of accepted suggestions from thumbs-up reactions
- Positive feedback recording to ProviderWeightTracker
- 20 comprehensive tests covering all acceptance scenarios
- Complete TDD cycle (RED-GREEN-REFACTOR)

## Task Commits

TDD task produced 3 atomic commits:

1. **RED: Write failing tests** - `50a8b65` (test)
2. **GREEN: Implement acceptance detector** - `d0c2365` (feat)
3. **REFACTOR: Enhance JSDoc and extract helper** - `1475d2e` (refactor)
4. **Export from learning module** - `7803241` (feat)

## Files Created/Modified

**Created:**
- `src/learning/acceptance-detector.ts` - AcceptanceDetector class with dual-source acceptance tracking
- `__tests__/learning/acceptance-detector.test.ts` - 20 comprehensive test cases

**Modified:**
- `src/learning/index.ts` - Added exports for AcceptanceDetector, ProviderWeightTracker, and SuppressionTracker

## What Was Built

### AcceptanceDetector Class

Tracks suggestion acceptances from two sources:

**1. Commit-based acceptance (detectFromCommits)**
- Matches GitHub's commit message patterns:
  - "Apply suggestions from code review"
  - "Apply suggestion from code review" (singular)
  - "Apply N suggestions"
  - "Apply suggestions from @username"
- Cross-references commit files with suggestion comments
- Case-insensitive pattern matching
- Handles batch commits (multiple files/suggestions)

**2. Reaction-based acceptance (detectFromReactions)**
- Detects thumbs-up (👍 / +1) reactions on suggestion comments
- Maps reactions to file/line/provider metadata
- Handles multiple reactions on same comment

**3. Feedback recording (recordAcceptances)**
- Reports acceptances as positive feedback (👍) to ProviderWeightTracker
- Skips unknown providers (no provider attribution)
- Allows same provider to receive multiple feedbacks (duplicate acceptances)

### Interfaces

- `SuggestionAcceptance` - Detected acceptance event with file/line/provider/source
- `CommitInfo` - PR commit metadata (sha, message, files, timestamp)
- `CommentReaction` - Comment with reactions and metadata

## Technical Approach

**TDD Methodology:**
1. **RED Phase:** Created 20 failing tests covering all scenarios
2. **GREEN Phase:** Implemented minimal code to pass tests
3. **REFACTOR Phase:** Enhanced JSDoc, extracted `isSuggestionCommit` helper, improved clarity

**Key Design Decisions:**

1. **Dual-source tracking:** Both commits and reactions count as acceptances for comprehensive coverage
2. **Pattern-based detection:** Regex matching of GitHub's commit message format (no API calls needed)
3. **Graceful degradation:** Uses "unknown" provider when attribution missing
4. **Direct feedback integration:** Calls `weightTracker.recordFeedback()` directly with 👍

## Testing

**Test Coverage (20 tests):**

**Commit Detection (9 tests):**
- Various commit message patterns (plural/singular, batch, @username)
- Regular commits excluded
- File matching (with/without comments)
- Multiple files in one commit
- Missing provider handling
- Case-insensitivity

**Reaction Detection (6 tests):**
- Thumbs-up detection
- No positive reaction (ignored)
- Multiple comments
- No reactions (ignored)
- Missing provider handling
- Multiple reactions on same comment

**Recording (5 tests):**
- Multiple providers recorded
- Unknown providers skipped
- Missing providers skipped
- Empty array handling
- Duplicate providers recorded separately

**Result:** All 20 tests passing

## Integration Points

**Inputs:**
- PR commits (from GitHub API)
- Comment metadata (file/line/provider mapping)
- Comment reactions (from GitHub API)

**Outputs:**
- SuggestionAcceptance events
- Positive feedback to ProviderWeightTracker (👍)

**Future Integration:**
- Will be called from github/feedback.ts (feedback collection orchestration)
- Complements dismissal tracking from Plan 04-04
- Feeds into confidence calculation (Plan 04-03 provider weights)

## Decisions Made

### 1. Dual Acceptance Sources
**Decision:** Track both commit-based and reaction-based acceptances

**Context:** GitHub provides two signals for acceptance:
1. "Commit suggestion" button creates commits with specific patterns
2. Thumbs-up reactions indicate approval

**Rationale:** Commits are explicit acceptance (user applied the change), reactions are implicit approval (user likes the suggestion). Both are valuable signals for provider weight adjustment.

**Impact:** More comprehensive acceptance tracking, better provider weight accuracy

### 2. Commit Pattern Detection
**Decision:** Use regex patterns to match GitHub's commit message format

**Patterns:**
- `/Apply suggestions? from code review/i`
- `/Apply suggestions? from @[\w-]+/i`
- `/Apply \d+ suggestions?/i`

**Rationale:** GitHub uses consistent commit message format when users click "Commit suggestion". Regex matching is fast, reliable, and doesn't require additional API calls.

**Trade-offs:**
- Pros: Fast, no API quota consumption, works offline
- Cons: Brittle if GitHub changes message format (unlikely)

**Impact:** Reliable detection without external dependencies

### 3. Unknown Provider Handling
**Decision:** Use "unknown" fallback for missing provider attribution

**Rationale:** Provider attribution might be missing if:
- Comment predates provider tracking feature
- Manual comments without tool attribution
- Metadata parsing failed

Graceful degradation ensures acceptances are still tracked even without full metadata.

**Impact:** More robust, doesn't drop acceptance events due to missing metadata

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None - TDD cycle proceeded smoothly with no blocking issues.

## Next Phase Readiness

**Blockers:** None

**Ready for Integration:**
- ✅ AcceptanceDetector exported from learning module
- ✅ Compatible with ProviderWeightTracker interface
- ✅ Comprehensive test coverage

**Integration Notes:**
1. github/feedback.ts should orchestrate acceptance detection by:
   - Fetching PR commits
   - Building file/line/provider map from posted comments
   - Calling detectFromCommits() and detectFromReactions()
   - Calling recordAcceptances() with weight tracker
2. Should be called periodically or on webhook events (PR updated, reactions added)
3. Complements dismissal tracking from Plan 04-04

**Known Limitations:**
1. Commit detection relies on GitHub's message format (may break if format changes)
2. No cross-PR learning (acceptances only tracked within same PR)
3. Provider attribution required for feedback recording (unknown providers skipped)

## Lessons Learned

**TDD Benefits:**
- Writing tests first clarified edge cases (multiple files, missing providers, case-insensitivity)
- 20 tests provided confidence during refactoring
- Test-driven interface design produced clean, testable API

**Pattern Matching:**
- GitHub's commit message format is remarkably consistent
- Case-insensitive matching catches user-modified messages
- Three patterns cover all GitHub suggestion commit variants

**Integration Design:**
- Keeping detection separate from recording allows flexible orchestration
- Direct dependency on ProviderWeightTracker creates clear data flow
- Interfaces designed for easy mocking in tests

---

**Commits:**
- 50a8b65: test(04-08): add failing tests for acceptance detector
- d0c2365: feat(04-08): implement acceptance detector
- 1475d2e: refactor(04-08): enhance JSDoc and extract helper method
- 7803241: feat(04-08): export acceptance detector from learning module

**Duration:** 4 minutes
**Status:** Complete ✓
