# Phase 9: Integration Testing - Research

**Researched:** 2026-02-07
**Domain:** Jest integration testing, end-to-end behavior validation, performance benchmarking
**Confidence:** HIGH

## Summary

This phase requires end-to-end integration tests that validate path-based intensity controls affect the full review pipeline. The existing codebase already has a comprehensive test infrastructure with Jest, established patterns for mocking providers (see `__tests__/integration/orchestrator.integration.test.ts`), and a benchmark framework (see `__tests__/benchmarks/review-performance.benchmark.ts`).

The key research finding is that the project already has all the necessary patterns established:
- Provider mocking with test mode (StubLLMExecutor, FakeProvider patterns)
- Component injection via ReviewComponents interface
- Performance benchmarking patterns with timing assertions
- PathMatcher unit tests that prove the intensity detection logic works

What's missing is end-to-end validation that intensity settings flow through to actual behavior changes (provider count, timeout, prompt depth, consensus thresholds, severity filtering).

**Primary recommendation:** Build on existing `orchestrator.integration.test.ts` patterns, adding intensity-aware test cases that verify the full chain from config to behavior.

## Standard Stack

The established libraries/tools for this domain:

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| jest | ^29.7.0 | Test runner | Already in use, TypeScript support, parallel execution |
| ts-jest | ^29.4.6 | TypeScript transformer | Already configured, enables type-safe tests |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| (built-in) | - | jest.fn(), jest.mock() | Provider mocking, spy verification |
| (built-in) | - | jest.setTimeout() | Performance test timeouts |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Jest | Vitest | Vitest is faster but project already uses Jest with established patterns |
| Manual mocks | nock | nock is for HTTP mocking; providers use custom interfaces |

**Installation:**
```bash
# Already installed - no new dependencies needed
```

## Architecture Patterns

### Recommended Test Structure
```
__tests__/
  integration/
    intensity/
      thorough.integration.test.ts     # Thorough intensity end-to-end
      light.integration.test.ts        # Light intensity end-to-end
      standard.integration.test.ts     # Standard intensity end-to-end
      path-precedence.integration.test.ts  # Overlapping pattern tests
      default-fallback.integration.test.ts # No-match fallback tests
      consensus-severity.integration.test.ts # Threshold/filter tests
    performance/
      path-matcher-caching.benchmark.ts # PathMatcher caching efficiency
```

Alternative (single comprehensive file):
```
__tests__/
  integration/
    intensity.integration.test.ts     # All intensity tests in one file
    intensity-performance.benchmark.ts # All performance tests
```

### Pattern 1: Test Mode Provider Pattern
**What:** Use real provider classes with injected mock execution
**When to use:** Testing full integration without network calls
**Example:**
```typescript
// Source: Existing pattern from orchestrator.integration.test.ts
class FakeProvider extends Provider {
  constructor() {
    super('fake/model');
  }

  async review(_prompt: string, _timeoutMs: number): Promise<ReviewResult> {
    return {
      content: 'ok',
      findings: [{ file: 'src/index.ts', line: 15, severity: 'major', title: 'Issue', message: 'Test' }],
    };
  }
}

class StubLLMExecutor {
  private providers: Provider[];
  private timeout: number | null = null;

  async execute(providers: Provider[], _prompt: string, timeoutMs: number): Promise<ProviderResult[]> {
    this.providers = providers;
    this.timeout = timeoutMs;
    // Return canned responses for each provider
    return providers.map(p => ({
      name: p.name,
      status: 'success' as const,
      result: { content: 'ok', findings: [] },
      durationSeconds: 0.1,
    }));
  }

  // Verification methods for test assertions
  getProvidersUsed(): Provider[] { return this.providers; }
  getTimeoutUsed(): number | null { return this.timeout; }
}
```

### Pattern 2: Behavior Verification via Mock Inspection
**What:** Capture and verify what parameters were passed to components
**When to use:** Validating intensity affects provider count, timeout, etc.
**Example:**
```typescript
// Source: Derived from existing test patterns
describe('Intensity: thorough', () => {
  it('uses 8 providers and 180000ms timeout', async () => {
    const llmExecutor = new SpyLLMExecutor();
    const components = createComponents({
      llmExecutor,
      config: createConfig({ pathBasedIntensity: true }),
    });

    const orchestrator = new ReviewOrchestrator(components);
    await orchestrator.execute(1); // PR with auth files

    expect(llmExecutor.getProvidersUsed()).toHaveLength(8);
    expect(llmExecutor.getTimeoutUsed()).toBe(180000);
  });
});
```

