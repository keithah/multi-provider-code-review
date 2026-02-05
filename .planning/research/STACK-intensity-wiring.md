# Stack Research: Path-Based Intensity Configuration Wiring

**Domain:** Configuration-to-behavior mapping for path-based review intensity control
**Researched:** 2026-02-05
**Confidence:** HIGH

## Executive Summary

This research examines patterns for wiring path-based configuration (already detecting intensity from file paths) into execution behavior (provider count, timeouts, prompt depth). The system already has PathMatcher detecting intensity and config schema defining behavior mappings—the task is connecting them with minimal overhead.

**Key Finding:** No new libraries needed. Use direct lookup table pattern (Record<ReviewIntensity, T>) already present in the codebase. This is a wiring milestone, not an architecture milestone.

## Recommended Approach: Direct Lookup Tables (Already In Use)

### Core Pattern

| Component | Current State | What to Wire |
|-----------|---------------|--------------|
| PathMatcher | ✅ Detects intensity from paths | Already complete |
| Config Schema | ✅ Defines intensity mappings | Already complete |
| Orchestrator | ✅ Reads intensity from config | Already complete |
| PromptBuilder | ⚠️ Hardcoded 'standard' in setup.ts | Wire dynamic intensity |
| LLMExecutor | ✅ Uses intensity timeout | Already complete |
| Provider Selection | ✅ Uses intensity provider count | Already complete |

**Pattern in use:**
```typescript
// Already implemented in types/index.ts
intensityProviderCounts?: {
  thorough: number;
  standard: number;
  light: number;
};

// Already used in orchestrator.ts line 289-290
const intensityProviderLimit = config.intensityProviderCounts?.[reviewIntensity] ?? config.providerLimit;
const intensityTimeout = config.intensityTimeouts?.[reviewIntensity] ?? (config.runTimeoutSeconds * 1000);
```

This is the TypeScript-idiomatic approach: type-safe Record<ReviewIntensity, T> with fallback to defaults using nullish coalescing (??).

## Why This Pattern Works

### 1. Type Safety
```typescript
type ReviewIntensity = 'thorough' | 'standard' | 'light';

// TypeScript enforces all intensity levels are mapped
intensityProviderCounts: {
  thorough: 8,
  standard: 5,
  light: 3,
}
```

Compiler error if you miss an intensity level. No runtime lookup failures.

### 2. Zero Runtime Overhead
- O(1) property access
- No library dependencies
- No reflection or dynamic dispatch
- Simple ?? fallback for missing config

### 3. Already Validated
- Zod schema validates config at load time (config/schema.ts:88-102)
- PathMatcher validates at construction time (path-matcher.ts:82-84)
- No runtime validation needed

### 4. Clear Defaults
```typescript
// defaults.ts defines sensible fallbacks
const DEFAULT_CONFIG = {
  intensityProviderCounts: {
    thorough: 8,
    standard: 5,
    light: 3,
  },
  // ... etc
};
```

Missing config? Use defaults. No complex fallback logic needed.

## Recommended Stack

### Core Technologies

| Technology | Version | Purpose | Why Recommended |
|------------|---------|---------|-----------------|
| TypeScript | 5.x | Type-safe config-to-behavior mapping | Compile-time checking prevents config errors. String literal types ('thorough' | 'standard' | 'light') enforce exhaustiveness. Already in use. **HIGH confidence** |
| Zod | 3.x | Runtime schema validation | Validates intensity configs at load time. Already validates intensityProviderCounts, intensityTimeouts, intensityPromptDepth in schema.ts. **HIGH confidence** — existing dependency |
| Native Record<K, V> | Built-in | Configuration lookup tables | Zero-overhead O(1) lookups. Type-safe keys. No library needed. **HIGH confidence** — TypeScript standard library |

### Supporting Libraries

**None needed.** All functionality uses existing TypeScript + Zod stack.

### Development Tools

| Tool | Purpose | Notes |
|------|---------|-------|
| TypeScript Compiler | Exhaustiveness checking | Use `noUncheckedIndexedAccess` to catch missing keys |
| Jest | Unit testing config wiring | Test intensity detection flows to behavior |

## What NOT to Use

| Avoid | Why | Use Instead |
|-------|-----|-------------|
| Strategy Pattern Classes | Over-engineering for simple config lookup. 100+ lines of boilerplate for 3 lookups. | Direct Record<ReviewIntensity, T> |
| Configuration Management Library (node-config, convict) | 107KB+ bundle size for functionality already built. Zod already provides schema validation. | Native TypeScript + Zod (current approach) |
| Dependency Injection Framework | Adds complexity, no benefit for static config. Config is read-only at runtime. | Direct parameter passing |
| Factory Pattern | Unnecessary abstraction layer. Creates indirection without benefit. | Direct construction with intensity parameter |
| Conditional chains (if/else if) | Verbose, no exhaustiveness checking, hard to maintain. | Lookup table with ?? fallback |

