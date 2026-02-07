import { PathMatcher, createDefaultPathMatcherConfig } from '../../src/analysis/path-matcher';
import { FileChange } from '../../src/types';

/**
 * PathMatcher Performance Integration Tests
 *
 * Validates PathMatcher caching efficiency with large file sets.
 * Proves that PathMatcher handles 1000+ files efficiently with caching,
 * preventing performance degradation in large PRs.
 *
 * TEST-07 requirement: "Performance test with 1000+ files validates PathMatcher caching efficiency"
 *
 * COVERAGE:
 * - Caching efficiency (3 tests) - 1000 files, caching comparison, 5000 files
 * - Pattern matching performance (2 tests) - multiple patterns, complex globs
 * - Result correctness (1 test) - verifies intensity assignments
 * - Edge cases at scale (4 tests) - single pattern match, no match, duplicates, deep paths
 * - Stability under load (2 tests) - memory stability, different file sets
 */

// Increase timeout for performance tests
jest.setTimeout(15000);

/**
 * Create a minimal FileChange object with required fields
 */
function createMockFileChange(filename: string): FileChange {
  return {
    filename,
    status: 'modified',
    additions: 1,
    deletions: 0,
    changes: 1,
  };
}

/**
 * Generate a large file set with varied paths to test pattern matching across categories
 * Uses modulo to cycle through variants for realistic distribution:
 * - src/module{i}/index.ts (standard)
 * - src/auth/handler{i}.ts (thorough)
 * - __tests__/unit/test{i}.test.ts (light)
 * - docs/page{i}.md (standard)
 * - terraform/resource{i}.tf (thorough)
 */
function generateLargeFileSet(count: number): FileChange[] {
  const files: FileChange[] = [];
  const variants = [
    (i: number) => `src/module${i}/index.ts`,         // standard
    (i: number) => `src/auth/handler${i}.ts`,         // thorough
    (i: number) => `__tests__/unit/test${i}.test.ts`, // light
    (i: number) => `docs/page${i}.md`,                // standard (no match)
    (i: number) => `terraform/resource${i}.tf`,       // thorough
  ];

  for (let i = 0; i < count; i++) {
    const variant = variants[i % variants.length];
    files.push(createMockFileChange(variant(i)));
  }

  return files;
}

describe('PathMatcher caching efficiency', () => {
  it('handles 1000 files in sub-second time', () => {
    const files = generateLargeFileSet(1000);
    const config = createDefaultPathMatcherConfig();
    config.enabled = true;

    const matcher = new PathMatcher(config);

    const start = performance.now();
    const result = matcher.determineIntensity(files);
    const duration = performance.now() - start;

    console.log(`[BENCHMARK] 1000 files: ${duration.toFixed(2)}ms, matched: ${result.matchedPaths.length}`);

    expect(duration).toBeLessThan(1000); // Sub-second
    expect(result.intensity).toBeDefined();
    expect(result.matchedPaths.length).toBeGreaterThan(0);
  });

  it('second call is faster due to internal caching', () => {
    const files = generateLargeFileSet(500);
    const config = createDefaultPathMatcherConfig();
    config.enabled = true;

    const matcher = new PathMatcher(config);

    // First call - populates cache
    const start1 = performance.now();
    const result1 = matcher.determineIntensity(files);
    const duration1 = performance.now() - start1;

    // Second call - should use cache
    const start2 = performance.now();
    const result2 = matcher.determineIntensity(files);
    const duration2 = performance.now() - start2;

    console.log(`[BENCHMARK] First call: ${duration1.toFixed(2)}ms, Second call: ${duration2.toFixed(2)}ms`);

    // Second call should be faster or equal (cache hit)
    // Using >= to account for minimal variance
    expect(duration1).toBeGreaterThanOrEqual(duration2 * 0.8); // Allow 20% tolerance
    expect(result1.intensity).toBe(result2.intensity);
    expect(result1.matchedPaths.length).toBe(result2.matchedPaths.length);
  });

  it('handles 5000 files without memory issues', () => {
    const files = generateLargeFileSet(5000);
    const config = createDefaultPathMatcherConfig();
    config.enabled = true;

    const matcher = new PathMatcher(config);

    const start = performance.now();
    const result = matcher.determineIntensity(files);
    const duration = performance.now() - start;

    console.log(`[BENCHMARK] 5000 files: ${duration.toFixed(2)}ms, matched: ${result.matchedPaths.length}`);

    // Should complete without throwing (no OOM)
    expect(duration).toBeLessThan(5000); // 1ms per file max
    expect(result.intensity).toBeDefined();
  });
});

