# Architecture Research: Wiring Intensity into Orchestrator

**Domain:** Configuration-driven orchestrator behavior
**Researched:** 2026-02-05
**Confidence:** HIGH

## Executive Summary

This research addresses how to wire path-based intensity configuration into the existing ReviewOrchestrator to control provider selection, timeouts, and prompt variations. The analysis is based on:

1. **Current codebase patterns** (orchestrator.ts lines 224-295, prompt-builder.ts constructor, setup.ts composition)
2. **Industry patterns** for configuration-driven orchestrators
3. **Minimal-change wiring strategies** that preserve existing architecture

The recommended approach uses **constructor injection + runtime parameter passing** - configuration flows from setup.ts → components → orchestrator → runtime decisions, with intensity determined per-request and passed as a parameter to behavior points.

## Current Architecture Analysis

### System Overview

```
┌─────────────────────────────────────────────────────────────┐
│                    main.ts / CLI Entry                       │
│                  (loads config from env)                     │
└────────────────────────┬─────────────────────────────────────┘
                         ↓
┌─────────────────────────────────────────────────────────────┐
│                      setup.ts                                │
│        (dependency composition / component factory)          │
│   Creates: PathMatcher, PromptBuilder, Orchestrator, etc.   │
└────────────────────────┬─────────────────────────────────────┘
                         ↓
┌─────────────────────────────────────────────────────────────┐
│                  ReviewOrchestrator                          │
│              (coordinates review execution)                  │
├─────────────────────────────────────────────────────────────┤
│  executeReview(pr: PRContext) {                             │
│    1. PathMatcher.determineIntensity(files) → intensity     │
│    2. Apply intensity to provider selection (CURRENT)       │
│    3. Apply intensity to timeouts (CURRENT)                 │
│    4. Create PromptBuilder per-batch with intensity         │
│    5. Execute LLM providers with config                     │
│  }                                                           │
└─────────────────────────────────────────────────────────────┘
```

### Current Intensity Wiring (Lines 224-295 in orchestrator.ts)

**Pattern:** Runtime parameter computation → local variable passing

```typescript
// Step 1: Determine intensity from files
const intensityResult = pathMatcher.determineIntensity(reviewContext.files);
reviewIntensity = intensityResult.intensity; // 'light' | 'standard' | 'thorough'

// Step 2: Apply intensity mappings from config
const intensityProviderLimit = config.intensityProviderCounts?.[reviewIntensity]
  ?? config.providerLimit;
const intensityTimeout = config.intensityTimeouts?.[reviewIntensity]
  ?? (config.runTimeoutSeconds * 1000);

// Step 3: Use mapped values in downstream operations
const executionLimit = intensityProviderLimit || config.providerLimit;
const results = await this.components.llmExecutor.execute(healthy, prompt, intensityTimeout);
```

**Strengths:**
- Centralized intensity determination
- Clear data flow: intensity → mapped values → execution
- Already implemented for provider count and timeout
- No shared mutable state

**Gap:**
- PromptBuilder created in setup.ts with hardcoded 'standard' intensity (line 121, 253)
- Per-batch PromptBuilder creation (line 473) doesn't pass intensity yet

## Integration Patterns for Config-Driven Behavior

### Pattern 1: Constructor Injection (Currently Used)

**What:** Dependencies and configuration injected at construction time.

**Example from codebase:**
```typescript
// setup.ts line 121
const promptBuilder = new PromptBuilder(config, 'standard', promptEnricher, undefined);
//                                      ^config  ^intensity

// orchestrator.ts constructor
constructor(private readonly components: ReviewComponents) {
  // Components contain config and dependencies
}
```

**When to use:**
- Configuration stable for component lifetime
- Dependencies need to be shared across requests
- Good for: config, client connections, trackers

**Trade-offs:**
- ✅ Explicit dependencies
- ✅ Easy to test (inject mocks)
- ❌ Cannot change per-request (like intensity)

### Pattern 2: Runtime Parameter Passing (Partially Used)

**What:** Behavior configuration passed as method parameters at invocation time.

**Example from codebase:**
```typescript
// orchestrator.ts line 473 (per-batch prompt building)
const promptBuilder = new PromptBuilder(config, reviewIntensity);
const prompt = await promptBuilder.build(batchContext);
//                                       ^runtime context

// orchestrator.ts line 477 (timeout parameter)
const results = await this.components.llmExecutor.execute(
  healthy, prompt, intensityTimeout
);                      ^runtime param
```

**When to use:**
- Behavior varies per request/batch
- Configuration computed at runtime
- Good for: intensity, batch size, timeout

**Trade-offs:**
- ✅ Flexible per-request behavior
- ✅ No shared state
- ❌ More parameters to pass
- ❌ Potential for parameter drift

