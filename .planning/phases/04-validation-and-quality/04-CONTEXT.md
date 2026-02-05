# Phase 4: Validation and Quality - Context

**Gathered:** 2026-02-04
**Status:** Ready for planning

<domain>
## Phase Boundary

Add syntax validation, multi-provider consensus, and learning feedback to improve fix reliability. This phase builds quality gates on top of working suggestions (Phases 1-3), deciding when a suggestion is trustworthy enough to show developers.

</domain>

<decisions>
## Implementation Decisions

### Syntax Validation Scope
- Apply to ALL suggestions, regardless of severity
- Reject suggestions silently on validation failure (post finding without suggestion block)
- Support ALL languages using tree-sitter (TypeScript, JavaScript, Python, Go, etc.)
- Validate syntax + basic semantics (undefined variables, type mismatches if parser supports)

### Consensus Mechanics
- Configurable by severity: Critical requires consensus, high/medium/low optional
- Consensus threshold: 2 out of N providers must agree
- Agreement definition: AST equivalence (parse both suggestions, compare syntax trees)
- When no consensus: No suggestion posted (issue reported without fix)

### Quality Thresholds
- Configurable confidence threshold (user controls via config)
- Default threshold: 0.7 (70%)
- Confidence calculation: Hybrid approach (LLM confidence if available, fall back to validation signals)
- Log all quality metrics (confidence, validation results, consensus data) for analytics

### Feedback Integration
- Track both accepts (committed) and dismissals (thumbs-down reactions)
- On dismissal: Suppress similar suggestions in same PR/repo
- Learning mechanisms: Both provider weight adjustment AND prompt context enrichment
- Pattern updates feed back into LLM prompts with learned preferences

### Claude's Discretion
- How thumbs-down reactions are tracked (per-instance vs aggregated patterns)
- Exact implementation of AST comparison algorithm
- Validation signal weighting formula for confidence calculation
- Similarity detection for suppression matching

</decisions>

<specifics>
## Specific Ideas

- Confidence threshold configurable via `min_confidence` config field (default: 0.7)
- Severity-based consensus rules: critical=required, others=optional
- "Similar suggestions" suppression should catch functionally equivalent fixes
- Quality metrics integration with existing analytics system

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 04-validation-and-quality*
*Context gathered: 2026-02-04*
