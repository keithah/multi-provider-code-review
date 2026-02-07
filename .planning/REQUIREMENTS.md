# Requirements: Path-Based Intensity Wiring

**Project:** Multi-Provider Code Review
**Milestone:** v1.0 Path-Based Intensity
**Defined:** 2026-02-05
**Core Value:** Smart resource allocation - spend more analysis budget on critical code, less on documentation

## v1 Requirements

Complete the path-based intensity feature by wiring detected intensity levels into review behavior controls.

### Prompt Depth Control

- [x] **PROMPT-01**: PromptBuilder generates different instruction detail levels based on intensity
- [x] **PROMPT-02**: Thorough intensity uses detailed instructions (full context, comprehensive analysis)
- [x] **PROMPT-03**: Standard intensity uses current instruction set (balanced approach)
- [x] **PROMPT-04**: Light intensity uses brief instructions (quick scan, obvious issues only)
- [x] **PROMPT-05**: Prompt depth variation affects all providers uniformly

### Consensus Control

- [x] **CONSENSUS-01**: Consensus threshold varies by intensity level
- [x] **CONSENSUS-02**: Thorough intensity requires high agreement (e.g., 80% of providers)
- [x] **CONSENSUS-03**: Standard intensity requires moderate agreement (e.g., 60% of providers)
- [x] **CONSENSUS-04**: Light intensity requires low agreement (e.g., 40% of providers)
- [x] **CONSENSUS-05**: Threshold configuration is validated at startup

### Severity Filtering

- [x] **SEVERITY-01**: Minimum inline severity threshold varies by intensity
- [x] **SEVERITY-02**: Thorough intensity shows all severities (info and above)
- [x] **SEVERITY-03**: Standard intensity filters low-priority issues (minor and above)
- [x] **SEVERITY-04**: Light intensity shows only important issues (major and above)
- [x] **SEVERITY-05**: Severity filtering applies before comment posting

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

- [x] **TEST-01**: End-to-end test proves thorough intensity uses 8 providers, long timeout, detailed prompts
- [x] **TEST-02**: End-to-end test proves light intensity uses 3 providers, short timeout, brief prompts
- [x] **TEST-03**: Test proves intensity affects consensus threshold
- [x] **TEST-04**: Test proves intensity affects severity filtering
- [x] **TEST-05**: Test with overlapping path patterns validates precedence
- [x] **TEST-06**: Test with no matching patterns validates default fallback
- [x] **TEST-07**: Performance test with 1000+ files validates PathMatcher caching

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
| PROMPT-01 | Phase 7 | Complete |
| PROMPT-02 | Phase 7 | Complete |
| PROMPT-03 | Phase 7 | Complete |
| PROMPT-04 | Phase 7 | Complete |
| PROMPT-05 | Phase 7 | Complete |
| CONSENSUS-01 | Phase 7 | Complete |
| CONSENSUS-02 | Phase 7 | Complete |
| CONSENSUS-03 | Phase 7 | Complete |
| CONSENSUS-04 | Phase 7 | Complete |
| CONSENSUS-05 | Phase 7 | Complete |
| SEVERITY-01 | Phase 7 | Complete |
| SEVERITY-02 | Phase 7 | Complete |
| SEVERITY-03 | Phase 7 | Complete |
| SEVERITY-04 | Phase 7 | Complete |
| SEVERITY-05 | Phase 7 | Complete |
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
| TEST-01 | Phase 9 | Complete |
| TEST-02 | Phase 9 | Complete |
| TEST-03 | Phase 9 | Complete |
| TEST-04 | Phase 9 | Complete |
| TEST-05 | Phase 9 | Complete |
| TEST-06 | Phase 9 | Complete |
| TEST-07 | Phase 9 | Complete |

**Coverage:**
- v1 requirements: 32 total
- Mapped to phases: 32 (100% coverage)
- Unmapped: 0 ✓

---
*Requirements defined: 2026-02-05*
*Last updated: 2026-02-05 after roadmap creation*