### Pattern 3: Strategy Pattern (Not Currently Used)

**What:** Encapsulate algorithm families in separate classes, selected at runtime.

**Example (hypothetical):**
```typescript
interface ReviewStrategy {
  selectProviders(available: Provider[]): Provider[];
  getTimeout(): number;
  buildPrompt(context: PRContext): string;
}

class ThoroughReviewStrategy implements ReviewStrategy { ... }
class LightReviewStrategy implements ReviewStrategy { ... }

// Usage:
const strategy = strategyFactory.create(intensity);
const providers = strategy.selectProviders(available);
```

**When to use:**
- Complex behavior variations
- Multiple related decisions clustered together
- Worth abstraction overhead

**Trade-offs:**
- ✅ Encapsulates related behavior variations
- ✅ Open/closed principle
- ❌ Overkill for simple mappings
- ❌ More classes to maintain

**Recommendation:** NOT needed for intensity wiring. Current config mapping pattern (Pattern 2) is simpler and sufficient.

## Recommended Architecture for Intensity Wiring

### Integration Points

| Component | Integration Type | Current State | Change Needed |
|-----------|-----------------|---------------|---------------|
| **PathMatcher** | Constructor injection | ✅ Complete (lines 272-276) | None |
| **Orchestrator** | Runtime computation | ✅ Complete (lines 278-295) | None |
| **PromptBuilder** | Constructor parameter + per-batch creation | ⚠️ Hardcoded 'standard' | Create per-batch with intensity |
| **LLMExecutor** | Runtime parameter | ✅ Complete (line 477) | None |
| **Config types** | Schema definition | ✅ Complete (types.ts) | None |

### Data Flow (Recommended)

```
[1. Config Loading]
   ConfigLoader.load() → ReviewConfig
      ↓
      • intensityProviderCounts: { thorough: 8, standard: 6, light: 4 }
      • intensityTimeouts: { thorough: 300000, standard: 240000, light: 180000 }
      • intensityPromptDepth: { thorough: 'detailed', standard: 'standard', light: 'brief' }
      • pathBasedIntensity: true
      • pathIntensityPatterns: JSON string of patterns

[2. Component Setup]
   setup.ts: createComponents(config)
      ↓
      • PathMatcher(config.pathIntensityPatterns) — validates patterns once
      • Other components with config injection
      • Note: Do NOT create shared PromptBuilder (intensity varies per-batch)

[3. Runtime Execution]
   orchestrator.executeReview(pr: PRContext)
      ↓
   [3a. Determine Intensity]
      PathMatcher.determineIntensity(pr.files) → IntensityResult
         ↓ intensity: 'thorough' | 'standard' | 'light'

   [3b. Apply Provider Mapping]
      intensityProviderLimit = config.intensityProviderCounts[intensity]
                            ?? config.providerLimit (fallback)
         ↓ Use for health checks and execution

   [3c. Apply Timeout Mapping]
      intensityTimeout = config.intensityTimeouts[intensity]
                      ?? (config.runTimeoutSeconds * 1000)
         ↓ Pass to llmExecutor.execute()

   [3d. Create Per-Batch PromptBuilder]
      For each batch:
         promptBuilder = new PromptBuilder(config, intensity, enricher, graph)
         prompt = await promptBuilder.build(batchContext)
         ↓ Uses intensity for prompt depth/detail
```

### Prompt Depth Variation (Currently Missing)

**Location:** prompt-builder.ts constructor line 14, build() method

**Current behavior:** Accepts intensity parameter but doesn't vary prompt structure based on it.

**Recommended implementation:**

```typescript
// prompt-builder.ts
constructor(
  private readonly config: ReviewConfig,
  private readonly intensity: ReviewIntensity = 'standard',
  // ...
) {
  // Validate intensity (already done line 19-22)
}

async build(pr: PRContext): Promise<string> {
  const diff = trimDiff(pr.diff, this.config.diffMaxBytes);

  // Get depth configuration for this intensity
  const depth = this.config.intensityPromptDepth?.[this.intensity] ?? 'standard';

  // Vary instructions based on depth
  const instructions = this.buildInstructions(pr, diff, depth);
  // ...
}

private buildInstructions(pr: PRContext, diff: string, depth: 'detailed' | 'standard' | 'brief'): string[] {
  const baseInstructions = [
    'You are a code reviewer. ONLY report actual bugs...',
    // Core rules (lines 115-137)
  ];

  switch (depth) {
    case 'detailed':
      // Thorough: Include all context, examples, call graphs
      return [
        ...baseInstructions,
        this.getDetailedGuidance(),
        this.getCallContext(), // Already exists (lines 195-217)
        this.getDefensivePatterns(), // Already exists (lines 171-180)
      ];

    case 'brief':
      // Light: Minimal instructions, skip optional context
      return [
        ...baseInstructions,
        // Skip: call context, defensive patterns, learned preferences
      ];

    case 'standard':
    default:
      // Standard: Current behavior
      return [
        ...baseInstructions,
        this.getCallContext(), // Conditional on graph
        this.getDefensivePatterns(), // For diffs < 50KB
      ];
  }
}
```

