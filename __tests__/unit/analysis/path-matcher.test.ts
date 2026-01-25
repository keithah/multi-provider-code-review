import { PathMatcher, PathPattern, createDefaultPathMatcherConfig } from '../../../src/analysis/path-matcher';
import { FileChange } from '../../../src/types';

describe('PathMatcher', () => {
  const createFile = (filename: string): FileChange => ({
    filename,
    status: 'modified',
    additions: 10,
    deletions: 5,
    changes: 15,
  });

  describe('determineIntensity', () => {
    it('should return default intensity when disabled', () => {
      const matcher = new PathMatcher({
        enabled: false,
        defaultIntensity: 'standard',
        patterns: [],
      });

      const files = [createFile('src/auth/login.ts')];
      const result = matcher.determineIntensity(files);

      expect(result.intensity).toBe('standard');
      expect(result.matchedPaths).toHaveLength(0);
      expect(result.reason).toContain('disabled');
    });

    it('should return default intensity when no patterns configured', () => {
      const matcher = new PathMatcher({
        enabled: true,
        defaultIntensity: 'standard',
        patterns: [],
      });

      const files = [createFile('src/app.ts')];
      const result = matcher.determineIntensity(files);

      expect(result.intensity).toBe('standard');
      expect(result.matchedPaths).toHaveLength(0);
    });

    it('should detect thorough intensity for auth files', () => {
      const patterns: PathPattern[] = [
        {
          pattern: 'src/auth/**',
          intensity: 'thorough',
          description: 'Authentication code',
        },
      ];

      const matcher = new PathMatcher({
        enabled: true,
        defaultIntensity: 'standard',
        patterns,
      });

      const files = [
        createFile('src/auth/login.ts'),
        createFile('src/auth/middleware/jwt.ts'),
      ];

      const result = matcher.determineIntensity(files);

      expect(result.intensity).toBe('thorough');
      expect(result.matchedPaths).toHaveLength(2);
      expect(result.matchedPaths).toContain('src/auth/login.ts');
      expect(result.matchedPaths).toContain('src/auth/middleware/jwt.ts');
      expect(result.reason).toContain('thorough');
      expect(result.reason).toContain('Authentication code');
    });

    it('should detect light intensity for test files', () => {
      const patterns: PathPattern[] = [
        {
          pattern: '**/*.test.ts',
          intensity: 'light',
          description: 'Test files',
        },
      ];

      const matcher = new PathMatcher({
        enabled: true,
        defaultIntensity: 'standard',
        patterns,
      });

      const files = [
        createFile('src/app.test.ts'),
        createFile('src/utils/helper.test.ts'),
      ];

      const result = matcher.determineIntensity(files);

      expect(result.intensity).toBe('light');
      expect(result.matchedPaths).toHaveLength(2);
    });

    it('should choose highest intensity when multiple patterns match', () => {
      const patterns: PathPattern[] = [
        {
          pattern: 'src/**',
          intensity: 'standard',
        },
        {
          pattern: 'src/auth/**',
          intensity: 'thorough',
        },
        {
          pattern: '**/*.test.ts',
          intensity: 'light',
        },
      ];

      const matcher = new PathMatcher({
        enabled: true,
        defaultIntensity: 'light',
        patterns,
      });

      const files = [
        createFile('src/auth/login.ts'), // Matches thorough
        createFile('src/utils.ts'), // Matches standard
        createFile('src/app.test.ts'), // Matches light
      ];

      const result = matcher.determineIntensity(files);

      // Should choose thorough (highest)
      expect(result.intensity).toBe('thorough');
      expect(result.matchedPaths.length).toBeGreaterThan(0);
    });

    it('should use default intensity for non-matching files', () => {
      const patterns: PathPattern[] = [
        {
          pattern: 'src/auth/**',
          intensity: 'thorough',
        },
      ];

      const matcher = new PathMatcher({
        enabled: true,
        defaultIntensity: 'standard',
        patterns,
      });

      const files = [
        createFile('src/app.ts'),
        createFile('src/utils.ts'),
      ];

      const result = matcher.determineIntensity(files);

      expect(result.intensity).toBe('standard');
      expect(result.matchedPaths).toHaveLength(0);
    });
  });

  describe('glob pattern matching', () => {
    it('should match ** recursive patterns', () => {
      const patterns: PathPattern[] = [
        {
          pattern: '**/auth/**',
          intensity: 'thorough',
        },
      ];

      const matcher = new PathMatcher({
        enabled: true,
        defaultIntensity: 'standard',
        patterns,
      });

      const files = [
        createFile('src/auth/login.ts'),
        createFile('backend/auth/middleware.ts'),
        createFile('packages/core/auth/token.ts'),
      ];

      const result = matcher.determineIntensity(files);

      expect(result.intensity).toBe('thorough');
      expect(result.matchedPaths).toHaveLength(3);
    });

    it('should match * single segment wildcards', () => {
      const patterns: PathPattern[] = [
        {
          pattern: 'src/*.ts',
          intensity: 'thorough',
        },
      ];

      const matcher = new PathMatcher({
        enabled: true,
        defaultIntensity: 'standard',
        patterns,
      });

      const files = [
        createFile('src/app.ts'), // Match
        createFile('src/index.ts'), // Match
        createFile('src/utils/helper.ts'), // No match (nested)
      ];

      const result = matcher.determineIntensity(files);

      expect(result.matchedPaths).toHaveLength(2);
      expect(result.matchedPaths).not.toContain('src/utils/helper.ts');
    });

    it('should match exact paths', () => {
      const patterns: PathPattern[] = [
        {
          pattern: 'Dockerfile',
          intensity: 'thorough',
        },
      ];

      const matcher = new PathMatcher({
        enabled: true,
        defaultIntensity: 'standard',
        patterns,
      });

      const files = [
        createFile('Dockerfile'), // Match
        createFile('backend/Dockerfile'), // No match
      ];

      const result = matcher.determineIntensity(files);

      expect(result.matchedPaths).toHaveLength(1);
      expect(result.matchedPaths).toContain('Dockerfile');
    });

    it('should match file extension patterns', () => {
      const patterns: PathPattern[] = [
        {
          pattern: '*.Dockerfile',
          intensity: 'thorough',
        },
      ];

      const matcher = new PathMatcher({
        enabled: true,
        defaultIntensity: 'standard',
        patterns,
      });

      const files = [
        createFile('app.Dockerfile'),
        createFile('web.Dockerfile'),
        createFile('Dockerfile'), // No match
      ];

      const result = matcher.determineIntensity(files);

      expect(result.matchedPaths).toHaveLength(2);
    });
  });

  describe('default configuration', () => {
    it('should include critical security paths', () => {
      const config = createDefaultPathMatcherConfig();

      expect(config.patterns.some(p => p.pattern.includes('auth'))).toBe(true);
      expect(config.patterns.some(p => p.pattern.includes('payment'))).toBe(true);
      expect(config.patterns.some(p => p.pattern.includes('security'))).toBe(true);
    });

    it('should mark auth paths as thorough', () => {
      const config = createDefaultPathMatcherConfig();
      const authPatterns = config.patterns.filter(p => p.pattern.includes('auth'));

      authPatterns.forEach(pattern => {
        expect(pattern.intensity).toBe('thorough');
      });
    });

    it('should mark test paths as light', () => {
      const config = createDefaultPathMatcherConfig();
      const testPatterns = config.patterns.filter(p => p.pattern.includes('test'));

      testPatterns.forEach(pattern => {
        expect(pattern.intensity).toBe('light');
      });
    });

    it('should include infrastructure paths', () => {
      const config = createDefaultPathMatcherConfig();

      expect(config.patterns.some(p => p.pattern.includes('terraform'))).toBe(true);
      expect(config.patterns.some(p => p.pattern.includes('k8s'))).toBe(true);
      expect(config.patterns.some(p => p.pattern.includes('Dockerfile'))).toBe(true);
    });
  });

  describe('real-world scenarios', () => {
    it('should handle mixed intensity PR correctly', () => {
      const matcher = new PathMatcher(createDefaultPathMatcherConfig());
      const config = createDefaultPathMatcherConfig();
      config.enabled = true;

      const matcherEnabled = new PathMatcher(config);

      const files = [
        createFile('src/auth/login.ts'), // Thorough
        createFile('src/utils.ts'), // Standard
        createFile('src/app.test.ts'), // Light
        createFile('README.md'), // Standard
      ];

      const result = matcherEnabled.determineIntensity(files);

      // Thorough should win
      expect(result.intensity).toBe('thorough');
    });

    it('should handle PR with only tests', () => {
      const config = createDefaultPathMatcherConfig();
      config.enabled = true;

      const matcher = new PathMatcher(config);

      const files = [
        createFile('src/app.test.ts'),
        createFile('src/utils.test.ts'),
        createFile('__tests__/integration.test.ts'),
      ];

      const result = matcher.determineIntensity(files);

      expect(result.intensity).toBe('light');
    });

    it('should handle PR with critical infrastructure changes', () => {
      const config = createDefaultPathMatcherConfig();
      config.enabled = true;

      const matcher = new PathMatcher(config);

      const files = [
        createFile('terraform/main.tf'),
        createFile('k8s/deployment.yaml'),
        createFile('app.Dockerfile'),
      ];

      const result = matcher.determineIntensity(files);

      expect(result.intensity).toBe('thorough');
    });
  });
});
