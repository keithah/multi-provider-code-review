# Phase 6: Configuration & Validation - Research

**Researched:** 2026-02-05
**Domain:** TypeScript/Zod configuration validation with fail-fast patterns
**Confidence:** HIGH

## Summary

This phase extends the existing Zod-based configuration system to add intensity behavior mappings (consensus thresholds, severity filters, prompt depth) and validate them at startup. The codebase already has a mature config pattern: YAML/env loading via ConfigLoader, Zod schema validation in schema.ts, TypeScript interfaces in types/index.ts, and defaults in defaults.ts. The task is extending this pattern, not creating new architecture.

Research confirms Zod 3.23.8 (currently installed) provides all needed validation capabilities including custom error messages, range validation with clamping, and refinement for complex validation. For typo suggestions on severity enums (user decision), a simple Levenshtein distance function can provide "did you mean?" suggestions without external dependencies.

The configuration-to-behavior wiring is 90% complete per existing milestone research. Phase 6 focuses on schema extension and validation - Phase 7 will wire validated config into execution behaviors.

**Primary recommendation:** Extend existing ReviewConfigSchema with new intensity behavior fields, add custom Zod refinements for percentage clamping and typo suggestions, validate at config load time (startup).

## Standard Stack

The established libraries/tools for this domain:

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| Zod | 3.23.8 | Runtime schema validation | Already in use. Provides type inference, custom error messages, refinements. Package.json confirms ^3.23.8 |
| TypeScript | 5.9.3 | Type-safe configuration | Compile-time exhaustiveness checking for ReviewIntensity union types. Already configured. |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| js-yaml | 4.1.1 | Parse YAML config files | Already used in ConfigLoader for .yml/.yaml parsing |
| minimatch | 10.1.1 | Path pattern matching | Already used in PathMatcher for intensity pattern validation |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Zod | io-ts | io-ts has steeper learning curve, Zod already in use |
| Zod | Yup | Yup is older, Zod has better TypeScript inference |
| Custom Levenshtein | fastest-levenshtein | External dep for ~15 lines of code |

**Installation:**
```bash
# No new dependencies needed - all libraries already installed
npm ls zod  # zod@3.23.8
```

## Architecture Patterns

### Recommended Project Structure
```
src/
  config/
    schema.ts         # Zod schemas (extend with intensity behaviors)
    loader.ts         # Config loading, merging (extend validation call)
    defaults.ts       # Default values (extend with new fields)
    validators.ts     # NEW: Custom validation helpers (typo suggestions, clamping)
  types/
    index.ts          # TypeScript interfaces (extend ReviewConfig)
```

### Pattern 1: Zod Schema Extension for Intensity Behaviors
**What:** Add new Zod schema fields for consensus thresholds, severity filters per intensity level
**When to use:** When adding configurable behavior mappings
**Example:**
```typescript
// Source: Existing pattern from schema.ts:88-102, extended
export const IntensityBehaviorSchema = z.object({
  consensusThreshold: z.number().min(0).max(100).optional(),
  minSeverity: z.enum(['critical', 'major', 'minor']).optional(),
  promptDepth: z.enum(['detailed', 'standard', 'brief']).optional(),
}).optional();

export const ReviewConfigSchema = z.object({
  // ... existing fields ...
  intensityBehaviors: z.object({
    thorough: IntensityBehaviorSchema,
    standard: IntensityBehaviorSchema,
    light: IntensityBehaviorSchema,
  }).optional(),
});
```

### Pattern 2: Percentage Clamping with Warning (User Decision)
**What:** Clamp invalid percentages to 0-100 range, log warning, continue execution
**When to use:** For consensus percentage validation (per user decision: clamp with warning)
**Example:**
```typescript
// Source: Pattern from loader.ts parseOverrides(), adapted
function clampPercentage(value: number, field: string): number {
  if (value < 0) {
    logger.warn(`${field} was ${value}, clamped to 0`);
    return 0;
  }
  if (value > 100) {
    logger.warn(`${field} was ${value}, clamped to 100`);
    return 100;
  }
  return value;
}

// In config normalization:
consensusThreshold: config.consensus_threshold !== undefined
  ? clampPercentage(config.consensus_threshold, 'consensus_threshold')
  : undefined,
```

