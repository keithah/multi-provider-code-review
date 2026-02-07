# Phase 9: Integration Testing - Context

**Gathered:** 2026-02-07
**Status:** Ready for planning

<domain>
## Phase Boundary

End-to-end validation that path-based intensity controls behavior across the review pipeline. Tests must prove that intensity settings (thorough/standard/light) correctly affect provider selection, timeouts, prompt generation, consensus thresholds, and severity filtering. Performance validation ensures PathMatcher caching is efficient with large file sets.

</domain>

<decisions>
## Implementation Decisions

### Test Structure
- Use real provider code with test mode (providers run but return canned responses - validates full provider integration)

### Claude's Discretion
- Test file organization (single comprehensive vs separate per intensity vs grouped by concern)
- Config approach (real YAML files vs programmatic objects vs mix)
- Verification strategy (mock inspection vs output analysis vs hybrid)
- Performance benchmarking approach and thresholds

</decisions>

<specifics>
## Specific Ideas

**Success criteria from roadmap (must all be verified):**
1. Integration test proves thorough intensity uses 8 providers, long timeout, and detailed prompts
2. Integration test proves light intensity uses 3 providers, short timeout, and brief prompts
3. Test validates consensus thresholds vary by intensity
4. Test validates severity filtering varies by intensity
5. Overlapping path patterns are tested with documented precedence
6. Files with no matching patterns use default fallback intensity
7. Performance test with large file sets validates PathMatcher caching efficiency

**Testing philosophy:**
- Focus on end-to-end behavior validation (not just unit coverage)
- Use real provider code to catch integration issues
- Validate the full chain: config → path matching → intensity resolution → behavior changes

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 09-integration-testing*
*Context gathered: 2026-02-07*
