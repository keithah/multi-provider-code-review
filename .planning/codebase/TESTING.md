# Testing Patterns

**Analysis Date:** 2026-02-04

## Test Framework

**Runner:**
- Jest 29.7.0 (TypeScript-enabled via ts-jest)
- Config: `jest.config.js`
- Preset: `ts-jest` (automatically transpiles TypeScript)

**Assertion Library:**
- Jest built-in matchers: `expect(value).toBe()`, `expect(array).toHaveLength()`, etc.
- Custom matchers: None (Jest defaults sufficient)

**Run Commands:**
```bash
npm run test                  # Run all tests
npm run test:unit            # Run unit tests (exclude integration/benchmarks)
npm run test:coverage        # Run with coverage report
npm run benchmark            # Run benchmark tests
npm run lint                 # Check for linting errors
npm run format:check         # Check formatting
npm run format               # Auto-fix formatting
```

## Test File Organization

**Location:**
- Co-located with source: Tests in `__tests__/unit/` subdirectories mirroring `src/` structure
- Pattern: `__tests__/unit/{category}/{module}.test.ts` maps to `src/{category}/{module}.ts`
- Examples:
  - `__tests__/unit/analysis/path-matcher.test.ts` → `src/analysis/path-matcher.ts`
  - `__tests__/unit/core/orchestrator.test.ts` → `src/core/orchestrator.ts`
  - `__tests__/unit/providers/circuit-breaker.test.ts` → `src/providers/circuit-breaker.ts`

**Naming:**
- Test files end with `.test.ts` (not `.spec.ts`)
- Describe blocks match file/module name: `describe('PathMatcher', ...)` for `path-matcher.test.ts`
- Helper utilities in `__tests__/helpers/` (not covered by default test pattern)

**Test Counts:**
- Total: 69 test files with 755 tests
- Coverage: ~80% overall (varies by module)
- Comprehensive coverage in critical paths: path-matcher (30 tests), trivial-detector (47 tests), finding-filter (extensive)

## Test Structure

**Suite Organization:**
```typescript
describe('ModuleName', () => {
  let instance: ClassUnderTest;

  beforeEach(() => {
    // Setup before each test
    instance = new ClassUnderTest(config);
  });

  afterEach(() => {
    // Cleanup after each test (rarely needed)
    jest.clearAllMocks();
  });

  describe('methodName', () => {
    it('should do specific thing', () => {
      // Arrange
      const input = { test: 'data' };

      // Act
      const result = instance.methodName(input);

      // Assert
      expect(result).toEqual(expectedValue);
    });

    it('should handle edge case', () => {
      // ...
    });
  });

  describe('anotherMethod', () => {
    // More tests
  });
});
```

**Patterns Observed:**
- Nested `describe()` blocks group related tests by method/feature
- One assertion focus per test (or related assertions for same behavior)
- Descriptive test names: `'should filter out documentation formatting issues'` not `'works'`
- Setup in `beforeEach()`, rarely need `afterEach()`

## Mocking

**Framework:** Jest built-in mocking

**Patterns:**

Setup file (`jest.setup.ts`) provides global mocks:
```typescript
jest.mock('p-queue', () => {
  return {
    __esModule: true,
    default: class {
      constructor(public opts: any = {}) {}
      add<T>(fn: () => Promise<T>): Promise<T> { return fn(); }
      onIdle(): Promise<void> { return Promise.resolve(); }
    },
  };
});

jest.mock('p-retry', () => {
  class FailedAttemptError extends Error {
    attemptNumber = 1;
  }
  return {
    __esModule: true,
    default: async (fn: any) => fn(),
    FailedAttemptError,
  };
});
```

**Per-Test Mocking:**
```typescript
jest.mock('module-name');
const mockModule = require('module-name');

// Mock function calls
jest.fn();                              // Create spy function
jest.fn().mockResolvedValue(value);     // Return resolved promise
jest.fn().mockRejectedValue(error);     // Return rejected promise
jest.fn().mockImplementation(impl);     // Custom implementation

// Partial mocks
const mockProvider = {
  name: 'test-provider',
  review: jest.fn(),
  healthCheck: jest.fn(),
} as unknown as Provider;
```

**What to Mock:**
- External APIs/providers (network calls)
- Time-dependent code (Date, timers) — rarely done, use real time
- Complex dependencies not under test
- File system (fs module)
- GitHub API calls (use nock for HTTP mocking)

**What NOT to Mock:**
- Pure utility functions
- Custom domain logic being tested
- Data transformers/parsers
- Error handling paths
- Internal class methods (test through public API)

**Global Mocks (in `jest.setup.ts`):**
- `p-queue`: Mocked to run synchronously (no queuing in tests)
- `p-retry`: Mocked to run once without retry logic
- `process.exitCode`: Reset to 0 after all tests (allows Jest to exit cleanly)

## Fixtures and Factories