### Pattern 3: Strict Enum Validation with Typo Suggestions (User Decision)
**What:** Reject invalid severity enums with helpful "did you mean?" messages
**When to use:** For severity enum validation (per user decision: strict with suggestions)
**Example:**
```typescript
// Source: Pattern inspired by ValidationError from utils/validation.ts
const SEVERITY_VALUES = ['critical', 'major', 'minor'] as const;

function validateSeverityWithSuggestion(value: string, field: string): 'critical' | 'major' | 'minor' {
  if (SEVERITY_VALUES.includes(value as any)) {
    return value as 'critical' | 'major' | 'minor';
  }

  const suggestion = findClosestMatch(value, SEVERITY_VALUES);
  throw new ValidationError(
    `Invalid severity: "${value}"`,
    field,
    suggestion ? `Did you mean "${suggestion}"?` : `Valid values: ${SEVERITY_VALUES.join(', ')}`
  );
}

// Levenshtein helper (~15 lines, no external dep)
function levenshteinDistance(a: string, b: string): number {
  const matrix: number[][] = [];
  for (let i = 0; i <= a.length; i++) matrix[i] = [i];
  for (let j = 0; j <= b.length; j++) matrix[0][j] = j;
  for (let i = 1; i <= a.length; i++) {
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      matrix[i][j] = Math.min(
        matrix[i - 1][j] + 1,
        matrix[i][j - 1] + 1,
        matrix[i - 1][j - 1] + cost
      );
    }
  }
  return matrix[a.length][b.length];
}

function findClosestMatch(input: string, candidates: readonly string[]): string | null {
  const normalized = input.toLowerCase();
  let closest: string | null = null;
  let minDistance = Infinity;

  for (const candidate of candidates) {
    const distance = levenshteinDistance(normalized, candidate);
    // Only suggest if within 2 edits (prevents bad suggestions)
    if (distance < minDistance && distance <= 2) {
      minDistance = distance;
      closest = candidate;
    }
  }
  return closest;
}
```

### Pattern 4: Startup Validation (Fail-Fast)
**What:** Validate all config at startup, throw descriptive errors for invalid config
**When to use:** When loading config (ConfigLoader.load())
**Example:**
```typescript
// Source: Existing pattern from loader.ts:25-38, extended
static load(): ReviewConfig {
  const fileConfig = this.loadFromFile();
  const envConfig = this.loadFromEnv();
  const merged = this.merge(DEFAULT_CONFIG, fileConfig, envConfig);

  // Validate final configuration (fail-fast at startup)
  try {
    validateConfig(merged as unknown as Record<string, unknown>);
    validateIntensityBehaviors(merged);  // NEW: intensity-specific validation
  } catch (error) {
    if (error instanceof ValidationError) {
      throw new ValidationError(
        `Invalid configuration: ${error.message}`,
        error.field,
        error.hint
      );
    }
    throw error;
  }

  return merged;
}
```

### Anti-Patterns to Avoid
- **Lazy validation:** Waiting until behavior is accessed to validate config. Fails at runtime, not startup.
- **Silent fallback on invalid enums:** Using default instead of failing. Hides user errors.
- **Throwing on percentage out of range:** Per user decision, clamp with warning instead.

## Don't Hand-Roll

Problems that look simple but have existing solutions:

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Schema validation | Manual field checks | Zod .parse() | Type inference, composable, error messages built-in |
| YAML parsing | Manual string parsing | js-yaml | Edge cases (multiline, anchors, special chars) |
| Glob pattern matching | Regex-based matching | minimatch | ReDoS protection, full glob spec support |
| Type narrowing | Manual type guards | Zod .infer<> | Compile-time type safety from runtime schema |

**Key insight:** Zod already handles 90% of validation needs. Custom code is only for per-field business logic (clamping, typo suggestions).

## Common Pitfalls

