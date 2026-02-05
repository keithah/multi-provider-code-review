---
phase: 04
plan: 03
type: tdd
subsystem: validation
tags: [confidence, scoring, thresholds, consensus, quality-gates]

requires:
  - 04-01  # Syntax validator provides syntaxValid signal
  - 04-02  # AST comparator provides hasConsensus signal

provides:
  - calculateConfidence: Hybrid confidence scoring (LLM + validation signals)
  - shouldPostSuggestion: Quality gate using thresholds and consensus rules
  - ConfidenceSignals: Interface for confidence input signals
  - QualityConfig: Configuration for thresholds and consensus requirements

affects:
  - Comment poster will use shouldPostSuggestion to filter low-confidence suggestions
  - Feedback tracker will use confidence scores for learning adjustments

tech-stack:
  added: []
  patterns:
    - Hybrid confidence scoring (LLM confidence + validation signals)
    - Two-path calculation (LLM available vs fallback)
    - Per-severity threshold configuration
    - Consensus requirement enforcement for critical findings

key-files:
  created:
    - src/validation/confidence-calculator.ts
    - __tests__/validation/confidence-calculator.test.ts
  modified: []

decisions:
  - Use multiplicative boosts for LLM path (1.1x syntax, 1.2x consensus)
  - Use additive bonuses for fallback path (+0.2 syntax, +0.2 consensus)
  - Cap all confidence scores at 1.0 to prevent over-confidence
  - Default threshold 0.7 balances precision and recall
  - Consensus requirement only enforced for critical severity
  - Provider reliability weights both LLM and fallback scores

metrics:
  duration: 3 minutes
  completed: 2026-02-05
---

# Phase 04 Plan 03: Confidence Calculator Summary

**TDD implementation of hybrid confidence scoring combining LLM confidence with validation signals**

## One-liner

Hybrid confidence calculator using LLM-reported confidence (when available) or fallback scoring (base + validation signals), with per-severity thresholds and consensus enforcement for critical findings.

## What Was Built

### Core Implementation

1. **calculateConfidence function**
   - Two-path confidence calculation:
     - **Path 1 (LLM available)**: Start with llmConfidence, apply syntax boost/penalty (1.1x/0.9x), consensus boost (1.2x), weight by provider reliability
     - **Path 2 (Fallback)**: Base 0.5 + syntax bonus (0.2) + consensus bonus (0.2), weight by provider reliability
   - All scores capped at 1.0
   - Handles edge cases: zero reliability, missing LLM confidence

2. **shouldPostSuggestion function**
   - Two-gate quality check:
     - **Gate 1**: Confidence meets severity-specific threshold (or global min_confidence default 0.7)
     - **Gate 2**: Consensus requirement satisfied for critical severity (providers.length >= min_agreement)
   - Both gates must pass for suggestion to be posted

3. **Interfaces and Constants**
   - `ConfidenceSignals`: Input signals (llmConfidence, syntaxValid, hasConsensus, providerReliability)
   - `QualityConfig`: Configuration (min_confidence, per-severity thresholds, consensus rules)
   - Named constants: `CONFIDENCE_MULTIPLIERS`, `FALLBACK_SCORING`, `DEFAULT_QUALITY_CONFIG`

### Test Coverage

Comprehensive test suite (23 tests) covering:
- LLM confidence with syntax/consensus boosts
- Syntax penalty for invalid code
- Fallback scoring without LLM confidence
- Provider reliability weighting
- Per-severity threshold overrides
- Consensus requirement enforcement
- Edge cases: confidence capping, zero reliability, threshold boundaries

## Deviations from Plan

None - plan executed exactly as written.

## Key Decisions Made

1. **Multiplicative vs Additive Approach**
   - **Decision**: Use multiplicative boosts for LLM path (1.1x, 1.2x), additive bonuses for fallback path (+0.2)
   - **Rationale**: LLM confidence has inherent meaning (0.8 = 80% confident), multipliers preserve that scale. Fallback lacks initial confidence, so additive approach builds score from base.
   - **Impact**: LLM path produces more nuanced scores (0.88, 0.95), fallback produces more discrete scores (0.5, 0.7, 0.9)

