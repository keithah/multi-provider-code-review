# Research Summary: Path-Based Intensity Wiring

**Project:** multi-provider-code-review v1.0 milestone
**Domain:** Configuration-to-behavior wiring for existing code analysis system
**Researched:** 2026-02-05
**Confidence:** HIGH

## Executive Summary

This milestone wires path-based intensity configuration (already detecting intensity from file paths via PathMatcher) into execution behavior (provider count, timeouts, prompt depth). The system is 95% complete — PathMatcher detects intensity, orchestrator uses it for provider selection and timeouts, and per-batch PromptBuilder instances are created with intensity parameters. The remaining work is removing a legacy hardcoded PromptBuilder in setup.ts and implementing prompt depth variation based on intensity.

The recommended approach uses direct lookup tables (Record<ReviewIntensity, T>) already present throughout the codebase. This is a wiring milestone, not an architecture milestone. No new libraries or design patterns needed. The orchestrator already implements runtime parameter passing for intensity-based decisions (lines 289-290, 477), which is the correct pattern for per-request behavior variation.

**Key risks:** The primary risks are configuration-based (overlapping pattern precedence, silent fallback on errors, performance degradation from complex patterns). All major risks are addressed by existing PathMatcher validation (complexity scoring, path traversal checks, character allowlists). The verification focus should be on ensuring setup.ts's hardcoded PromptBuilder is actually unused (hypothesis: orchestrator creates fresh instances per-batch), then implementing prompt depth variation for the three intensity levels.

## Key Findings

### Recommended Stack

**No new dependencies required.** System already has everything needed via TypeScript 5.x + Zod 3.x + native Record<K, V> lookups.

**Core technologies:**
- **TypeScript 5.x:** Type-safe config-to-behavior mapping with compile-time exhaustiveness checking for ReviewIntensity string literal types
- **Zod 3.x:** Runtime schema validation for intensity configs (intensityProviderCounts, intensityTimeouts, intensityPromptDepth) — already validates at config load time
- **Native Record<K, V>:** Zero-overhead O(1) lookups for intensity mappings — no library needed, TypeScript standard library

**Why no Strategy Pattern:** Research examined Strategy Pattern classes but concluded they're over-engineering for this use case. Current config lookup pattern (intensity → mapped values → execution) is 3 lines per behavior vs 100+ lines for class-based strategies. No polymorphic behavior selection needed — just passing different numbers to existing functions.

**What NOT to use:**
- Configuration management libraries (node-config, convict) — 107KB+ bundle size for functionality already built
- Dependency injection frameworks — adds complexity for static read-only config
- Conditional chains (if/else) — verbose, no exhaustiveness checking, hard to maintain

### Expected Features

