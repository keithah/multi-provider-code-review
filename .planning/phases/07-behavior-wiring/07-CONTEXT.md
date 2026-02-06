# Phase 7: Behavior Wiring - Context

**Gathered:** 2026-02-05
**Status:** Ready for planning

<domain>
## Phase Boundary

Wire intensity levels (thorough/standard/light) into three runtime behaviors:
1. **Prompt generation** - PromptBuilder generates different instruction depth based on intensity
2. **Consensus filtering** - Apply different agreement thresholds (thorough: 80%, standard: 60%, light: 40%)
3. **Severity filtering** - Adjust minimum inline thresholds (thorough: info+, standard: minor+, light: major+)

Configuration exists (Phase 6). This phase makes intensity actually control review execution.

</domain>

<decisions>
## Implementation Decisions

### Claude's Discretion

The user has delegated all implementation decisions for this phase to Claude:

**Prompt instruction variations:**
- Determine appropriate detail level for 'thorough' intensity (comprehensive vs exhaustive)
- Determine appropriate scope for 'light' intensity (critical-only vs obvious issues vs fast pass)
- Decide whether to explicitly mention intensity level to providers or adjust instructions implicitly
- Decide whether 'standard' should match current behavior exactly or include refinements

**Consensus threshold application:**
- Decide when/where thresholds apply during review processing
- Determine how they affect issue inclusion in formatted output

**Severity filtering behavior:**
- Decide whether severity filtering is hard cutoff or has configurability
- Determine how severity filtering interacts with consensus thresholds

**Default fallback handling:**
- Determine default intensity when no pattern matches a file
- Decide whether to add warnings/logging for fallback cases

</decisions>

<specifics>
## Specific Ideas

No specific requirements — Claude has full flexibility to implement behavior wiring following GSD best practices and the existing codebase patterns.

**Constraints from requirements:**
- Must implement all 14 requirements: PROMPT-01 through PROMPT-05, CONSENSUS-01 through CONSENSUS-05, SEVERITY-01 through SEVERITY-05
- Success criteria define what must be TRUE (prompts vary by intensity, thresholds apply correctly, filtering works)
- Phase 6 already validated configuration schema - this phase wires it into runtime

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope. User focused on prompt variations and delegated all decisions to Claude.

</deferred>

---

*Phase: 07-behavior-wiring*
*Context gathered: 2026-02-05*
