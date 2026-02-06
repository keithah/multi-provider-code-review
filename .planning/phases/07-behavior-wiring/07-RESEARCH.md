# Phase 7: Behavior Wiring - Research

**Researched:** 2026-02-06
**Domain:** Runtime behavior wiring, prompt engineering, consensus filtering, severity thresholds
**Confidence:** HIGH

## Summary

Phase 7 wires intensity levels (thorough/standard/light) from Phase 6 into three runtime behaviors: prompt generation, consensus filtering, and severity filtering. The codebase already has all necessary infrastructure - `PromptBuilder` accepts intensity, `ConsensusEngine` uses configurable thresholds, and `ReviewOrchestrator` determines intensity per file. This phase completes the feature by making intensity actually control review execution rather than just logging decisions.

**Current state:** Configuration schema validated (Phase 6), path matching works, intensity propagates to orchestrator. PromptBuilder already accepts intensity parameter but doesn't vary instructions. ConsensusEngine uses fixed thresholds from config. FindingFilter applies severity cutoffs but not intensity-aware.

**Primary recommendation:** Use switch statements with exhaustiveness checking for prompt variations, wire intensity-based consensus thresholds through ConsensusEngine constructor, and apply severity filtering in orchestrator before posting comments. All changes are localized to three files with no architectural refactoring needed.

## Standard Stack

This phase uses existing TypeScript patterns and libraries already in the codebase. No new dependencies required.

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| TypeScript | 4.x+ | Type-safe literal types and exhaustiveness checking | Native language feature, enforces completeness |
| Existing codebase | - | PromptBuilder, ConsensusEngine, ReviewOrchestrator | Already built, just needs wiring |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| Zod | (existing) | Runtime schema validation | Already validates config at startup |
| Logger | (existing) | Debug logging for intensity decisions | Already logs path matching results |

**Installation:** No new packages needed. All infrastructure exists.

## Architecture Patterns

### Recommended Project Structure
```
src/analysis/llm/
├── prompt-builder.ts    # Add prompt variation logic (switch statement)
src/analysis/
├── consensus.ts         # Already accepts configurable thresholds
src/core/
├── orchestrator.ts      # Wire intensity into consensus + severity
```

### Pattern 1: Exhaustive Switch for Prompt Variations
**What:** Use TypeScript switch statement with literal types to vary prompt instructions by intensity
**When to use:** When multiple discrete behaviors need to map to enum/union types
**Example:**
```typescript
// In PromptBuilder.build() method
private getInstructionsByIntensity(): string[] {
  switch (this.intensity) {
    case 'thorough':
      return this.getThoroughInstructions();
    case 'standard':
      return this.getStandardInstructions();
    case 'light':
      return this.getLightInstructions();
    default:
      // Exhaustiveness check - TypeScript error if new intensity added
      const _exhaustive: never = this.intensity;
      throw new Error(`Unhandled intensity: ${_exhaustive}`);
  }
}
```

**Source:** TypeScript's discriminated unions and narrowing provide compile-time safety for literal types. The `never` type in the default case creates an exhaustiveness check that catches incomplete switch statements at compile time if new values are added to the ReviewIntensity union ([TypeScript Documentation - Narrowing](https://www.typescriptlang.org/docs/handbook/2/narrowing.html)).

### Pattern 2: Configuration-Driven Thresholds
**What:** Pass intensity-specific thresholds to ConsensusEngine at construction time
**When to use:** When behavior needs to vary based on runtime configuration
**Example:**
```typescript
// In ReviewOrchestrator.executeReview()
const consensusThreshold = config.intensityConsensusThresholds?.[reviewIntensity] ?? 60;
const severityFilter = config.intensitySeverityFilters?.[reviewIntensity] ?? 'minor';

// Convert percentage (0-100) to provider count
const minAgreement = Math.ceil((consensusThreshold / 100) * providers.length);

const consensus = new ConsensusEngine({
  minAgreement,
  minSeverity: severityFilter,
  maxComments: config.inlineMaxComments,
});
```