**Rationale:** This is config-to-behavior mapping, not polymorphic behavior selection. The behaviors (provider selection, timeout, prompt depth) are already implemented—we just need to pass the right numbers. A lookup table is the simplest thing that works.

## Current Implementation Status

### Already Complete ✅

1. **PathMatcher.determineIntensity()** (path-matcher.ts:273-290)
   - Detects intensity from file paths
   - Returns IntensityResult with intensity, matched paths, reason
   - Production-ready with 30 comprehensive tests

2. **Config Schema** (config/schema.ts:88-102, types/index.ts:106-120)
   - intensityProviderCounts: Record<ReviewIntensity, number>
   - intensityTimeouts: Record<ReviewIntensity, number>
   - intensityPromptDepth: Record<ReviewIntensity, 'detailed' | 'standard' | 'brief'>
   - Validated by Zod at config load time

3. **Orchestrator Wiring** (orchestrator.ts:224-295)
   - Calls PathMatcher.determineIntensity()
   - Extracts reviewIntensity
   - Looks up intensityProviderLimit and intensityTimeout
   - Logs intensity settings
   - Passes to provider selection

4. **LLMExecutor Integration** (orchestrator.ts:477)
   - Uses intensityTimeout in execute() call
   - Already respects timeout configuration

5. **Provider Selection** (orchestrator.ts:370, 425)
   - Uses intensityProviderLimit for selection
   - Already respects provider count configuration

### Needs Verification ⚠️

**Question:** Is setup.ts PromptBuilder ever used for actual reviews?

```typescript
// setup.ts:121 and :253 (both CLI and GitHub mode)
const promptBuilder = new PromptBuilder(config, 'standard', promptEnricher, undefined);
//                                              ^^^^^^^^^^^ HARDCODED
```

But orchestrator.ts:473 correctly creates per-batch PromptBuilder:
```typescript
const promptBuilder = new PromptBuilder(config, reviewIntensity);
```

**Hypothesis:** setup.ts PromptBuilder is in ReviewComponents interface but never used. Orchestrator creates fresh PromptBuilder per batch with correct intensity (line 473).

**If true:** No wiring needed. System already works correctly.

**If false:** Replace setup.ts hardcoded 'standard' with config.pathDefaultIntensity ?? 'standard'.

## Integration Patterns

### Pattern 1: Dynamic Per-Batch (Current Orchestrator Approach) ✅

```typescript
// orchestrator.ts:473
for (const batch of batches) {
  const promptBuilder = new PromptBuilder(config, reviewIntensity);
  const prompt = await promptBuilder.build(batchPR);
  // ...
}
```

**Pros:**
- Intensity can vary per batch (different files, different intensities)
- No shared state between batches
- Clean separation of concerns
- Thread-safe (no mutable state)

**Cons:**
- Slight overhead creating PromptBuilder per batch (negligible)

**Recommendation:** This is the correct pattern. Already implemented.

### Pattern 2: Shared Instance with Intensity Parameter (Anti-Pattern) ❌

```typescript
// Anti-pattern: Don't do this
const promptBuilder = new PromptBuilder(config, 'standard');
promptBuilder.setIntensity(reviewIntensity); // Mutable state = bad
```

**Why avoid:**
- Mutable state complicates testing
- Race conditions in parallel execution
- Violates functional programming principles
- Harder to reason about

## Prompt Depth Wiring (Currently Unused)

```typescript
// prompt-builder.ts:112
const _depth = this.config.intensityPromptDepth?.[this.intensity] ?? 'standard';
```

**Status:** Variable extracted but not used. Instructions are static regardless of depth.

**TODO (Future Milestone):**
Implement depth-specific prompt variations:
- 'detailed': Verbose instructions with examples
- 'standard': Current instructions (default)
- 'brief': Minimal instructions, focus on critical issues only

**Not in scope for this milestone.** Configuration wiring is complete; behavior differentiation is separate feature work.

## Installation

**No new dependencies required.**

Existing setup already includes everything needed:
```bash
# Already in package.json
npm install zod minimatch
```

## Alternatives Considered

### Alternative 1: Strategy Pattern with Classes ❌

```typescript
// NOT RECOMMENDED
interface IntensityStrategy {
  getProviderCount(): number;
  getTimeout(): number;
  getPromptDepth(): string;
}

class ThoroughStrategy implements IntensityStrategy { ... }
class StandardStrategy implements IntensityStrategy { ... }
class LightStrategy implements IntensityStrategy { ... }
```

