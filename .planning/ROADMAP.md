# Roadmap: Multi-Provider Code Review

## Milestones

- ✅ **v0.5 MVP** - Phases 1-5 (shipped 2026-02-05)
- 🚧 **v1.0 Path-Based Intensity** - Phases 6-9 (in progress)

## Phases

<details>
<summary>✅ v0.5 MVP (Phases 1-5) - SHIPPED 2026-02-05</summary>

Delivered one-click commit suggestion functionality for multi-provider AI code review with intelligent quality validation and bi-directional learning. System learns from thumbs-up acceptances and thumbs-down dismissals to improve provider weighting over time.

</details>

### 🚧 v1.0 Path-Based Intensity (In Progress)

**Milestone Goal:** Complete path-based intensity feature by wiring file path patterns into review behavior controls (provider selection, timeouts, prompt depth, consensus thresholds, severity filtering).

#### Phase 6: Configuration & Validation

**Goal**: Intensity behavior mappings are configurable and validated at startup
**Depends on**: Phase 5 (v0.5 shipped)
**Requirements**: CONFIG-01, CONFIG-02, CONFIG-03, CONFIG-04, CONFIG-05, CONFIG-06
**Success Criteria** (what must be TRUE):
  1. Intensity mappings (prompt depth, consensus thresholds, severity filters) load from ReviewConfig without error
  2. Invalid intensity configurations fail fast at startup with clear error messages
  3. Configuration validation catches invalid consensus percentages and severity enum values
  4. Path pattern precedence rules are documented and examples provided
**Plans**: 3 plans

Plans:
- [x] 06-01-PLAN.md — Extend schema, types, defaults with consensus/severity intensity mappings
- [x] 06-02-PLAN.md — TDD validation helpers (clamp percentages, typo suggestions)
- [x] 06-03-PLAN.md — Integrate validators into ConfigLoader, create examples and docs

#### Phase 7: Behavior Wiring

**Goal**: Intensity levels control prompt depth, consensus thresholds, and severity filtering
**Depends on**: Phase 6
**Requirements**: PROMPT-01, PROMPT-02, PROMPT-03, PROMPT-04, PROMPT-05, CONSENSUS-01, CONSENSUS-02, CONSENSUS-03, CONSENSUS-04, CONSENSUS-05, SEVERITY-01, SEVERITY-02, SEVERITY-03, SEVERITY-04, SEVERITY-05
**Success Criteria** (what must be TRUE):
  1. PromptBuilder generates detailed instructions for thorough intensity (full context, comprehensive analysis)
  2. PromptBuilder generates balanced instructions for standard intensity (current behavior)
  3. PromptBuilder generates brief instructions for light intensity (quick scan, obvious issues only)
  4. Consensus filtering requires different agreement levels per intensity (thorough: 80%, standard: 60%, light: 40%)
  5. Severity filtering adjusts minimum inline threshold per intensity (thorough: minor+, standard: minor+, light: major+)
**Plans**: 2 plans

Plans:
- [x] 07-01-PLAN.md — TDD prompt variations (thorough/standard/light instructions)
- [x] 07-02-PLAN.md — TDD consensus thresholds and severity filtering in orchestrator

#### Phase 8: Code Cleanup

**Goal**: Legacy hardcoded PromptBuilder removed from setup.ts
**Depends on**: Phase 7
**Requirements**: CLEANUP-01, CLEANUP-02, CLEANUP-03, CLEANUP-04
**Success Criteria** (what must be TRUE):
  1. Hardcoded PromptBuilder instance removed from setup.ts (lines 121, 253)
  2. PromptBuilder removed from ReviewComponents interface if unused
  3. All tests pass without shared PromptBuilder instance
  4. Orchestrator continues creating per-batch PromptBuilder with runtime intensity
**Plans**: 1 plan

Plans:
- [x] 08-01-PLAN.md — Remove PromptBuilder from setup.ts and ReviewComponents interface

#### Phase 9: Integration Testing

**Goal**: Intensity affects review execution end-to-end with validated behavior
**Depends on**: Phase 8
**Requirements**: TEST-01, TEST-02, TEST-03, TEST-04, TEST-05, TEST-06, TEST-07
**Success Criteria** (what must be TRUE):
  1. Integration test proves thorough intensity uses 8 providers, long timeout, and detailed prompts
  2. Integration test proves light intensity uses 3 providers, short timeout, and brief prompts
  3. Test validates consensus thresholds vary by intensity
  4. Test validates severity filtering varies by intensity
  5. Overlapping path patterns are tested with documented precedence
  6. Files with no matching patterns use default fallback intensity
  7. Performance test with large file sets validates PathMatcher caching efficiency
**Plans**: TBD

Plans:
- [ ] 09-01: TBD

## Progress

**Execution Order:**
Phases execute in numeric order: 6 → 7 → 8 → 9

| Phase | Milestone | Plans Complete | Status | Completed |
|-------|-----------|----------------|--------|-----------|
| 6. Configuration & Validation | v1.0 | 3/3 | ✓ Complete | 2026-02-05 |
| 7. Behavior Wiring | v1.0 | 2/2 | ✓ Complete | 2026-02-06 |
| 8. Code Cleanup | v1.0 | 1/1 | ✓ Complete | 2026-02-07 |
| 9. Integration Testing | v1.0 | 0/? | Not started | - |