**Must have (table stakes):**
- **Provider count mapping per intensity** — Core resource allocation: thorough=8, standard=5, light=3
- **Timeout mapping per intensity** — Time budget control: thorough=180s, standard=90s, light=30s
- **Prompt depth mapping per intensity** — Quality vs speed tradeoff: thorough=detailed, standard=balanced, light=quick
- **Validate intensity affects behavior** — Prove configuration actually changes execution (not just logging)
- **Integration test with patterns** — Real-world validation: src/core/** → thorough, docs/** → light

**Should have (defer to post-v1.0):**
- Consensus threshold by intensity — Lower agreement bar for non-critical code
- Path-based severity filtering — Adjust min severity by path importance
- Batch size by intensity — More files per batch for light reviews
- Incremental cache TTL by path — Longer cache for stable/documented code
- AST depth by intensity — Full graph for thorough, syntax-only for light
- Learning-informed tuning — Use feedback to optimize mappings
- Cost-aware provider allocation — Balance intensity with budget constraints

**Defer (v2+):**
- Dynamic intensity adjustment — Escalate on finding high-severity issues (breaks caching)
- Multi-provider intensity optimization — Machine learning for optimal allocation
- Path-based analytics — Track cost/quality by directory
- Intensity override via PR labels — Manual escalation for high-risk changes

### Architecture Approach

The system uses **constructor injection + runtime parameter passing** - configuration flows from setup.ts → components → orchestrator → runtime decisions, with intensity determined per-request and passed as parameter to behavior points. This is already the established pattern in orchestrator.ts lines 224-295.

**Major components:**

1. **PathMatcher (src/analysis/path-matcher.ts)** — Detects intensity from file paths using minimatch patterns. Status: ✅ Complete with 30 comprehensive tests. Implements security validation (complexity scoring, path traversal prevention, character allowlists).

2. **ReviewOrchestrator (src/core/orchestrator.ts)** — Coordinates review execution. Calls PathMatcher.determineIntensity(), applies intensity mappings from config (intensityProviderLimit, intensityTimeout), creates per-batch PromptBuilder with intensity parameter. Status: ✅ 90% complete — provider/timeout wiring done, PromptBuilder creation correct (line 473).

3. **PromptBuilder (src/analysis/llm/prompt-builder.ts)** — Generates prompts for LLM providers. Constructor accepts intensity parameter (line 14). Status: ⚠️ Accepts intensity but doesn't vary prompt structure based on it. Needs depth-based instruction variation.

4. **LLMExecutor** — Executes provider calls with timeout. Status: ✅ Complete — respects intensityTimeout parameter (orchestrator line 477).

5. **Config Schema (src/config/schema.ts, src/types/index.ts)** — Defines intensity mappings. Status: ✅ Complete — intensityProviderCounts, intensityTimeouts, intensityPromptDepth all validated by Zod at load time.

**Data flow:** Config load → PathMatcher validates patterns → Orchestrator determines intensity per-request → Lookup config mappings → Pass parameters to execution points. No shared mutable state, no race conditions.

### Critical Pitfalls

1. **Overlapping pattern precedence ambiguity** — Multiple patterns match same file (e.g., `**/*.test.ts` light + `src/auth/**` thorough both match `src/auth/login.test.ts`). **Prevention:** Document explicit precedence rules (highest intensity wins or last-match-wins), add validation warning on overlap, test overlap scenarios. **Phase:** Config validation (already has complexity scoring, add overlap detection).

2. **Silent fallback hides configuration errors** — Invalid pattern silently ignored, system uses default behavior, security risks undetected. **Prevention:** Fail fast at config load time (PathMatcher already throws on validation errors), ensure orchestrator doesn't catch and suppress. **Phase:** Verify error handling in orchestrator.

3. **Performance degradation from complex patterns** — Nested quantifiers cause exponential matching time (e.g., `src/{a,b,c}/**/{x,y,z}/**/*.{ts,tsx,js,jsx}`). **Prevention:** PathMatcher already implements complexity scoring (MAX_COMPLEXITY_SCORE=50), rejects patterns above threshold. **Phase:** Already implemented, needs testing at scale.

4. **Shared mutable PromptBuilder anti-pattern** — Creating one PromptBuilder in setup.ts and mutating intensity per-batch causes race conditions. **Prevention:** Orchestrator already creates fresh PromptBuilder per-batch (line 473). **Action:** Remove unused shared instance from setup.ts.

5. **Test file pattern over-exclusion** — Overly broad patterns (e.g., `**/*test*`) inadvertently exclude critical test infrastructure. **Prevention:** Use specific patterns (`**/*.test.{ts,js}`), provide dry-run testing tool, document which files match. **Phase:** Testing and documentation (post-v1.0).

## Implications for Roadmap

Based on research, the work is minimal because infrastructure already exists. Suggested phase structure:

### Phase 1: Verify Setup.ts PromptBuilder Usage
**Rationale:** Need to confirm hypothesis that setup.ts PromptBuilder (lines 121, 253) is unused before removing it. Orchestrator creates per-batch instances at runtime (line 473), suggesting shared instance is legacy code from before per-batch pattern.

**Delivers:** Confirmation that removing hardcoded 'standard' intensity from setup.ts won't break functionality.

**Addresses:** Pitfall #4 (shared mutable PromptBuilder) — verify not actually shared.

**Action:** Code inspection + test suite run to verify PromptBuilder in ReviewComponents is unused.

### Phase 2: Implement Prompt Depth Variation
**Rationale:** PromptBuilder constructor accepts intensity but doesn't vary prompt structure. This is the only missing behavior wiring.

**Delivers:** Different prompt instructions based on intensity level:
- **'detailed' (thorough):** All context, examples, call graphs, defensive patterns
- **'standard':** Current behavior (conditional context based on graph/diff size)
- **'brief' (light):** Minimal instructions, skip optional context

**Implements:** Feature requirement "Prompt depth mapping per intensity" from FEATURES.md MVP section.

**Uses:** Existing prompt building methods (getCallContext, getDefensivePatterns) — just vary which ones are included.

**Estimated effort:** ~30 lines in prompt-builder.ts (extract buildInstructions method, add switch on depth).

### Phase 3: Remove Setup.ts Hardcoded PromptBuilder
**Rationale:** Once confirmed unused (Phase 1), remove legacy shared instance to prevent future confusion.

**Delivers:** Clean component composition — orchestrator creates PromptBuilder per-batch with runtime intensity, no misleading hardcoded instance.

**Changes:**
- Remove lines 121, 253 from setup.ts (2 lines)
- Remove promptBuilder from ReviewComponents interface (1 line)
- Update any tests that reference shared instance

**Risk:** Low — orchestrator already creates fresh instances.

### Phase 4: Integration Testing & Validation
**Rationale:** Prove intensity affects behavior (provider count, timeout, prompt depth) end-to-end.

**Delivers:**
- Integration test: thorough path → 8 providers, 180s timeout, detailed prompt
- Integration test: light path → 3 providers, 60s timeout, brief prompt
- Integration test: standard default → 5 providers, 120s timeout, standard prompt

**Validates:** Features from FEATURES.md MVP section — provider count mapping, timeout mapping, prompt depth mapping.

**Test scenarios:**
1. Match `src/core/**` with thorough patterns → verify 8 providers selected
2. Match `docs/**` with light patterns → verify brief prompt generated
3. Match unmatched file → verify fallback to pathDefaultIntensity

### Phase Ordering Rationale

- **Phase 1 before Phase 3:** Must verify shared PromptBuilder is unused before removing it
- **Phase 2 independent:** Prompt depth variation can be implemented in parallel with Phase 1
- **Phase 4 last:** Integration tests verify all phases working together

**Why this order avoids pitfalls:**
- Confirms no shared mutable state (Pitfall #4) before making changes
- Validates behavior changes prove configuration works (Pitfall #2 prevention)
- Tests at scale catch performance issues (Pitfall #3)

### Research Flags

**No phases need deeper research.** This is wiring existing infrastructure, not building new architecture.

**Standard patterns (skip research-phase):**
- **All phases:** Configuration-to-behavior mapping is well-understood pattern. TypeScript Record<K, V> lookups are standard library. No niche domain knowledge required.

**Why high confidence:**
- Direct code inspection shows orchestrator already implements 90% of wiring
- PathMatcher already has comprehensive tests (30 scenarios)
- Config schema already validated by Zod
- No new libraries or patterns needed

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| Stack | HIGH | No new dependencies. TypeScript + Zod already in use. Direct code inspection confirms patterns. |
| Features | HIGH | MVP features (provider count, timeout, prompt depth) are table stakes from industry research (ESLint, CircleCI patterns). Defer list is explicitly v2+. |
| Architecture | HIGH | Orchestrator pattern already implemented (lines 224-295). Runtime parameter passing is correct approach. No shared mutable state. |
| Pitfalls | HIGH | PathMatcher already implements major validations (complexity scoring, path traversal checks). Overlap detection is enhancement, not blocker. |

**Overall confidence:** HIGH

This is a wiring milestone with minimal changes (~80 lines total). Infrastructure exists, patterns established, risks mitigated.

### Gaps to Address

**Hypothesis to validate (Phase 1):**
- Is setup.ts PromptBuilder ever used for actual reviews? Orchestrator creates per-batch instances (line 473), suggesting shared instance is unused legacy code.
- **Validation method:** Run test suite with shared PromptBuilder commented out. If tests pass, confirms unused.

**Open questions:**
- Should overlapping patterns use "highest intensity wins" or "last match wins" precedence? ESLint uses last-match-wins, but highest-intensity might be more intuitive for security-critical paths.
- **Resolution:** Document chosen behavior explicitly, add config validation warning for overlaps, let users decide by pattern order.

**Future considerations (post-v1.0):**
- How to handle provider count > discovery limit? (e.g., thorough=8 but only 6 providers discovered)
- **Answer:** Discovery limit is upper bound. Need validation warning in config load.

## Sources

### Primary (HIGH confidence)
- **Codebase analysis** — Direct inspection of src/core/orchestrator.ts (lines 224-295, 469-495), src/analysis/llm/prompt-builder.ts, src/analysis/path-matcher.ts, src/setup.ts, src/types/index.ts
- **PathMatcher implementation** — Validates complexity scoring (MAX_COMPLEXITY_SCORE=50), path traversal prevention, character allowlists, security options (nonegate: true, nocomment: true in minimatch)
- **Config schema** — types/index.ts lines 106-120 define intensity mappings, config/schema.ts lines 88-102 validate with Zod

### Secondary (MEDIUM confidence)
- [ESLint Configuration Files](https://eslint.org/docs/latest/use/configure/configuration-files-deprecated) — Override patterns and precedence (last-match-wins standard)
- [CircleCI Path Filtering](https://circleci.com/developer/orbs/orb/circleci/path-filtering) — Resource allocation by path (small/medium/large/xlarge classes)
- [GitHub Actions dorny/paths-filter](https://github.com/dorny/paths-filter) — Path-based job execution patterns
- [Google SRE Configuration Design](https://sre.google/workbook/configuration-design/) — "Reduce mandatory questions by providing default answers that apply safely"

### Tertiary (LOW confidence - general context)
- [Strategy Pattern - Refactoring Guru](https://refactoring.guru/design-patterns/strategy/typescript/example) — Examined but concluded over-engineered for this use case
- [Martin Fowler - Dependency Injection](https://martinfowler.com/articles/injection.html) — Constructor injection patterns

---

**Research completed:** 2026-02-05

**Ready for roadmap:** Yes

**Key recommendation:** Start with Phase 1 (verify setup.ts usage), then implement Phase 2 (prompt depth variation) — these are the only changes needed. Phases 3-4 are cleanup and validation. Total estimated effort: ~80 lines of code changes.

**Critical insight:** This milestone is 95% complete. The architecture exists, patterns established, validations implemented. The work is finishing the wiring, not building new infrastructure.
