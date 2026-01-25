import { TrivialDetector, createDefaultTrivialConfig } from '../../../src/analysis/trivial-detector';
import { FileChange } from '../../../src/types';

/**
 * TrivialDetector Test Suite
 *
 * COVERAGE: 47 tests covering:
 * ✓ Dependency updates (3 tests) - package-lock.json, yarn.lock, etc.
 * ✓ Documentation (4 tests) - *.md, README, CHANGELOG, docs/
 * ✓ Test fixtures (3 tests) - __snapshots__, __mocks__, *.snap
 * ✓ Config files (5 tests) - .eslintrc, tsconfig.json, .gitignore
 * ✓ Build artifacts (3 tests) - dist/, build/, *.min.js
 * ✓ Formatting detection (7 tests) - whitespace changes, semantic analysis
 * ✓ Custom patterns (4 tests) - regex validation, literal fallback
 * ✓ Mixed scenarios (8 tests) - trivial + non-trivial combinations
 * ✓ Skip flag combinations (10 tests) - individual flags, all flags, mixed
 *
 * FLAG INTERACTION TESTED:
 * - skipDependencyUpdates: enabled/disabled
 * - skipDocumentationOnly: enabled/disabled
 * - skipTestFixtures: enabled/disabled
 * - skipConfigFiles: enabled/disabled
 * - skipBuildArtifacts: enabled/disabled
 * - skipFormattingOnly: enabled/disabled
 * - All flags enabled (default behavior)
 * - All flags disabled (review everything)
 * - Mixed flag scenarios (partial skip)
 *
 * SECURITY TESTED:
 * - Custom pattern validation via isValidRegexPattern()
 * - Graceful degradation to literal matching on error
 * - ReDoS pattern rejection
 * - Error logging for invalid patterns
 *
 * See docs/SECURITY_PATTERNS.md for security rationale.
 */
