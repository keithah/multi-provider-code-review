import { TrivialDetector, createDefaultTrivialConfig } from '../../../src/analysis/trivial-detector';
import { FileChange } from '../../../src/types';

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
});