### Pattern 3: Prompt Content Verification
**What:** Verify prompts contain intensity-specific instructions
**When to use:** Validating prompt depth (detailed/standard/brief)
**Example:**
```typescript
// Source: Derived from intensity.test.ts patterns
describe('Prompt depth for intensity', () => {
  it('thorough intensity generates COMPREHENSIVE prompt', async () => {
    const capturedPrompt = { value: '' };
    const llmExecutor = {
      async execute(_providers: Provider[], prompt: string) {
        capturedPrompt.value = prompt;
        return [];
      }
    };

    const components = createComponents({ llmExecutor, config: { pathBasedIntensity: true } });
    const orchestrator = new ReviewOrchestrator(components);

    // PR with auth files triggers thorough
    await orchestrator.execute(1);

    expect(capturedPrompt.value).toContain('COMPREHENSIVE');
    expect(capturedPrompt.value).toContain('edge case');
  });
});
```

### Pattern 4: Performance Benchmarking
**What:** Measure and assert on execution time
**When to use:** Validating PathMatcher caching efficiency
**Example:**
```typescript
// Source: Derived from review-performance.benchmark.ts
describe('PathMatcher caching efficiency', () => {
  it('handles 1000+ files with efficient caching', async () => {
    const files = generateLargeFileSet(1000);
    const config = createDefaultPathMatcherConfig();
    config.enabled = true;

    const matcher = new PathMatcher(config);

    const start = performance.now();
    const result = matcher.determineIntensity(files);
    const duration = performance.now() - start;

    expect(result.intensity).toBeDefined();
    expect(duration).toBeLessThan(1000); // Sub-second for 1000 files

    // Second call should be faster due to caching
    const startCached = performance.now();
    matcher.determineIntensity(files);
    const durationCached = performance.now() - startCached;

    expect(durationCached).toBeLessThan(duration);
  });
});
```

### Anti-Patterns to Avoid
- **Testing implementation details:** Don't verify internal state; verify observable behavior through outputs
- **Flaky timing assertions:** Use relative comparisons (faster than X) not exact timing
- **Over-mocking:** Don't mock PathMatcher itself in integration tests; use real PathMatcher with mocked providers
- **Large file fixtures in git:** Generate test data programmatically, don't commit 1000-file fixtures

## Don't Hand-Roll

Problems that look simple but have existing solutions:

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| PR context creation | Custom fixtures | `createMockPRContext()` from helpers/github-mock.ts | Consistent, type-safe |
| Provider responses | Manual objects | Extend `Provider` class | Type safety, consistent interface |
| File generation | Static fixtures | `createMockFileChange()` helper | Maintainable, parameterizable |
| Timing measurement | Date.now() | performance.now() or jest.setTimeout() | Higher precision, built-in support |

**Key insight:** The existing test helpers in `__tests__/helpers/` provide battle-tested patterns for creating test fixtures.

## Common Pitfalls

### Pitfall 1: Testing Intensity in Isolation
**What goes wrong:** Unit tests for PathMatcher pass, but intensity doesn't affect actual provider selection
**Why it happens:** PathMatcher is tested separately from orchestrator integration
**How to avoid:** Integration tests must verify the full chain: config -> PathMatcher -> orchestrator -> provider selection
**Warning signs:** PathMatcher unit tests pass but live reviews don't respect intensity

### Pitfall 2: Hardcoded Provider Counts in Tests
**What goes wrong:** Tests assume specific provider counts that differ from DEFAULT_CONFIG
**Why it happens:** Magic numbers (8, 5, 3) copied instead of referencing config
**How to avoid:** Import from DEFAULT_CONFIG or use descriptive constants
**Warning signs:** Tests break when default intensity values change

### Pitfall 3: Missing filterHealthyProviders in Mock
**What goes wrong:** Tests skip health check step, hiding integration issues
**Why it happens:** Simplified mock doesn't implement full LLMExecutor interface
**How to avoid:** Stub `filterHealthyProviders` to return all providers as healthy
**Warning signs:** Production fails at health check step that tests skip

### Pitfall 4: Overlapping Pattern Precedence Not Tested
**What goes wrong:** Files matching multiple patterns get unpredictable intensity
**Why it happens:** Only simple cases tested, not pattern conflicts
**How to avoid:** Test file matching `src/auth/login.test.ts` (matches both auth=thorough and test=light)
**Warning signs:** Same file gets different intensity on different runs

### Pitfall 5: Performance Test Flakiness in CI
**What goes wrong:** Performance benchmarks pass locally, fail in CI
**Why it happens:** CI environments have variable CPU/memory
**How to avoid:** Use relative comparisons (cached faster than uncached) not absolute thresholds
**Warning signs:** Benchmark tests marked skip or have huge tolerances

