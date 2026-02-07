# Phase 8: Code Cleanup - Context

**Gathered:** 2026-02-06
**Status:** Ready for planning

<domain>
## Phase Boundary

Remove the legacy hardcoded PromptBuilder instance from setup.ts (lines 121, 253) now that the orchestrator creates per-batch instances with runtime intensity (Phase 7 change). This phase removes dead code and updates related documentation.

</domain>

<decisions>
## Implementation Decisions

### Verification approach
- **Git history check required** — Use git blame/log to confirm setup.ts PromptBuilder hasn't been modified recently (validates it's stale)
- **Investigation-first strategy** — Investigate to prove unused rather than adding deprecation warnings
- **Unexpected usage handling** — If PromptBuilder IS found to be used unexpectedly: refactor the caller to use per-batch PromptBuilder pattern, then proceed with cleanup (don't fail the phase)
- **Post-removal verification** — Run full test suite after removing PromptBuilder to confirm no regressions

### Documentation impact
- **Search for references first** — Research should check docs/ for any PromptBuilder architecture documentation
- **Update inline comments** — Revise setup.ts comments to reflect that PromptBuilder is now created per-batch by orchestrator
- **Documentation fix strategy** — Claude decides appropriate fix (update vs remove) based on what documentation is found
- **CHANGELOG entry** — Claude decides whether CHANGELOG entry is warranted based on external API impact

### Migration safety
- **Unsure if unused** — Don't assume setup.ts PromptBuilder is dead code; investigation must confirm
- **No deprecation warning** — Skip deprecation cycle; use verification to prove unused, then remove directly
- **ReviewComponents interface** — Claude decides whether to remove PromptBuilder from interface based on investigation results

### Claude's Discretion
- Specific verification method (test assertions, static analysis, etc.)
- Whether to run targeted tests vs full suite during investigation
- How to handle ReviewComponents interface cleanup
- Whether documentation fix should update or remove references

</decisions>

<specifics>
## Specific Ideas

- **Target code:** setup.ts lines 121, 253 (hardcoded PromptBuilder instance)
- **Hypothesis from Phase 7 research:** PromptBuilder likely unused because orchestrator creates per-batch instances
- **Test coverage:** Full test suite must pass after removal
- **Comment style:** Update comments to explain new per-batch pattern rather than deleting them

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 08-code-cleanup*
*Context gathered: 2026-02-06*