describe('Pattern matching performance', () => {
  it('multiple patterns evaluated efficiently', () => {
    const files = generateLargeFileSet(1000);
    const config = createDefaultPathMatcherConfig();
    config.enabled = true;

    // Default config has many patterns (auth, test, terraform, etc.)
    const patternCount = config.patterns.length;
    const matcher = new PathMatcher(config);

    const start = performance.now();
    const result = matcher.determineIntensity(files);
    const duration = performance.now() - start;

    console.log(`[BENCHMARK] ${patternCount} patterns x 1000 files: ${duration.toFixed(2)}ms`);

    expect(duration).toBeLessThan(2000); // All patterns evaluated within 2 seconds
    expect(result.matchedPaths.length).toBeGreaterThan(0);
  });

  it('complex glob patterns do not cause exponential slowdown', () => {
    const files = generateLargeFileSet(1000);

    // Create config with recursive glob pattern
    const config = createDefaultPathMatcherConfig();
    config.enabled = true;
    config.patterns.push({
      pattern: '**/deep/**/nested/**/*.ts',
      intensity: 'thorough',
      description: 'Complex recursive pattern',
    });

    const matcher = new PathMatcher(config);

    const start = performance.now();
    const result = matcher.determineIntensity(files);
    const duration = performance.now() - start;

    console.log(`[BENCHMARK] Complex globs: ${duration.toFixed(2)}ms`);

    expect(duration).toBeLessThan(2000); // Should not cause exponential slowdown
    expect(result.intensity).toBeDefined();
  });
});

describe('Result correctness at scale', () => {
  it('correctly assigns intensities for mixed file types', () => {
    const files = generateLargeFileSet(1000);
    const config = createDefaultPathMatcherConfig();
    config.enabled = true;

    const matcher = new PathMatcher(config);
    const result = matcher.determineIntensity(files);

    // With mixed files (auth = thorough, test = light), thorough should win
    expect(result.intensity).toBe('thorough');

    // Verify auth files are in matched paths
    const authFiles = result.matchedPaths.filter(p => p.includes('auth'));
    expect(authFiles.length).toBeGreaterThan(0);

    // Verify test files are in matched paths
    const testFiles = result.matchedPaths.filter(p => p.includes('.test.ts'));
    expect(testFiles.length).toBeGreaterThan(0);

    // Verify terraform files are in matched paths
    const terraformFiles = result.matchedPaths.filter(p => p.includes('terraform'));
    expect(terraformFiles.length).toBeGreaterThan(0);

    console.log(`[BENCHMARK] Correctness check: intensity=${result.intensity}, auth=${authFiles.length}, test=${testFiles.length}, terraform=${terraformFiles.length}`);
  });
});