### Pitfall 1: Zod v3 vs v4 Error API Differences
**What goes wrong:** Using Zod v4 error customization syntax with v3 (current version)
**Why it happens:** Web search results show v4 patterns, but package.json has v3.23.8
**How to avoid:** Use v3 error syntax: `.refine(val, { message: "..." })` not `.refine(val, { error: "..." })`
**Warning signs:** "error" property not recognized in Zod options

### Pitfall 2: Validation After Merge Hides Source
**What goes wrong:** Validating merged config loses information about whether error came from file or env
**Why it happens:** File and env configs merged before validation
**How to avoid:** Validate file config separately from env config, report which source had the error
**Warning signs:** User can't tell if they need to fix .yml file or env var

### Pitfall 3: Missing JSDoc Comments on New Fields
**What goes wrong:** IDE doesn't show help tooltips for new config options (per user decision: both JSDoc and example files)
**Why it happens:** Adding fields to schema but not to TypeScript interface with JSDoc
**How to avoid:** Add JSDoc comments to ReviewConfig interface in types/index.ts
**Warning signs:** No autocomplete hints in IDE

### Pitfall 4: Overlapping Pattern Precedence Ambiguity
**What goes wrong:** Multiple patterns match same file, unclear which intensity wins
**Why it happens:** No documented precedence rules for overlapping patterns
**How to avoid:** Document precedence (highest intensity wins), add validation warning for overlap
**Warning signs:** Different results from similar pattern configurations

### Pitfall 5: Zod Enum Doesn't Suggest Similar Values
**What goes wrong:** z.enum(['critical', 'major', 'minor']) just says "invalid value"
**Why it happens:** Zod's built-in enum validation doesn't do fuzzy matching
**How to avoid:** Use .refine() with custom typo detection instead of raw z.enum()
**Warning signs:** User types 'majr', gets unhelpful error

## Code Examples

Verified patterns from codebase and official sources:

### Extending Zod Schema with New Fields
```typescript
// Source: Existing pattern from src/config/schema.ts
import { z } from 'zod';

// Intensity-specific behavior config (Phase 6 addition)
const IntensityBehaviorSchema = z.object({
  /** Consensus percentage threshold (0-100) for this intensity level */
  consensusThreshold: z.number().min(0).max(100).optional(),
  /** Minimum severity to report for this intensity level */
  minSeverity: z.enum(['critical', 'major', 'minor']).optional(),
  /** Prompt depth for this intensity level */
  promptDepth: z.enum(['detailed', 'standard', 'brief']).optional(),
}).optional();

// Extend existing ReviewConfigSchema
export const ReviewConfigSchema = z.object({
  // ... existing fields from schema.ts:4-116 ...

  // NEW: Per-intensity behavior mappings
  intensity_behaviors: z.object({
    thorough: IntensityBehaviorSchema,
    standard: IntensityBehaviorSchema,
    light: IntensityBehaviorSchema,
  }).optional(),
});
```

### Validating with Clamping and Warnings
```typescript
// Source: Pattern from src/config/loader.ts:244-274, adapted
import { logger } from '../utils/logger';

/**
 * Clamp percentage to valid range, log warning if adjusted
 */
export function clampPercentage(value: number, fieldName: string): number {
  if (!Number.isFinite(value)) {
    logger.warn(`${fieldName}: invalid value ${value}, using 50`);
    return 50;
  }

  const clamped = Math.max(0, Math.min(100, value));
  if (clamped !== value) {
    logger.warn(`${fieldName}: ${value} clamped to ${clamped} (valid range: 0-100)`);
  }
  return clamped;
}
```

### ValidationError with Typo Suggestion
```typescript
// Source: Existing pattern from src/utils/validation.ts:8-17, extended
export class ValidationError extends Error {
  constructor(
    message: string,
    public readonly field?: string,
    public readonly hint?: string
  ) {
    super(message);
    this.name = 'ValidationError';
  }
}

// Usage for severity validation
const SEVERITY_VALUES = ['critical', 'major', 'minor'] as const;

export function validateSeverity(value: unknown, field: string): 'critical' | 'major' | 'minor' {
  if (typeof value !== 'string') {
    throw new ValidationError(
      `${field} must be a string`,
      field,
      `Received type: ${typeof value}`
    );
  }

  const normalized = value.toLowerCase();
  if (SEVERITY_VALUES.includes(normalized as any)) {
    return normalized as 'critical' | 'major' | 'minor';
  }

  // Find closest match for typo suggestion
  const suggestion = findClosestMatch(normalized, SEVERITY_VALUES);
  throw new ValidationError(
    `${field} has invalid value: "${value}"`,
    field,
    suggestion
      ? `Did you mean "${suggestion}"?`
      : `Valid values: ${SEVERITY_VALUES.join(', ')}`
  );
}
```