**Rationale:** ConsensusEngine already accepts these parameters. The pattern separates configuration (what thresholds) from behavior (how to apply them). Percentage-to-count conversion happens at orchestration layer where provider count is known.

### Pattern 3: Severity Filtering Before Posting
**What:** Filter findings by minimum severity before converting to inline comments
**When to use:** When output selection depends on runtime context (intensity)
**Example:**
```typescript
// In ReviewOrchestrator.executeReview(), after consensus filtering
const severityThreshold = config.intensitySeverityFilters?.[reviewIntensity] ?? 'minor';
const severityFiltered = this.filterBySeverity(consensus, severityThreshold);

// Convert to inline comments (existing code continues)
review = this.components.synthesis.synthesize(severityFiltered, ...);
```

**Rationale:** Severity filtering happens after consensus (which already checks minSeverity internally) but before synthesis. This allows consensus to see all findings for agreement calculations while final output respects intensity-specific severity thresholds.

### Anti-Patterns to Avoid
- **Don't mutate PromptBuilder instructions globally:** Current prompt is built per-batch with explicit intensity parameter. Keep this pattern - don't inject intensity at constructor time.
- **Don't convert percentages in config validation:** Validation layer should validate percentages (0-100). Conversion to provider counts happens in orchestrator where provider count is known.
- **Don't add logging overhead in hot paths:** Intensity decision logging already happens at path matching. Additional per-batch logging adds noise.

## Don't Hand-Roll

Problems that look simple but have existing solutions:

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Prompt instruction templates | String concatenation with conditions | Switch statement with methods | Type-safe, compile-time exhaustiveness checking |
| Percentage to count conversion | Custom rounding logic | Math.ceil((pct / 100) * total) | Standard formula, handles edge cases (0 providers → 0 agreement) |
| Severity enum ordering | Array.includes() checks | SEVERITY_ORDER mapping (existing) | Already defined, used by ConsensusEngine sorting |
| Config validation | Runtime type checks | Existing validators.ts functions | Already handles typos, clamping, error messages |

**Key insight:** The codebase already has robust patterns for all three behaviors. Wiring just means connecting existing pieces with intensity-aware parameters.

## Common Pitfalls

### Pitfall 1: Forgetting Exhaustiveness Check
**What goes wrong:** Adding new intensity value but not updating all switch statements
**Why it happens:** TypeScript doesn't enforce completeness without explicit checks
**How to avoid:** Always include default case with `never` type assertion:
```typescript
default:
  const _exhaustive: never = this.intensity;
  throw new Error(`Unhandled intensity: ${_exhaustive}`);
```
**Warning signs:** Compiler error "Type 'X' is not assignable to type 'never'" means you forgot a case

### Pitfall 2: Provider Count = 0 Edge Case
**What goes wrong:** Division by zero when converting percentage thresholds with no providers
**Why it happens:** Health checks might fail leaving 0 healthy providers
**How to avoid:** Check provider count before consensus:
```typescript
if (providers.length === 0) {
  logger.warn('No providers available, skipping consensus filtering');
  // Use findings without consensus
}
const minAgreement = Math.max(1, Math.ceil((threshold / 100) * providers.length));
```
**Warning signs:** NaN or Infinity in consensus threshold calculations

### Pitfall 3: Applying Severity Filter Twice
**What goes wrong:** ConsensusEngine already filters by minSeverity, applying again removes findings incorrectly
**Why it happens:** Confusion about where severity filtering happens
**How to avoid:** Understand the two-stage filtering:
  1. ConsensusEngine filters by minSeverity during consensus (ensures agreement calculations see correct pool)
  2. Additional severity filtering only needed if intensity threshold differs from consensus minSeverity

**Correct approach:** Use same threshold for both or only filter post-consensus if thresholds differ.