2. **Confidence Capping**
   - **Decision**: Cap all scores at 1.0 (Math.min)
   - **Rationale**: Prevents over-confidence from stacked boosts (0.8 × 1.1 × 1.2 = 1.056 would exceed maximum)
   - **Impact**: High LLM confidence + valid syntax + consensus reliably hits 1.0, signaling maximum trust

3. **Default Threshold 0.7**
   - **Decision**: Use 0.7 (70%) as default min_confidence
   - **Rationale**: Aligns with ML best practices for precision-recall balance; CONTEXT.md specified this default
   - **Impact**: Filters out low-confidence suggestions while retaining most valid suggestions

4. **Consensus Scope**
   - **Decision**: Only enforce consensus requirement for critical severity (not major/minor)
   - **Rationale**: Critical findings require higher confidence; major/minor can rely on single provider
   - **Impact**: Reduces false negatives for common issues while maintaining rigor for critical issues

5. **Named Constants Extraction**
   - **Decision**: Extract magic numbers (1.1, 0.9, 1.2, 0.5, 0.2) into named constants
   - **Rationale**: Makes scoring formula transparent, easier to tune in future
   - **Impact**: Self-documenting code; future adjustments (e.g., changing consensus boost from 1.2 to 1.15) are single-line changes

## Technical Insights

### Formula Design

The hybrid approach handles two common scenarios:

1. **Modern LLMs (Claude, Gemini)** that report confidence scores → Use LLM confidence as baseline, adjust with validation signals
2. **Legacy providers or filtered responses** without confidence → Build confidence from validation signals alone

This dual-path design ensures the system works with all providers while taking advantage of better data when available.

### Threshold Tuning

Per-severity thresholds enable different quality bars:
- **Critical**: Higher threshold (e.g., 0.8) + consensus required → Fewer false positives
- **Major**: Default threshold (0.7) → Balanced precision/recall
- **Minor**: Lower threshold (e.g., 0.6) → More suggestions, some false positives acceptable

Users can tune these thresholds based on their tolerance for false positives vs false negatives.

### Provider Reliability Integration

Multiplying by `providerReliability` (historical accuracy) weights confidence by provider track record:
- New provider with no history: reliability = 1.0 (no adjustment)
- Provider with 90% accuracy: reliability = 0.9 (10% confidence reduction)
- Provider with 50% accuracy: reliability = 0.5 (50% confidence reduction)

This creates a feedback loop where unreliable providers contribute less to overall confidence.

## Integration Points

### Upstream Dependencies

- **Syntax Validator (04-01)**: Provides `syntaxValid` signal for confidence calculation
- **AST Comparator (04-02)**: Provides `hasConsensus` signal when multiple providers agree
- **Provider Analytics**: Provides `providerReliability` from historical accuracy tracking

### Downstream Consumers

- **Comment Poster**: Will call `shouldPostSuggestion` before posting each suggestion
- **Feedback Tracker**: Will use confidence scores to adjust learning thresholds
- **Analytics System**: Will log confidence distribution for quality monitoring

## Testing Notes

All 23 tests pass, covering:
- Formula correctness (LLM path and fallback path)
- Constant usage (no magic numbers in production code)
- Edge cases (zero reliability, exact threshold match, missing providers array)
- Configuration handling (defaults, per-severity overrides, consensus requirements)

TDD cycle followed: RED (tests fail) → GREEN (tests pass) → REFACTOR (extract constants, improve docs).

## Next Phase Readiness

**Blockers**: None

**Recommendations**:
- Integrate `shouldPostSuggestion` into comment posting flow (use in place of direct threshold checks)
- Add telemetry to track confidence distribution in production (identify if thresholds need tuning)
- Consider exposing confidence scores in GitHub comments (users can see why suggestion passed/failed quality gates)

**Risks**:
- Threshold values (0.7, boost multipliers) are initial estimates; may need tuning based on feedback
- Consensus detection assumes providers.length represents actual agreement; need to ensure upstream sets this correctly

## Performance

- **Duration**: 3 minutes
- **TDD Cycles**: 3 (RED → GREEN → REFACTOR)
- **Commits**: 3 (test, feat, refactor)
- **Test Coverage**: 23 tests, 100% pass rate
- **Files Modified**: 2 created (confidence-calculator.ts, confidence-calculator.test.ts)

---

*Completed: 2026-02-05*
*Phase: 04-validation-and-quality*
*Plan: 04-03*