**Test Data:**

Factory functions create test data:
```typescript
const createFile = (filename: string): FileChange => ({
  filename,
  status: 'modified',
  additions: 10,
  deletions: 5,
  changes: 15,
});

const makeFiles = (count: number): FileChange[] =>
  Array.from({ length: count }).map((_, idx) => ({
    filename: `file-${idx}.ts`,
    status: 'modified',
    additions: 1,
    deletions: 0,
    changes: 1,
  }));

const emptyReview = {
  summary: '',
  findings: [],
  inlineComments: [],
  actionItems: [],
  metrics: { /* ... */ },
};
```

**Location:**
- Inline in test file: `const createFile = (filename) => ({ ... })`
- Shared helpers in `__tests__/helpers/` when used across multiple test suites
- Factories as functions, not classes (lightweight, immutable)

## Coverage

**Requirements:**
- Target: ~80% overall (high-value code >90%, less critical areas >70%)
- Current: 80% statement coverage, 70% branch coverage, 85% line coverage
- High-coverage modules:
  - `src/types/index.ts`: 100%
  - `src/security/scanner.ts`: 100%
  - `src/utils/parallel.ts`: 100%
  - `src/utils/sanitize.ts`: 90%
  - `src/utils/retry.ts`: 95%

**Lower Coverage Areas (acceptable):**
- `src/plugins/plugin-loader.ts`: 4.8% (not commonly used, plugin system)
- `src/providers/reliability-tracker.ts`: 35% (complex analytics)
- `src/providers/claude-code.ts`, `codex.ts`, `gemini.ts`: ~10% (deprecated/not used)

**View Coverage:**
```bash
npm run test:coverage
# Generates coverage/lcov-report/index.html for browsing
# Coverage output printed to console as table
```

## Test Types

**Unit Tests:**
- Scope: Single class/function in isolation
- Location: `__tests__/unit/**/*.test.ts`
- Mocking: Extensive mocking of dependencies
- Speed: Very fast (<100ms per test)
- Examples:
  - `path-matcher.test.ts`: Tests PathMatcher class methods
  - `batch-orchestrator.test.ts`: Tests batch creation logic
  - `finding-filter.test.ts`: Tests finding filtering/severity adjustments

**Integration Tests:**
- Scope: Multiple components working together
- Location: `__tests__/integration/**/*.test.ts`
- Mocking: Real components, mock only external APIs
- Speed: Slower (1-5s per test) due to component setup
- Examples:
  - `orchestrator.integration.test.ts`: Tests full review orchestration
  - Cache + incremental update workflows
  - LLM executor with mock providers

**Benchmark Tests:**
- Scope: Performance measurement
- Location: `__tests__/benchmarks/**/*.bench.ts`
- Pattern: Time-based or iteration-based benchmarks
- Run with: `npm run benchmark`
- Examples: Graph builder incremental updates, pattern matching performance

**E2E Tests:**
- Status: Not used (GitHub Actions integration is manual)
- Rationale: Action itself tested via manual GitHub workflow validation

## Common Patterns

**Async Testing:**
```typescript
// Jest automatically handles async tests
it('should load providers', async () => {
  const result = await orchestrator.loadProviders();
  expect(result).toHaveLength(3);
});

// Or use .then() style
it('should fetch data', () => {
  return instance.fetchData().then(data => {
    expect(data).toBeDefined();
  });
});
```

**Error Testing:**
```typescript
// Test that error is thrown
it('should throw validation error', () => {
  expect(() => {
    validatePattern('invalid');
  }).toThrow(ValidationError);
});

// Test error message/properties
it('should throw with helpful message', () => {
  expect(() => {
    validateRequired(null, 'field-name');
  }).toThrow(/field-name is required/);
});

// Test async error
it('should reject on timeout', async () => {
  await expect(provider.review(prompt, 1)).rejects.toThrow(/timeout/);
});
```

**Snapshot Testing:**
- Status: Not used (no `.toMatchSnapshot()` tests)
- Rationale: Prefer explicit assertions for clarity

## Timeout Configuration

**Default:** 10000ms (10 seconds) per test (set in `jest.config.js`)

**Per-Test Override:**
```typescript
it('slow async operation', async () => {
  // test code
}, 30000); // 30 second timeout for this specific test
```

**Why Long Timeout:**
- Provider health checks may take time
- Graph building on large codebases is slow
- Integration tests coordinate multiple components

## Test Execution

**Parallel Execution:**
- Default: Jest runs tests in parallel across multiple workers
- Tests that are independent run simultaneously
- Reduces overall test suite time significantly

**Exclude Patterns:**
- `!**/__tests__/helpers/**` — Helper utilities not run as tests
- Integration and benchmark tests excluded from `test:unit` run

**Watch Mode:**
```bash
npm test -- --watch
# Re-runs tests when files change
```

---

*Testing analysis: 2026-02-04*