## Build Order (Dependency-Aware)

### Phase 1: Type Extensions (No Runtime Changes)

**Goal:** Extend config schema to support intensity mappings.

**Changes:**
1. `src/types/index.ts` - Already has `intensityPromptDepth` (lines 115-119)
2. `src/config/schema.ts` - Already has validation (lines 97-99)

**Status:** ✅ Already complete

**Validation:** Run existing schema tests

---

### Phase 2: PromptBuilder Depth Variation

**Goal:** Make PromptBuilder vary prompt structure based on intensity.

**Changes:**
1. `src/analysis/llm/prompt-builder.ts`:
   - Extract `buildInstructions()` method
   - Add depth-based instruction variation
   - Keep existing validation (lines 19-22)

**Dependencies:**
- Config types (Phase 1) ✅ Complete
- PromptBuilder constructor already accepts intensity (line 14)

**Risk:** Low - constructor already wired, just need to use the intensity parameter

**Validation:**
- Unit test: verify different prompts for 'detailed' vs 'brief'
- Integration test: end-to-end with different intensity configs

---

### Phase 3: Per-Batch PromptBuilder Creation

**Goal:** Create PromptBuilder instances per-batch with runtime intensity.

**Changes:**
1. `src/core/orchestrator.ts` line 473:
   ```typescript
   // BEFORE (current):
   const promptBuilder = new PromptBuilder(config, reviewIntensity);

   // AFTER (no change needed - already correct!):
   const promptBuilder = new PromptBuilder(config, reviewIntensity, promptEnricher, codeGraph);
   ```

2. Remove shared PromptBuilder from `setup.ts`:
   ```typescript
   // REMOVE lines 121, 253 (shared promptBuilder)
   // No longer needed - created per-batch in orchestrator
   ```

3. Update `ReviewComponents` interface:
   ```typescript
   // REMOVE promptBuilder from interface (orchestrator.ts line 58)
   // Components no longer include shared PromptBuilder
   ```

**Dependencies:**
- Phase 2 (PromptBuilder depth variation) completed
- Orchestrator already computes reviewIntensity (line 278)

**Risk:** Medium - changes component composition, but orchestrator already creates per-batch builders

**Validation:**
- Verify orchestrator tests still pass
- Check setup.ts component creation
- Integration test with different file batches

---

### Phase 4: Integration Testing & Documentation

**Goal:** Validate end-to-end intensity behavior.

**Test scenarios:**
1. **Thorough intensity:**
   - Files: `src/auth/login.ts`
   - Expected: 8 providers, 300s timeout, detailed prompt

2. **Light intensity:**
   - Files: `src/__tests__/login.test.ts`
   - Expected: 4 providers, 180s timeout, brief prompt

3. **Standard intensity (default):**
   - Files: `src/utils/helpers.ts`
   - Expected: 6 providers, 240s timeout, standard prompt

**Documentation updates:**
1. Add to API_CHANGELOG.md
2. Update configuration docs with intensity mappings
3. Add example configurations

**Dependencies:** All previous phases complete

**Validation:**
- End-to-end test with real PR
- Cost tracking shows different usage patterns
- Logs show intensity decisions

## Anti-Patterns to Avoid

### Anti-Pattern 1: Shared Mutable PromptBuilder

**What people do:** Create one PromptBuilder in setup.ts and mutate its intensity property per-batch.

**Why it's wrong:**
- Shared mutable state causes race conditions in parallel batch processing
- Hard to test and reason about
- Violates orchestrator's immutability guarantee (line 115-117)

**Do this instead:** Create new PromptBuilder per-batch with correct intensity (already done line 473).

---

### Anti-Pattern 2: Intensity-Specific Orchestrators

**What people might consider:** Create `ThoroughOrchestrator`, `StandardOrchestrator`, `LightOrchestrator` classes.

**Why it's wrong:**
- Duplicates orchestration logic across classes
- Makes changes harder (must update 3 places)
- Overkill for simple config mapping

**Do this instead:** Single orchestrator with config-driven behavior (current pattern).

---

### Anti-Pattern 3: Deep Config Drilling

**What to avoid:** Passing entire config object through every method call.

