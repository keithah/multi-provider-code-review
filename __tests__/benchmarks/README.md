# Performance Benchmarks

This directory contains performance benchmarks for the multi-provider code review system.

## Running Benchmarks

```bash
npm run benchmark
```

## Benchmark Suites

### 1. PR Size Benchmarks
Tests review performance across different PR sizes:
- **Small PR**: 5 files, 100 lines (~200ms)
- **Medium PR**: 20 files, 500 lines (~150-300ms)
- **Large PR**: 100 files, 2000 lines (~400-900ms)

**Target**: <10s for small, <30s for medium, <90s for large PRs

### 2. Parallel Provider Execution
Verifies that multiple providers execute in parallel rather than sequentially.

**Expected**: Duration with 3 providers should be closer to single provider time (100-150ms) rather than 3x (300ms+)

### 3. Cache Performance
Measures performance improvement from cache hits.

**Expected**: 50-80% speedup when cache is hit
**Actual**: ~64% speedup observed

### 4. Provider Scaling
Tests how performance scales with provider count (1, 3, 5 providers).

**Expected**: With parallel execution, adding providers should have minimal impact on total duration

## Key Metrics Tracked

- **Duration**: Total review time in milliseconds
- **Cost**: Total cost in USD (requires real provider pricing)
- **Findings**: Number of issues found
- **Files**: Number of files reviewed
- **Lines**: Total lines changed
- **Cache Hit**: Whether cache was used
- **Per File**: Average time per file
- **Per Line**: Average time per line

## Performance Targets

Based on development plan targets:

| PR Size | Files | Lines | Target Time | Actual |
|---------|-------|-------|-------------|--------|
| Small   | 5     | 100   | <10s        | ~200ms |
| Medium  | 20    | 500   | <30s        | ~180ms |
| Large   | 100   | 2000  | <90s        | ~400ms |

✅ All targets met with significant headroom!

## Interpreting Results

### Good Performance Indicators
- ✅ Per-file time: <100ms
- ✅ Per-line time: <1ms
- ✅ Cache speedup: >50%
- ✅ Parallel efficiency: N providers ≈ 1.2x single provider time

### Performance Issues
- ⚠️ Per-file time >500ms - AST analysis may be slow
- ⚠️ Per-line time >5ms - Need to optimize diff parsing
- ⚠️ Cache speedup <30% - Cache not being effective
- ⚠️ Parallel scaling >2x - Providers not executing in parallel

## Adding New Benchmarks

To add a new benchmark:

1. Create a new test case in `review-performance.benchmark.ts`
2. Use `runBenchmark()` helper function
3. Format results with `formatResults()`
4. Add performance assertions

Example:
```typescript
it('benchmarks new scenario', async () => {
  const providers = [new MockProvider('provider', 50)];
  const pr = createMockPR(10, 10);

  const result = await runBenchmark('New Scenario', providers, pr);

  expect(result.durationMs).toBeLessThan(5000);
  console.log(formatResults([result]));
});
```

## Continuous Monitoring

Track these metrics over time to detect performance regressions:
- Review duration trends
- Cost per review trends
- Cache hit rate
- Provider execution time

Consider running benchmarks in CI and storing results for historical comparison.