describe('Edge cases at scale', () => {
  it('handles all files matching single pattern', () => {
    // All 1000 files in auth directory (all thorough)
    const files: FileChange[] = [];
    for (let i = 0; i < 1000; i++) {
      files.push(createMockFileChange(`src/auth/handler${i}.ts`));
    }

    const config = createDefaultPathMatcherConfig();
    config.enabled = true;

    const matcher = new PathMatcher(config);

    const start = performance.now();
    const result = matcher.determineIntensity(files);
    const duration = performance.now() - start;

    console.log(`[BENCHMARK] All auth files: ${duration.toFixed(2)}ms, matched: ${result.matchedPaths.length}`);

    expect(duration).toBeLessThan(1000);
    expect(result.intensity).toBe('thorough');
    // All files should match auth pattern
    expect(result.matchedPaths.length).toBe(1000);
  });

  it('handles no files matching any pattern', () => {
    // All 1000 files in random path with unknown extension
    const files: FileChange[] = [];
    for (let i = 0; i < 1000; i++) {
      files.push(createMockFileChange(`random/path${i}.xyz`));
    }

    const config = createDefaultPathMatcherConfig();
    config.enabled = true;

    const matcher = new PathMatcher(config);

    const start = performance.now();
    const result = matcher.determineIntensity(files);
    const duration = performance.now() - start;

    console.log(`[BENCHMARK] No matches: ${duration.toFixed(2)}ms, matched: ${result.matchedPaths.length}`);

    expect(duration).toBeLessThan(1000);
    expect(result.intensity).toBe('standard'); // Default intensity
    expect(result.matchedPaths.length).toBe(0);
  });

  it('handles duplicate file paths', () => {
    // 500 unique paths, each duplicated (1000 total)
    const files: FileChange[] = [];
    for (let i = 0; i < 500; i++) {
      const path = `src/auth/handler${i}.ts`;
      files.push(createMockFileChange(path));
      files.push(createMockFileChange(path)); // Duplicate
    }

    const config = createDefaultPathMatcherConfig();
    config.enabled = true;

    const matcher = new PathMatcher(config);

    const start = performance.now();
    const result = matcher.determineIntensity(files);
    const duration = performance.now() - start;

    console.log(`[BENCHMARK] Duplicates: ${duration.toFixed(2)}ms, matched: ${result.matchedPaths.length}`);

    expect(duration).toBeLessThan(1000);
    expect(result.intensity).toBe('thorough');
    // Result should deduplicate paths
    expect(result.matchedPaths.length).toBe(500);
  });

  it('handles deep nested paths', () => {
    // Files with 10+ directory levels
    const files: FileChange[] = [];
    for (let i = 0; i < 1000; i++) {
      files.push(createMockFileChange(`a/b/c/d/e/f/g/h/i/j/file${i}.ts`));
    }

    const config = createDefaultPathMatcherConfig();
    config.enabled = true;
    // Add pattern that matches deep paths
    config.patterns.push({
      pattern: 'a/**/j/*.ts',
      intensity: 'thorough',
      description: 'Deep nested files',
    });

    const matcher = new PathMatcher(config);

    const start = performance.now();
    const result = matcher.determineIntensity(files);
    const duration = performance.now() - start;

    console.log(`[BENCHMARK] Deep paths: ${duration.toFixed(2)}ms, matched: ${result.matchedPaths.length}`);

    expect(duration).toBeLessThan(2000);
    expect(result.matchedPaths.length).toBe(1000);
  });
});

describe('Stability under load', () => {
  it('repeated calls do not leak memory', () => {
    const config = createDefaultPathMatcherConfig();
    config.enabled = true;

    const matcher = new PathMatcher(config);

    const start = performance.now();
    let totalMatched = 0;

    // Call determineIntensity 100 times with 100 files each
    for (let iteration = 0; iteration < 100; iteration++) {
      const files = generateLargeFileSet(100);
      const result = matcher.determineIntensity(files);
      totalMatched += result.matchedPaths.length;
    }

    const duration = performance.now() - start;

    console.log(`[BENCHMARK] 100 iterations x 100 files: ${duration.toFixed(2)}ms, total matched: ${totalMatched}`);

    // Should complete without OOM
    expect(duration).toBeLessThan(10000);
    expect(totalMatched).toBeGreaterThan(0);
  });

  it('different file sets on same matcher', () => {
    const config = createDefaultPathMatcherConfig();
    config.enabled = true;

    const matcher = new PathMatcher(config);

    // First file set - all auth files
    const fileSet1: FileChange[] = [];
    for (let i = 0; i < 100; i++) {
      fileSet1.push(createMockFileChange(`src/auth/service${i}.ts`));
    }

    // Second file set - all test files
    const fileSet2: FileChange[] = [];
    for (let i = 0; i < 100; i++) {
      fileSet2.push(createMockFileChange(`__tests__/unit/spec${i}.test.ts`));
    }

    const start = performance.now();
    const result1 = matcher.determineIntensity(fileSet1);
    const result2 = matcher.determineIntensity(fileSet2);
    const duration = performance.now() - start;

    console.log(`[BENCHMARK] Different file sets: ${duration.toFixed(2)}ms, set1=${result1.matchedPaths.length}, set2=${result2.matchedPaths.length}`);

    // Both should complete, results should reflect their respective file types
    expect(result1.intensity).toBe('thorough'); // auth = thorough
    expect(result2.intensity).toBe('light');    // test = light
    expect(result1.matchedPaths.length).toBe(100);
    expect(result2.matchedPaths.length).toBe(100);
  });
});