```typescript
// BAD:
private async runBatch(batch, config) {
  const intensity = this.getIntensity(batch, config);
  const timeout = this.getTimeout(intensity, config);
  const prompt = await this.buildPrompt(batch, intensity, config);
  await this.execute(prompt, timeout, config);
}
```

**Why it's wrong:**
- Unclear which config fields are used where
- Hard to test (need full config object)
- Temptation to access unrelated config

**Do this instead:** Extract only needed values at orchestrator level, pass as parameters.

```typescript
// GOOD (current pattern):
const intensityTimeout = config.intensityTimeouts?.[reviewIntensity] ?? defaultTimeout;
const results = await this.components.llmExecutor.execute(healthy, prompt, intensityTimeout);
```

---

### Anti-Pattern 4: Premature Abstraction (Strategy Pattern)

**What to avoid:** Creating strategy classes before proving the need.

**Why it's wrong:**
- Current config mapping is 3 lines per behavior (lines 289-290)
- Strategy pattern adds ~50 lines per behavior
- No evidence of complex logic requiring abstraction

**Do this instead:** Keep simple config lookups until complexity justifies abstraction.

## Minimal Change Strategy

### What Already Works

✅ **PathMatcher** - Determines intensity from file paths (lines 272-286)
✅ **Provider selection** - Uses `intensityProviderCounts` mapping (line 289)
✅ **Timeout mapping** - Uses `intensityTimeouts` mapping (line 290)
✅ **Per-batch PromptBuilder** - Created with intensity parameter (line 473)
✅ **Config schema** - Types and validation complete

### What Needs Changing

⚠️ **PromptBuilder depth variation** - Constructor accepts intensity but doesn't vary prompt structure
⚠️ **Shared PromptBuilder removal** - setup.ts creates unused shared instance (lines 121, 253)

### Estimated Change Size

| Component | Lines Changed | Risk |
|-----------|--------------|------|
| prompt-builder.ts | ~30 lines (extract buildInstructions method) | Low |
| setup.ts | -2 lines (remove shared promptBuilder) | Low |
| orchestrator.ts | -1 line (remove promptBuilder from interface) | Low |
| Tests | +50 lines (validate prompt depth variation) | Low |
| **Total** | **~77 lines net** | **Low** |

## Scaling Considerations

| Scale | Architecture Impact |
|-------|---------------------|
| **Current (single-tenant Action)** | No changes needed - config loaded once per run |
| **Future (multi-tenant server)** | Consider caching PathMatcher instances per config hash to avoid repeated pattern validation |
| **High throughput** | Current pattern already stateless and parallelizable - no bottlenecks introduced |

**Performance notes:**
- PathMatcher pattern validation happens once at construction (line 83)
- Intensity determination is O(files × patterns) but cached internally (line 366-370)
- Per-batch PromptBuilder creation has negligible overhead (~1ms per batch)

## Sources

**Codebase Analysis (HIGH confidence):**
- /Users/keith/src/multi-provider-code-review/src/core/orchestrator.ts (lines 224-295, 469-495)
- /Users/keith/src/multi-provider-code-review/src/analysis/llm/prompt-builder.ts (constructor, build method)
- /Users/keith/src/multi-provider-code-review/src/analysis/path-matcher.ts (complete implementation)
- /Users/keith/src/multi-provider-code-review/src/setup.ts (component composition)
- /Users/keith/src/multi-provider-code-review/src/types/index.ts (config types)

**Architectural Patterns (MEDIUM confidence):**
- [Dependency injection - .NET | Microsoft Learn](https://learn.microsoft.com/en-us/dotnet/core/extensions/dependency-injection)
- [Inversion of Control Containers and the Dependency Injection pattern](https://martinfowler.com/articles/injection.html)
- [Strategy pattern - Wikipedia](https://en.wikipedia.org/wiki/Strategy_pattern)
- [Strategy Design Pattern - Refactoring.Guru](https://refactoring.guru/design-patterns/strategy)
- [Improve Conditional Logic in C# (strategy pattern) II. Passing Parameters. | Medium](https://medium.com/@untxen/improve-conditional-logic-in-c-strategy-pattern-ii-passing-parameters-39c9ccbd9bad)

**Orchestrator Patterns (LOW confidence - general context):**
- [Durable orchestrator code constraints - Azure Functions | Microsoft Learn](https://learn.microsoft.com/en-us/azure/azure-functions/durable/durable-functions-code-constraints)
- [Configuration Management for TypeScript Node.js Apps | Medium](https://medium.com/@andrei-trukhin/configuration-management-for-typescript-node-js-apps-60b6c99d6331)

---
*Architecture research for: multi-provider-code-review intensity wiring*
*Researched: 2026-02-05*
*Next: Roadmap creation will use this to structure build phases*
