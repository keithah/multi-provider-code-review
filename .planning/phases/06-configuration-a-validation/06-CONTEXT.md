# Phase 6: Configuration & Validation - Context

**Gathered:** 2026-02-05
**Status:** Ready for planning

<domain>
## Phase Boundary

Make intensity behavior mappings (prompt depth, consensus thresholds, severity filters) configurable through ReviewConfig and validate them at startup. This phase establishes the configuration schema and validation infrastructure that Phase 7 will use to wire behaviors.

</domain>

<decisions>
## Implementation Decisions

### Configuration schema design
- **Documentation approach**: Both JSDoc comments (for IDE tooltips) and separate example config files
- **Structure, typing, and location**: Claude's discretion — choose based on existing codebase patterns

### Validation error handling
- **Invalid consensus percentages**: Clamp to valid 0-100% range with warning logged, continue running
- **Invalid severity enums**: Strict validation with typo suggestions (e.g., 'majr' → did you mean 'major'?)
- **Error messages**: User-friendly messages explaining what's wrong and how to fix it
- **Validation timing**: Claude's discretion — choose timing that best prevents errors

### Claude's Discretion
- Configuration schema structure (nested, flat, behavior-first)
- Type safety approach (TS interfaces, Zod, or both)
- Config location (top-level, within pathPatterns, or global defaults + overrides)
- Validation timing (startup, startup + reload, or lazy)

</decisions>

<specifics>
## Specific Ideas

No specific requirements — open to standard approaches that fit the codebase patterns.

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope.

</deferred>

---

*Phase: 06-configuration-a-validation*
*Context gathered: 2026-02-05*