## Code Examples

Verified patterns from existing codebase:

### Creating Test Components
```typescript
// Source: orchestrator.integration.test.ts pattern
function createTestComponents(overrides: Partial<ReviewComponents>): ReviewComponents {
  const config: ReviewConfig = {
    ...DEFAULT_CONFIG,
    pathBasedIntensity: true,
    pathDefaultIntensity: 'standard',
    ...overrides.config,
  };

  return {
    config,
    providerRegistry: new StubProviderRegistry() as any,
    llmExecutor: new StubLLMExecutor() as any,
    deduplicator: new Deduplicator(),
    consensus: new ConsensusEngine({
      minAgreement: 1,
      minSeverity: 'minor',
      maxComments: 100
    }),
    // ... other components from existing test
    ...overrides,
  };
}
```

### Creating Auth Files (Thorough Intensity)
```typescript
// Source: Derived from path-matcher.test.ts
function createAuthPR(): PRContext {
  return createMockPRContext({
    files: [
      createMockFileChange({ filename: 'src/auth/login.ts' }),
      createMockFileChange({ filename: 'src/auth/middleware/jwt.ts' }),
    ],
  });
}
```

### Creating Test Files (Light Intensity)
```typescript
// Source: Derived from path-matcher.test.ts
function createTestOnlyPR(): PRContext {
  return createMockPRContext({
    files: [
      createMockFileChange({ filename: 'src/app.test.ts' }),
      createMockFileChange({ filename: '__tests__/unit/utils.test.ts' }),
    ],
  });
}
```

### Generating Large File Sets for Performance
```typescript
// Source: Derived from review-performance.benchmark.ts
function generateLargeFileSet(count: number): FileChange[] {
  const files: FileChange[] = [];
  for (let i = 0; i < count; i++) {
    // Mix of different file types to test caching across patterns
    const variants = [
      `src/module${i}/index.ts`,
      `src/auth/handler${i}.ts`,
      `__tests__/unit/test${i}.test.ts`,
      `docs/page${i}.md`,
    ];
    const filename = variants[i % variants.length];
    files.push(createMockFileChange({ filename }));
  }
  return files;
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Separate unit tests only | Unit + integration tests | Established pattern | Full pipeline validation |
| Manual fixture files | Programmatic generation | Established pattern | Better maintainability |
| Absolute timing thresholds | Relative comparisons | Best practice | CI stability |

**Deprecated/outdated:**
- None identified - project uses modern Jest patterns

## Open Questions

Things that couldn't be fully resolved:

1. **Exact timeout tolerance for performance tests**
   - What we know: CI environments vary in speed
   - What's unclear: What multiplier is safe (2x? 5x baseline?)
   - Recommendation: Start with 5x local baseline, adjust based on CI runs

2. **Coverage threshold for integration tests**
   - What we know: Project has coverage configured
   - What's unclear: What % is expected for integration tests specifically
   - Recommendation: Focus on requirement coverage (TEST-01 through TEST-07), not line coverage

## Sources

### Primary (HIGH confidence)
- Existing codebase: `__tests__/integration/orchestrator.integration.test.ts`
- Existing codebase: `__tests__/benchmarks/review-performance.benchmark.ts`
- Existing codebase: `__tests__/unit/analysis/path-matcher.test.ts`
- Existing codebase: `__tests__/unit/core/intensity.test.ts`
- Existing codebase: `__tests__/helpers/github-mock.ts`
- Existing codebase: `src/core/orchestrator.ts` (intensity behavior lines 225-296, 577-600)
- Existing codebase: `src/config/defaults.ts` (intensity defaults)

### Secondary (MEDIUM confidence)
- [Testing in 2026: Jest, React Testing Library, and Full Stack Testing Strategies](https://www.nucamp.co/blog/testing-in-2026-jest-react-testing-library-and-full-stack-testing-strategies) - Testing pyramid patterns
- [Jest Performance Tuning](https://moldstud.com/articles/p-jest-performance-tuning-optimizing-your-test-suite-for-speed) - Optimization patterns
- [Jest Mocking Best Practices - Microsoft ISE](https://devblogs.microsoft.com/ise/jest-mocking-best-practices/) - Mock verification patterns

### Tertiary (LOW confidence)
- N/A - all key patterns verified against existing codebase

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - Jest already in use, patterns established
- Architecture: HIGH - Existing integration test patterns to follow
- Pitfalls: HIGH - Derived from codebase analysis and established testing wisdom

**Research date:** 2026-02-07
**Valid until:** 30 days (stable - Jest and codebase patterns well-established)
