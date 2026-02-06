# Requirements: Path-Based Intensity Wiring

**Project:** Multi-Provider Code Review
**Milestone:** v1.0 Path-Based Intensity
**Defined:** 2026-02-05
**Core Value:** Smart resource allocation - spend more analysis budget on critical code, less on documentation

## v1 Requirements

Complete the path-based intensity feature by wiring detected intensity levels into review behavior controls.

### Prompt Depth Control

- [ ] **PROMPT-01**: PromptBuilder generates different instruction detail levels based on intensity
- [ ] **PROMPT-02**: Thorough intensity uses detailed instructions (full context, comprehensive analysis)
- [ ] **PROMPT-03**: Standard intensity uses current instruction set (balanced approach)
- [ ] **PROMPT-04**: Light intensity uses brief instructions (quick scan, obvious issues only)
- [ ] **PROMPT-05**: Prompt depth variation affects all providers uniformly

### Consensus Control

- [ ] **CONSENSUS-01**: Consensus threshold varies by intensity level
- [ ] **CONSENSUS-02**: Thorough intensity requires high agreement (e.g., 80% of providers)
- [ ] **CONSENSUS-03**: Standard intensity requires moderate agreement (e.g., 60% of providers)
- [ ] **CONSENSUS-04**: Light intensity requires low agreement (e.g., 40% of providers)
- [ ] **CONSENSUS-05**: Threshold configuration is validated at startup

### Severity Filtering

- [ ] **SEVERITY-01**: Minimum inline severity threshold varies by intensity
- [ ] **SEVERITY-02**: Thorough intensity shows all severities (info and above)
- [ ] **SEVERITY-03**: Standard intensity filters low-priority issues (minor and above)
- [ ] **SEVERITY-04**: Light intensity shows only important issues (major and above)
- [ ] **SEVERITY-05**: Severity filtering applies before comment posting

### Code Cleanup

- [ ] **CLEANUP-01**: Remove hardcoded PromptBuilder from setup.ts (line 121)
- [ ] **CLEANUP-02**: Remove PromptBuilder from ReviewComponents interface if unused
- [ ] **CLEANUP-03**: Verify orchestrator creates per-batch PromptBuilder correctly
- [ ] **CLEANUP-04**: Update tests to reflect cleanup changes

### Configuration & Validation

- [x] **CONFIG-01**: Intensity behavior mappings are configurable via ReviewConfig
- [x] **CONFIG-02**: Invalid intensity mappings fail fast at startup (not silently)
- [x] **CONFIG-03**: Path pattern precedence rules are documented clearly
- [x] **CONFIG-04**: Common intensity patterns provided as examples (critical paths, tests, docs)
- [x] **CONFIG-05**: Validation ensures consensus thresholds are percentages (0-100)
- [x] **CONFIG-06**: Validation ensures severity values are valid enum values

### Integration Testing

- [ ] **TEST-01**: End-to-end test proves thorough intensity uses 8 providers, long timeout, detailed prompts
- [ ] **TEST-02**: End-to-end test proves light intensity uses 3 providers, short timeout, brief prompts
- [ ] **TEST-03**: Test proves intensity affects consensus threshold
- [ ] **TEST-04**: Test proves intensity affects severity filtering
- [ ] **TEST-05**: Test with overlapping path patterns validates precedence
- [ ] **TEST-06**: Test with no matching patterns validates default fallback
- [ ] **TEST-07**: Performance test with 1000+ files validates PathMatcher caching

## v2 Requirements

Deferred enhancements for future milestones:

### Advanced Control
- **Batch size by intensity** - Adjust token-aware batch sizes
- **Cache TTL by intensity** - Cache stable code paths longer
- **AST depth by intensity** - Integrate with graphMaxDepth control

### Learning Integration
- **Learning-informed tuning** - Use feedback data to adjust intensity mappings
- **Cost-aware allocation** - Respect budget constraints per intensity
- **Dynamic escalation** - Increase intensity when high-severity findings detected

### Analytics
- **Path-based cost tracking** - Monitor spend per directory
- **Quality metrics by path** - Track fix correctness per intensity level

## Out of Scope

Explicitly excluded from this milestone:

| Feature | Reason |
|---------|--------|
| Custom intensity levels | Three levels (thorough/standard/light) are sufficient for v1 |
| Per-provider intensity | Too complex - intensity should affect all providers uniformly |
| Runtime intensity changes | Intensity determined at review start, not mid-execution |
| Path pattern negation | Existing PathMatcher doesn't support `!pattern` syntax |
| Regex path patterns | Glob patterns are sufficient, regex adds complexity |

## Traceability

Which phases cover which requirements. Updated during roadmap creation.

| Requirement | Phase | Status |
|-------------|-------|--------|
| PROMPT-01 | Phase 7 | Pending |
| PROMPT-02 | Phase 7 | Pending |
| PROMPT-03 | Phase 7 | Pending |
| PROMPT-04 | Phase 7 | Pending |
| PROMPT-05 | Phase 7 | Pending |
| CONSENSUS-01 | Phase 7 | Pending |
| CONSENSUS-02 | Phase 7 | Pending |
| CONSENSUS-03 | Phase 7 | Pending |
| CONSENSUS-04 | Phase 7 | Pending |
| CONSENSUS-05 | Phase 7 | Pending |
| SEVERITY-01 | Phase 7 | Pending |
| SEVERITY-02 | Phase 7 | Pending |
| SEVERITY-03 | Phase 7 | Pending |
| SEVERITY-04 | Phase 7 | Pending |
| SEVERITY-05 | Phase 7 | Pending |
| CLEANUP-01 | Phase 8 | Pending |
| CLEANUP-02 | Phase 8 | Pending |
| CLEANUP-03 | Phase 8 | Pending |
| CLEANUP-04 | Phase 8 | Pending |
| CONFIG-01 | Phase 6 | Pending |
| CONFIG-02 | Phase 6 | Pending |
| CONFIG-03 | Phase 6 | Pending |
| CONFIG-04 | Phase 6 | Pending |
| CONFIG-05 | Phase 6 | Pending |
| CONFIG-06 | Phase 6 | Pending |
| TEST-01 | Phase 9 | Pending |
| TEST-02 | Phase 9 | Pending |
| TEST-03 | Phase 9 | Pending |
| TEST-04 | Phase 9 | Pending |
| TEST-05 | Phase 9 | Pending |
| TEST-06 | Phase 9 | Pending |
| TEST-07 | Phase 9 | Pending |

**Coverage:**
- v1 requirements: 32 total
- Mapped to phases: 32 (100% coverage)
- Unmapped: 0 ✓

---
*Requirements defined: 2026-02-05*
*Last updated: 2026-02-05 after roadmap creation*
