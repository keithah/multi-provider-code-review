# Phase 2: LLM Fix Generation Integration - Context

**Gathered:** 2026-02-04
**Status:** Ready for planning

<domain>
## Phase Boundary

Extend the LLM analysis pipeline to generate code fixes during the review pass and extract them into the Finding.suggestion field. This phase delivers end-to-end fix generation: prompts ask LLMs for fixes, parsers extract them, and the pipeline gracefully handles cases where fixes aren't available.

Multi-line support, syntax validation, and consensus algorithms are separate phases.

</domain>

<decisions>
## Implementation Decisions

### Prompt Design for Fix Generation
- Only generate fixes for fixable issue types (allowlist approach) - not every finding
- Add fix generation instructions to system message (applies to all requests without per-message overhead)
- Include example JSON structure showing Finding with suggestion field
- Uniform prompts across all providers (no provider-specific tuning)

### Suggestion Extraction and Parsing
- LLMs return suggestions via structured JSON field ("suggestion": "fixed code here")
- Strict validation - reject invalid or malformed suggestions entirely
- Basic relevance check: verify suggestion touches the problem area (line numbers, referenced symbols)
- Provider-agnostic parser works for all providers (assumes consistent format)

### Fallback and Degradation Strategy
- When suggestion is invalid/missing: post finding without suggestion (user still sees the issue)
- No retries - single attempt per finding (optimize for speed and cost)
- Sanity checks only: block obvious red flags (deletes >10 lines, changes unrelated code) but trust LLM otherwise
- Claude's Discretion: logging/metrics approach for skipped suggestions

### Token Management Approach
- Character-based estimation for token counting (chars / 4 heuristic)
- Code context is primary: always include full code snippet, truncate conversation/metadata first
- Tiered approach for provider limits: small/medium/large buckets rather than per-provider or common denominator
- When code snippet too large: skip suggestion for that finding (better than truncated context)

</decisions>

<specifics>
## Specific Ideas

- Fix generation only for "fixable" types - requires defining what qualifies (style violations, simple logic errors, etc.)
- Sanity checks should catch obvious mistakes without deep validation (Phase 4 handles that)
- Basic relevance check means: does the suggested code touch the lines/symbols mentioned in the finding?

</specifics>

<deferred>
## Deferred Ideas

None - discussion stayed within phase scope

</deferred>

---

*Phase: 02-llm-fix-generation-integration*
*Context gathered: 2026-02-04*