### Startup Validation Integration
```typescript
// Source: Existing pattern from src/config/loader.ts, extended
export class ConfigLoader {
  static load(): ReviewConfig {
    const fileConfig = this.loadFromFile();
    const envConfig = this.loadFromEnv();
    const merged = this.merge(DEFAULT_CONFIG, fileConfig, envConfig);

    // Validate final configuration
    this.validateIntensityBehaviors(merged);

    return merged;
  }

  private static validateIntensityBehaviors(config: ReviewConfig): void {
    const behaviors = config.intensityBehaviors;
    if (!behaviors) return;

    // Validate each intensity level
    for (const level of ['thorough', 'standard', 'light'] as const) {
      const behavior = behaviors[level];
      if (!behavior) continue;

      // Clamp consensus thresholds (user decision: clamp with warning)
      if (behavior.consensusThreshold !== undefined) {
        behavior.consensusThreshold = clampPercentage(
          behavior.consensusThreshold,
          `intensityBehaviors.${level}.consensusThreshold`
        );
      }

      // Strict validation for severity (user decision: fail with suggestion)
      if (behavior.minSeverity !== undefined) {
        behavior.minSeverity = validateSeverity(
          behavior.minSeverity,
          `intensityBehaviors.${level}.minSeverity`
        );
      }
    }
  }
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Manual validation | Zod schema validation | Already in use | Type inference, composable schemas |
| String error messages | ValidationError with field/hint | Already in use | Better UX, actionable errors |
| Fail silently | Fail fast at startup | Already in use | Errors caught before execution |

**Deprecated/outdated:**
- Zod v3 `.message()` property on schemas: Still works but v4 moves to `.error()`
- Note: Codebase uses v3.23.8, so use v3 patterns

## Open Questions

Things that couldn't be fully resolved:

1. **Pattern overlap precedence behavior**
   - What we know: PathMatcher uses highest-intensity-wins (path-matcher.ts:320-327)
   - What's unclear: Should this be documented? Configurable?
   - Recommendation: Document highest-intensity-wins in examples, add validation warning for overlaps

2. **Reload validation timing**
   - What we know: ConfigLoader.load() validates once at startup
   - What's unclear: Should there be a reload path for live config updates?
   - Recommendation: Startup-only for v1.0 (simpler), defer reload to future phase

## Sources

### Primary (HIGH confidence)
- Codebase analysis: src/config/schema.ts, src/config/loader.ts, src/config/defaults.ts, src/types/index.ts, src/utils/validation.ts
- [Zod Error Customization](https://zod.dev/error-customization) - Custom error messages, refinements

### Secondary (MEDIUM confidence)
- [Fail-Fast Environment Validation](https://maxifjaved.com/blogs/fail-fast-environment-validation-in-elysiajs/) - Startup validation patterns
- [Configuration Management for TypeScript](https://medium.com/@andrei-trukhin/configuration-management-for-typescript-node-js-apps-60b6c99d6331) - Config architecture
- Previous milestone research: .planning/research/SUMMARY.md, .planning/research/STACK-intensity-wiring.md

### Tertiary (LOW confidence)
- Levenshtein distance algorithm - Standard CS algorithm, well-documented

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - Uses existing Zod/TypeScript stack, no new dependencies
- Architecture: HIGH - Extends established patterns from loader.ts, schema.ts
- Pitfalls: HIGH - Based on direct codebase analysis and user decisions from CONTEXT.md

**Research date:** 2026-02-05
**Valid until:** 30 days (stable domain, no fast-moving dependencies)