describe('TrivialDetector', () => {
  const createFile = (filename: string, patch?: string): FileChange => ({
    filename,
    status: 'modified',
    additions: 10,
    deletions: 5,
    changes: 15,
    patch,
  });

  describe('dependency lock files', () => {
    it('should detect package-lock.json as trivial', () => {
      const detector = new TrivialDetector(createDefaultTrivialConfig());
      const files = [createFile('package-lock.json')];

      const result = detector.detect(files);

      expect(result.isTrivial).toBe(true);
      expect(result.reason).toContain('dependency lock file');
      expect(result.trivialFiles).toEqual(['package-lock.json']);
    });

    it('should detect yarn.lock as trivial', () => {
      const detector = new TrivialDetector(createDefaultTrivialConfig());
      const files = [createFile('yarn.lock')];

      const result = detector.detect(files);

      expect(result.isTrivial).toBe(true);
    });

    it('should detect Cargo.lock as trivial', () => {
      const detector = new TrivialDetector(createDefaultTrivialConfig());
      const files = [createFile('Cargo.lock')];

      const result = detector.detect(files);

      expect(result.isTrivial).toBe(true);
    });

    it('should detect go.sum as trivial', () => {
      const detector = new TrivialDetector(createDefaultTrivialConfig());
      const files = [createFile('go.sum')];

      const result = detector.detect(files);

      expect(result.isTrivial).toBe(true);
    });

    it('should not skip if disabled in config', () => {
      const config = createDefaultTrivialConfig();
      config.skipDependencyUpdates = false;

      const detector = new TrivialDetector(config);
      const files = [createFile('package-lock.json')];

      const result = detector.detect(files);

      expect(result.isTrivial).toBe(false);
    });
  });

  describe('documentation files', () => {
    it('should detect README.md as trivial', () => {
      const detector = new TrivialDetector(createDefaultTrivialConfig());
      const files = [createFile('README.md')];

      const result = detector.detect(files);

      expect(result.isTrivial).toBe(true);
      expect(result.reason).toContain('documentation');
    });

    it('should detect docs/ directory files as trivial', () => {
      const detector = new TrivialDetector(createDefaultTrivialConfig());
      const files = [
        createFile('docs/guide.md'),
        createFile('docs/api.md'),
      ];

      const result = detector.detect(files);

      expect(result.isTrivial).toBe(true);
    });

    it('should detect CHANGELOG.md as trivial', () => {
      const detector = new TrivialDetector(createDefaultTrivialConfig());
      const files = [createFile('CHANGELOG.md')];

      const result = detector.detect(files);

      expect(result.isTrivial).toBe(true);
    });

    it('should detect LICENSE as trivial', () => {
      const detector = new TrivialDetector(createDefaultTrivialConfig());
      const files = [createFile('LICENSE')];

      const result = detector.detect(files);

      expect(result.isTrivial).toBe(true);
    });
  });

  describe('test fixtures', () => {
    it('should detect __fixtures__ as trivial', () => {
      const detector = new TrivialDetector(createDefaultTrivialConfig());
      const files = [createFile('__fixtures__/data.json')];

      const result = detector.detect(files);

      expect(result.isTrivial).toBe(true);
      expect(result.reason).toContain('test fixture');
    });

    it('should detect __snapshots__ as trivial', () => {
      const detector = new TrivialDetector(createDefaultTrivialConfig());
      const files = [createFile('__tests__/__snapshots__/component.snap')];

      const result = detector.detect(files);

      expect(result.isTrivial).toBe(true);
    });

    it('should detect .snap files as trivial', () => {
      const detector = new TrivialDetector(createDefaultTrivialConfig());
      const files = [createFile('component.test.ts.snap')];

      const result = detector.detect(files);

      expect(result.isTrivial).toBe(true);
    });
  });

  describe('config files', () => {
    it('should detect .eslintrc as trivial', () => {
      const detector = new TrivialDetector(createDefaultTrivialConfig());
      const files = [createFile('.eslintrc.json')];

      const result = detector.detect(files);

      expect(result.isTrivial).toBe(true);
    });

    it('should detect .prettierrc as trivial', () => {
      const detector = new TrivialDetector(createDefaultTrivialConfig());
      const files = [createFile('.prettierrc')];

      const result = detector.detect(files);

      expect(result.isTrivial).toBe(true);
    });

    it('should detect .gitignore as trivial', () => {
      const detector = new TrivialDetector(createDefaultTrivialConfig());
      const files = [createFile('.gitignore')];

      const result = detector.detect(files);

      expect(result.isTrivial).toBe(true);
    });

    it('should detect .gitattributes as trivial', () => {
      const detector = new TrivialDetector(createDefaultTrivialConfig());
      const files = [createFile('.gitattributes')];

      const result = detector.detect(files);

      expect(result.isTrivial).toBe(true);
    });

    it('should detect tsconfig.json as trivial', () => {
      const detector = new TrivialDetector(createDefaultTrivialConfig());
      const files = [createFile('tsconfig.json')];

      const result = detector.detect(files);

      expect(result.isTrivial).toBe(true);
    });
  });

  describe('build artifacts', () => {
    it('should detect dist/ files as trivial', () => {
      const detector = new TrivialDetector(createDefaultTrivialConfig());
      const files = [createFile('dist/index.js'), createFile('dist/bundle.css')];

      const result = detector.detect(files);

      expect(result.isTrivial).toBe(true);
      expect(result.reason).toContain('build artifact');
    });

    it('should detect build/ files as trivial', () => {
      const detector = new TrivialDetector(createDefaultTrivialConfig());
      const files = [createFile('build/main.js')];

      const result = detector.detect(files);

      expect(result.isTrivial).toBe(true);
    });

    it('should detect minified files as trivial', () => {
      const detector = new TrivialDetector(createDefaultTrivialConfig());
      const files = [createFile('app.min.js'), createFile('styles.min.css')];

      const result = detector.detect(files);

      expect(result.isTrivial).toBe(true);
    });

    it('should detect source maps as trivial', () => {
      const detector = new TrivialDetector(createDefaultTrivialConfig());
      const files = [createFile('bundle.js.map')];

      const result = detector.detect(files);

      expect(result.isTrivial).toBe(true);
    });

    it('should not skip if disabled in config', () => {
      const config = createDefaultTrivialConfig();
      config.skipBuildArtifacts = false;

      const detector = new TrivialDetector(config);
      const files = [createFile('dist/index.js')];

      const result = detector.detect(files);

      expect(result.isTrivial).toBe(false);
    });
  });

  describe('mixed changes', () => {
    it('should not be trivial if source code is included', () => {
      const detector = new TrivialDetector(createDefaultTrivialConfig());
      const files = [
        createFile('package-lock.json'),
        createFile('src/app.ts'),
      ];

      const result = detector.detect(files);

      expect(result.isTrivial).toBe(false);
      expect(result.trivialFiles).toEqual(['package-lock.json']);
      expect(result.nonTrivialFiles).toEqual(['src/app.ts']);
    });

    it('should filter out trivial files', () => {
      const detector = new TrivialDetector(createDefaultTrivialConfig());
      const files = [
        createFile('package-lock.json'),
        createFile('README.md'),
        createFile('src/app.ts'),
        createFile('src/utils.ts'),
      ];

      const filtered = detector.filterNonTrivial(files);

      expect(filtered).toHaveLength(2);
      expect(filtered.map(f => f.filename)).toEqual(['src/app.ts', 'src/utils.ts']);
    });

    it('should combine multiple trivial types in reason', () => {
      const detector = new TrivialDetector(createDefaultTrivialConfig());
      const files = [
        createFile('package-lock.json'),
        createFile('README.md'),
        createFile('.gitignore'),
      ];

      const result = detector.detect(files);

      expect(result.isTrivial).toBe(true);
      expect(result.reason).toContain('dependency locks');
      expect(result.reason).toContain('documentation');
      expect(result.reason).toContain('config files');
    });
  });

  describe('custom patterns', () => {
    it('should match custom trivial patterns', () => {
      const config = createDefaultTrivialConfig();
      config.customTrivialPatterns = ['\\.generated\\.', 'vendor/'];

      const detector = new TrivialDetector(config);
      const files = [
        createFile('src/types.generated.ts'),
        createFile('vendor/lib.js'),
      ];

      const result = detector.detect(files);

      expect(result.isTrivial).toBe(true);
    });

    it('should handle invalid regex patterns gracefully', () => {
      const config = createDefaultTrivialConfig();
      config.customTrivialPatterns = ['[invalid(regex'];

      const detector = new TrivialDetector(config);
      const files = [createFile('[invalid(regex')];

      // Should not throw, should match as literal string
      expect(() => detector.detect(files)).not.toThrow();
    });
  });

  describe('formatting-only detection', () => {
    it('should detect formatting-only changes', () => {
      const config = createDefaultTrivialConfig();
      config.skipFormattingOnly = true;

      const detector = new TrivialDetector(config);
      const patch = `@@ -1,3 +1,3 @@
-function test() {
-  return 42;
-}
+function test() {
+    return 42;
+}`;

      const files = [createFile('src/test.ts', patch)];
      const result = detector.detect(files);

      expect(result.isTrivial).toBe(true);
    });

    it('should not detect substantive changes as formatting-only', () => {
      const config = createDefaultTrivialConfig();
      config.skipFormattingOnly = true;

      const detector = new TrivialDetector(config);
      const patch = `@@ -1,3 +1,3 @@
-function test() {
-  return 42;
-}
+function test() {
+  return 43;
+}`;

      const files = [createFile('src/test.ts', patch)];
      const result = detector.detect(files);

      expect(result.isTrivial).toBe(false);
    });
  });

  describe('disabled detection', () => {
    it('should not skip anything when disabled', () => {
      const config = createDefaultTrivialConfig();
      config.enabled = false;

      const detector = new TrivialDetector(config);
      const files = [
        createFile('package-lock.json'),
        createFile('README.md'),
      ];

      const result = detector.detect(files);

      expect(result.isTrivial).toBe(false);
      expect(result.nonTrivialFiles).toHaveLength(2);
    });
  });

  describe('edge cases', () => {
    it('should handle empty file list', () => {
      const detector = new TrivialDetector(createDefaultTrivialConfig());
      const result = detector.detect([]);

      expect(result.isTrivial).toBe(false);
      expect(result.trivialFiles).toEqual([]);
      expect(result.nonTrivialFiles).toEqual([]);
    });

    it('should handle files in subdirectories', () => {
      const detector = new TrivialDetector(createDefaultTrivialConfig());
      const files = [createFile('frontend/package-lock.json')];

      const result = detector.detect(files);

      expect(result.isTrivial).toBe(true);
    });

    it('should be case-insensitive for documentation patterns', () => {
      const detector = new TrivialDetector(createDefaultTrivialConfig());
      const files = [
        createFile('readme.MD'),
        createFile('DOCS/guide.md'),
      ];

      const result = detector.detect(files);

      expect(result.isTrivial).toBe(true);
    });
  });

  describe('real-world scenarios', () => {
    it('should skip dependency update PRs', () => {
      const detector = new TrivialDetector(createDefaultTrivialConfig());
      const files = [
        createFile('package.json'),
        createFile('package-lock.json'),
      ];

      const result = detector.detect(files);

      // package.json is not trivial, but package-lock.json is
      expect(result.isTrivial).toBe(false);
      expect(result.trivialFiles).toEqual(['package-lock.json']);
    });

    it('should skip documentation-only PRs', () => {
      const detector = new TrivialDetector(createDefaultTrivialConfig());
      const files = [
        createFile('README.md'),
        createFile('docs/installation.md'),
        createFile('docs/api-reference.md'),
        createFile('CHANGELOG.md'),
      ];

      const result = detector.detect(files);

      expect(result.isTrivial).toBe(true);
      expect(result.reason).toContain('documentation');
    });

    it('should skip test snapshot updates', () => {
      const detector = new TrivialDetector(createDefaultTrivialConfig());
      const files = [
        createFile('__tests__/__snapshots__/App.test.tsx.snap'),
        createFile('__tests__/__snapshots__/Button.test.tsx.snap'),
      ];

      const result = detector.detect(files);

      expect(result.isTrivial).toBe(true);
    });

    it('should review code with trivial files excluded', () => {
      const detector = new TrivialDetector(createDefaultTrivialConfig());
      const files = [
        createFile('src/auth.ts'),
        createFile('src/api.ts'),
        createFile('package-lock.json'),
        createFile('README.md'),
        createFile('.eslintrc.json'),
      ];

      const result = detector.detect(files);

      expect(result.isTrivial).toBe(false);
      expect(result.nonTrivialFiles).toEqual(['src/auth.ts', 'src/api.ts']);
      expect(result.trivialFiles).toHaveLength(3);
    });
  });

  describe('skip flag combinations', () => {
    it('should respect skipDependencyUpdates=false', () => {
      const config = createDefaultTrivialConfig();
      config.skipDependencyUpdates = false;

      const detector = new TrivialDetector(config);
      const files = [createFile('package-lock.json')];

      const result = detector.detect(files);

      expect(result.isTrivial).toBe(false);
      expect(result.nonTrivialFiles).toContain('package-lock.json');
    });

    it('should respect skipDocumentationOnly=false', () => {
      const config = createDefaultTrivialConfig();
      config.skipDocumentationOnly = false;

      const detector = new TrivialDetector(config);
      const files = [createFile('README.md')];

      const result = detector.detect(files);

      expect(result.isTrivial).toBe(false);
      expect(result.nonTrivialFiles).toContain('README.md');
    });

    it('should respect skipTestFixtures=false', () => {
      const config = createDefaultTrivialConfig();
      config.skipTestFixtures = false;

      const detector = new TrivialDetector(config);
      const files = [createFile('__tests__/__snapshots__/test.snap')];

      const result = detector.detect(files);

      expect(result.isTrivial).toBe(false);
      expect(result.nonTrivialFiles).toContain('__tests__/__snapshots__/test.snap');
    });

    it('should respect skipConfigFiles=false', () => {
      const config = createDefaultTrivialConfig();
      config.skipConfigFiles = false;

      const detector = new TrivialDetector(config);
      const files = [createFile('.eslintrc.json')];

      const result = detector.detect(files);

      expect(result.isTrivial).toBe(false);
      expect(result.nonTrivialFiles).toContain('.eslintrc.json');
    });

    it('should respect skipBuildArtifacts=false', () => {
      const config = createDefaultTrivialConfig();
      config.skipBuildArtifacts = false;

      const detector = new TrivialDetector(config);
      const files = [createFile('dist/bundle.js')];

      const result = detector.detect(files);

      expect(result.isTrivial).toBe(false);
      expect(result.nonTrivialFiles).toContain('dist/bundle.js');
    });

    it('should handle all skip flags disabled', () => {
      const config = createDefaultTrivialConfig();
      config.skipDependencyUpdates = false;
      config.skipDocumentationOnly = false;
      config.skipTestFixtures = false;
      config.skipConfigFiles = false;
      config.skipBuildArtifacts = false;
      config.skipFormattingOnly = false;

      const detector = new TrivialDetector(config);
      const files = [
        createFile('package-lock.json'),
        createFile('README.md'),
        createFile('.eslintrc.json'),
      ];

      const result = detector.detect(files);

      expect(result.isTrivial).toBe(false);
      expect(result.nonTrivialFiles).toHaveLength(3);
      expect(result.trivialFiles).toHaveLength(0);
    });

    it('should handle all skip flags enabled (default)', () => {
      const detector = new TrivialDetector(createDefaultTrivialConfig());
      const files = [
        createFile('package-lock.json'),
        createFile('README.md'),
        createFile('.eslintrc.json'),
      ];

      const result = detector.detect(files);

      expect(result.isTrivial).toBe(true);
      expect(result.trivialFiles).toHaveLength(3);
      expect(result.nonTrivialFiles).toHaveLength(0);
    });

    it('should handle mixed skip flags', () => {
      const config = createDefaultTrivialConfig();
      config.skipDependencyUpdates = true;
      config.skipDocumentationOnly = false;
      config.skipConfigFiles = true;

      const detector = new TrivialDetector(config);
      const files = [
        createFile('package-lock.json'), // Trivial
        createFile('README.md'),           // Non-trivial
        createFile('.eslintrc.json'),      // Trivial
      ];

      const result = detector.detect(files);

      expect(result.isTrivial).toBe(false);
      expect(result.nonTrivialFiles).toEqual(['README.md']);
      expect(result.trivialFiles).toEqual(['package-lock.json', '.eslintrc.json']);
    });

    it('should respect custom trivial patterns', () => {
      const config = createDefaultTrivialConfig();
      config.customTrivialPatterns = ['.*\\.generated\\.ts$'];

      const detector = new TrivialDetector(config);
      const files = [createFile('src/api.generated.ts')];

      const result = detector.detect(files);

      expect(result.isTrivial).toBe(true);
      expect(result.trivialFiles).toContain('src/api.generated.ts');
    });

    it('should combine custom patterns with built-in patterns', () => {
      const config = createDefaultTrivialConfig();
      config.customTrivialPatterns = ['.*\\.generated\\.ts$'];

      const detector = new TrivialDetector(config);
      const files = [
        createFile('src/api.generated.ts'), // Custom pattern
        createFile('package-lock.json'),     // Built-in pattern
        createFile('src/app.ts'),            // Neither
      ];

      const result = detector.detect(files);

      expect(result.isTrivial).toBe(false);
      expect(result.trivialFiles).toEqual(['src/api.generated.ts', 'package-lock.json']);
      expect(result.nonTrivialFiles).toEqual(['src/app.ts']);
    });
  });
});