### Pitfall 4: Implicit Intensity Variations Too Subtle
**What goes wrong:** Providers see identical prompts for different intensities, defeating the purpose
**Why it happens:** Instruction differences too minor (e.g., adding one sentence)
**How to avoid:** Make variations explicit and measurable:
  - **Thorough:** Add context sections, request comprehensive analysis, include edge cases
  - **Light:** Remove suggestion generation, abbreviate examples, focus on critical issues only
  - **Standard:** Current behavior (baseline)

**Warning signs:** Test reviews show no token count difference between intensities

## Code Examples

Verified patterns from codebase analysis:

### Prompt Variation (PromptBuilder)
```typescript
// Source: src/analysis/llm/prompt-builder.ts (existing structure)
async build(pr: PRContext, prNumber?: number): Promise<string> {
  const instructions = this.getInstructionsByIntensity();

  instructions.push(
    `PR #${pr.number}: ${pr.title}`,
    // ... existing file list and diff injection
  );

  return instructions.join('\n');
}

private getInstructionsByIntensity(): string[] {
  switch (this.intensity) {
    case 'thorough':
      return [
        'You are a code reviewer performing COMPREHENSIVE analysis.',
        'Report ALL issues: bugs, security vulnerabilities, AND potential problems.',
        '',
        'THOROUGH MODE RULES:',
        '1. Check for edge cases and boundary conditions',
        '2. Report issues even if they might not crash immediately',
        '3. Include detailed reasoning and context in findings',
        '4. Suggest fixes with complete context and error handling',
        '',
        // ... rest of thorough instructions
      ];

    case 'light':
      return [
        'You are a code reviewer performing QUICK scan.',
        'ONLY report CRITICAL issues: crashes, data loss, security vulnerabilities.',
        '',
        'LIGHT MODE RULES (STRICT):',
        '1. Skip style, performance, or architectural concerns',
        '2. Skip validation/error handling unless WILL crash',
        '3. Brief findings only - no lengthy explanations',
        '4. Skip suggestions - flag issues only',
        '',
        // ... rest of light instructions
      ];

    case 'standard':
      // Current behavior (lines 114-137 in existing code)
      return [
        'You are a code reviewer. ONLY report actual bugs...',
        // ... existing standard instructions
      ];

    default:
      const _exhaustive: never = this.intensity;
      throw new Error(`Unhandled intensity: ${_exhaustive}`);
  }
}
```

### Consensus Threshold Wiring (ReviewOrchestrator)
```typescript
// Source: src/core/orchestrator.ts (lines 289-295 show intensity detection)
async executeReview(pr: PRContext): Promise<Review> {
  // ... existing intensity detection (lines 224-286)

  // NEW: Convert percentage thresholds to provider counts
  const consensusThreshold = config.intensityConsensusThresholds?.[reviewIntensity] ?? 60;
  const severityFilter = config.intensitySeverityFilters?.[reviewIntensity] ?? 'minor';

  // Convert percentage (0-100) to provider count
  // Math.ceil ensures we round up (80% of 3 providers = 3 agreement, not 2.4)
  const minAgreement = providers.length > 0
    ? Math.ceil((consensusThreshold / 100) * providers.length)
    : 1; // Fallback if no providers

  logger.debug(
    `Consensus threshold: ${consensusThreshold}% of ${providers.length} providers = ${minAgreement} required agreement`
  );

  // ... existing deduplication (line 574)
  const deduped = this.components.deduplicator.dedupe(combinedFindings);

  // MODIFIED: Pass intensity-aware thresholds
  const consensus = new ConsensusEngine({
    minAgreement,
    minSeverity: severityFilter,
    maxComments: config.inlineMaxComments,
  });
  const filtered = consensus.filter(deduped);

  // ... rest of review continues
}
```

### Severity Ordering (Already Exists)
```typescript
// Source: src/analysis/consensus.ts (lines 17-21)
const SEVERITY_ORDER: Record<Severity, number> = {
  critical: 3,
  major: 2,
  minor: 1,
};