**Why not:**
- 100+ lines of boilerplate for 3 simple lookups
- No compile-time type safety (need runtime instanceof checks)
- Harder to test (more mocking needed)
- Harder to configure (need factory or DI)
- Over-engineering for static configuration

**Use instead:** Direct Record<ReviewIntensity, T> lookup (current approach).

### Alternative 2: Configuration Management Library ❌

Libraries like `node-config`, `convict`, `config`:

**Why not:**
- 107KB+ bundle size for functionality already built
- Learning curve for team
- Zod already provides schema validation
- TypeScript already provides type safety
- No benefit over native Record<K, V>

**Use instead:** Native TypeScript + Zod (current approach).

### Alternative 3: Conditional Chains ❌

```typescript
// NOT RECOMMENDED
let providerCount: number;
if (intensity === 'thorough') {
  providerCount = 8;
} else if (intensity === 'standard') {
  providerCount = 5;
} else {
  providerCount = 3;
}
```

**Why not:**
- Verbose and repetitive (3 properties × 3 intensities = 9 conditionals)
- No compile-time exhaustiveness checking
- Hard to maintain as intensity levels grow
- No clear single source of truth
- Easy to forget a branch

**Use instead:** Lookup table with ?? fallback (current approach).

## Configuration Examples

### Minimal (Use Defaults)
```yaml
# .reviewrc.yml
path_based_intensity: true  # Enable feature
# Uses defaults from defaults.ts:
# - thorough: 8 providers, 180s timeout
# - standard: 5 providers, 120s timeout
# - light: 3 providers, 60s timeout
```

### Custom Mappings
```yaml
# .reviewrc.yml
path_based_intensity: true
path_default_intensity: standard

# Override provider counts
intensity_provider_counts:
  thorough: 10  # More providers for critical paths
  standard: 5
  light: 2      # Fewer for tests

# Override timeouts
intensity_timeouts:
  thorough: 300000  # 5 minutes for complex analysis
  standard: 120000  # 2 minutes
  light: 30000      # 30 seconds for quick checks
```

### Custom Patterns
```yaml
# .reviewrc.yml
path_based_intensity: true
path_intensity_patterns: |
  [
    {
      "pattern": "src/api/**",
      "intensity": "thorough",
      "description": "API endpoints need thorough review"
    },
    {
      "pattern": "**/*.test.ts",
      "intensity": "light",
      "description": "Tests get light review"
    }
  ]
```

## Testing Strategy

### Unit Tests Needed

1. **PathMatcher → Orchestrator integration**
   - Verify intensity detection flows to provider selection
   - Verify timeout mapping applies correctly
   - Verify provider count mapping applies correctly

2. **Config loading**
   - Verify intensity mappings parse correctly
   - Verify defaults apply when config omitted
   - Verify Zod validation catches invalid configs

3. **PromptBuilder instantiation**
   - Verify orchestrator creates PromptBuilder with correct intensity
   - Verify setup.ts PromptBuilder is unused (or replaced with dynamic)

### Integration Tests Needed

1. **End-to-end intensity flow**
   - Match thorough path → 8 providers, 180s timeout
   - Match standard path → 5 providers, 120s timeout
   - Match light path → 3 providers, 60s timeout

2. **Config override**
   - User config overrides defaults correctly
   - Missing config falls back to defaults
   - Invalid config rejected at load time

## Sources

- [Strategy Pattern in TypeScript - Refactoring Guru](https://refactoring.guru/design-patterns/strategy/typescript/example) — Examined but over-engineered for this use case
- [TypeScript TSConfig Reference](https://www.typescriptlang.org/tsconfig/) — Path mapping patterns for module resolution
- [Google SRE Configuration Design Best Practices](https://sre.google/workbook/configuration-design/) — Principles for safe config-driven behavior: "reduce mandatory questions by providing default answers that apply safely"
- [Software Configuration Management Patterns - Stackify](https://stackify.com/software-configuration-management-patterns/) — Config management architectural patterns
- [Configuration Management for TypeScript Node.js Apps](https://medium.com/@andrei-trukhin/configuration-management-for-typescript-node-js-apps-60b6c99d6331) — Centralized configuration management patterns
- Existing codebase analysis (src/core/orchestrator.ts, src/config/defaults.ts, src/analysis/path-matcher.ts, src/setup.ts, src/types/index.ts) — **HIGH confidence** from direct code inspection

---

**Recommendation:** No new stack needed. System already implements correct pattern. Only action: verify setup.ts PromptBuilder is unused, or replace hardcoded 'standard' with config.pathDefaultIntensity ?? 'standard'.

**Confidence:** HIGH — This is a finding from direct code analysis, not speculation. The wiring is 95% complete.

---
*Stack research for: Path-Based Intensity Configuration Wiring*
*Researched: 2026-02-05*