// Usage in filtering
private meetsSeverity(severity: Severity): boolean {
  return SEVERITY_ORDER[severity] >= SEVERITY_ORDER[this.options.minSeverity];
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Global config for all files | Path-based intensity detection | Phase 6 (v1.0) | Different files get different review depths |
| Fixed consensus thresholds | Configurable per-intensity | Phase 7 (this phase) | Thorough reviews require stronger agreement |
| Single prompt template | Intensity-aware prompt variations | Phase 7 (this phase) | Providers adapt analysis depth to file importance |

**Deprecated/outdated:**
- Fixed `inlineMinSeverity` config (now per-intensity via `intensitySeverityFilters`)
- Fixed `inlineMinAgreement` config (now percentage-based per-intensity via `intensityConsensusThresholds`)

**Important:** The old config fields still work as defaults/fallbacks for backward compatibility.

## Open Questions

Things that couldn't be fully resolved:

1. **Should 'standard' match current behavior exactly?**
   - What we know: Current prompts are already working, changing them risks regression
   - What's unclear: Whether subtle refinements would improve results
   - Recommendation: Start with exact match, A/B test refinements later

2. **How to handle intensity when batch contains mixed intensity files?**
   - What we know: Current batching doesn't consider intensity (line 469-494 in orchestrator)
   - What's unclear: Whether to split batches by intensity or use highest intensity
   - Recommendation: Use highest intensity in batch (conservative approach). Document for future optimization.

3. **Should severity filtering be configurable beyond intensity presets?**
   - What we know: Config already has `intensitySeverityFilters` per-intensity
   - What's unclear: Whether users want per-file-pattern severity overrides
   - Recommendation: Not needed for v1.0. Current per-intensity filtering is sufficient.

## Sources

### Primary (HIGH confidence)
- Codebase analysis: src/analysis/llm/prompt-builder.ts (existing intensity parameter, prompt structure)
- Codebase analysis: src/analysis/consensus.ts (ConsensusEngine constructor, severity filtering)
- Codebase analysis: src/core/orchestrator.ts (intensity detection, provider selection)
- Codebase analysis: src/config/defaults.ts (default intensity mappings, threshold values)
- Codebase analysis: src/config/validators.ts (percentage clamping, severity validation)
- TypeScript Official Documentation: [Narrowing](https://www.typescriptlang.org/docs/handbook/2/narrowing.html) - Exhaustiveness checking with never type

### Secondary (MEDIUM confidence)
- [How to Handle Type Narrowing in TypeScript](https://oneuptime.com/blog/post/2026-01-24-typescript-type-narrowing/view) - Recent guide on type narrowing patterns
- [Improve your switch cases with TypeScript](https://typescript.tv/best-practices/improve-your-switch-cases-with-typescript/) - Best practices for switch statements

### Tertiary (LOW confidence)
- None - All findings verified against existing codebase

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - No new dependencies, uses existing TypeScript patterns
- Architecture: HIGH - All three components already exist, just need parameter wiring
- Pitfalls: HIGH - Identified through codebase analysis and TypeScript type system behavior

**Research date:** 2026-02-06
**Valid until:** 90 days (stable - phase just wires existing infrastructure, no moving targets)

## Implementation Strategy Summary

**Three-file change:**
1. **PromptBuilder** (src/analysis/llm/prompt-builder.ts): Add `getInstructionsByIntensity()` method with switch statement
2. **ReviewOrchestrator** (src/core/orchestrator.ts): Convert percentage thresholds to counts, pass to ConsensusEngine
3. **No changes needed** to ConsensusEngine (already accepts configurable parameters)

**Testing strategy:**
- Unit tests: Verify prompt variations produce different token counts
- Unit tests: Verify percentage-to-count conversion handles edge cases
- Integration tests: Verify different intensities produce different review behavior (finding counts)

**Rollout approach:**
- Feature already gated by `pathBasedIntensity` config flag (default: false)
- Can enable per-repository for gradual rollout
- Defaults ensure backward compatibility (standard intensity uses current behavior)
