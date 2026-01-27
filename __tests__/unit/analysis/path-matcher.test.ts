import { PathMatcher, PathPattern, createDefaultPathMatcherConfig, MAX_PATTERN_LENGTH } from '../../../src/analysis/path-matcher';
import { FileChange } from '../../../src/types';

/**
 * PathMatcher Test Suite
 *
 * COVERAGE: 30 tests covering:
 * ✓ Core functionality (6 tests) - intensity determination, pattern matching
 * ✓ Glob patterns (4 tests) - **, *, exact, extensions
 * ✓ Default config (4 tests) - auth, test, infrastructure paths
 * ✓ Real-world scenarios (3 tests) - mixed intensity, test-only, critical PRs
 * ✓ Pattern validation (5 tests) - length, complexity, control chars
 * ✓ Caching behavior (2 tests) - deduplication, efficiency
 * ✓ Edge cases (6 tests) - empty lists, no matches, boundaries
 *
 * VALIDATION TESTED:
 * - Length limit: 500 characters (MAX_PATTERN_LENGTH)
 * - Complexity limit: score ≤ 50 (MAX_COMPLEXITY_SCORE)
 * - Control character rejection: 0x00-0x1F
 * - Boundary conditions: exactly at limits (500 chars, score 50)
 * - Over-limit rejection: 501+ chars, score 51+
 *
 * SECURITY TESTED:
 * - ReDoS prevention via minimatch library
 * - Pattern injection prevention via validation
 * - Control character filtering
 *
 * See docs/SECURITY_PATTERNS.md for security rationale.
 */
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

  describe('pattern validation', () => {
    it('should reject patterns that are too long', () => {
      const longPattern = 'a'.repeat(MAX_PATTERN_LENGTH + 100); // 600 chars

      expect(() => {
        new PathMatcher({
          enabled: true,
          defaultIntensity: 'standard',
          patterns: [{ pattern: longPattern, intensity: 'thorough' }],
        });
      }).toThrow(/too long/i);
    });

    it('should reject patterns that are too complex', () => {
      // Pattern with excessive wildcards and braces (score > MAX_COMPLEXITY_SCORE)
      // 30 wildcards * 2 + 5 braces * 3 = 75 (exceeds limit of 50)
      const complexPattern = '**/*/**/*/**/*/**/*/**/*/**/*/**/*/**/*/**/*/{a,b,c}/{d,e,f}/{g,h,i}/{j,k}/**/*';

      expect(() => {
        new PathMatcher({
          enabled: true,
          defaultIntensity: 'standard',
          patterns: [{ pattern: complexPattern, intensity: 'thorough' }],
        });
      }).toThrow(/too complex/i);
    });

    it('should reject patterns with control characters', () => {
      const badPattern = 'src/\x00evil/**';

      expect(() => {
        new PathMatcher({
          enabled: true,
          defaultIntensity: 'standard',
          patterns: [{ pattern: badPattern, intensity: 'thorough' }],
        });
      }).toThrow(/control characters/i);
    });

    it('should accept valid patterns', () => {
      expect(() => {
        new PathMatcher({
          enabled: true,
          defaultIntensity: 'standard',
          patterns: [
            { pattern: 'src/auth/**', intensity: 'thorough' },
            { pattern: '**/*.test.ts', intensity: 'light' },
            { pattern: '{a,b,c}/**', intensity: 'standard' },
          ],
        });
      }).not.toThrow();
    });
  });

  describe('pattern caching', () => {
    it('should cache pattern matching results', () => {
      const patterns: PathPattern[] = [
        { pattern: 'src/**', intensity: 'thorough' },
      ];

      const matcher = new PathMatcher({
        enabled: true,
        defaultIntensity: 'standard',
        patterns,
      });

      const files = [
        createFile('src/app.ts'),
        createFile('src/app.ts'), // Duplicate - should use cache
      ];

      const result = matcher.determineIntensity(files);

      // Both files match, but only one unique path
      expect(result.matchedPaths).toHaveLength(1);
    });

    it('should handle multiple files with different patterns efficiently', () => {
      const patterns: PathPattern[] = [
        { pattern: 'src/**/*.ts', intensity: 'standard' },
        { pattern: 'test/**/*.ts', intensity: 'light' },
      ];

      const matcher = new PathMatcher({
        enabled: true,
        defaultIntensity: 'standard',
        patterns,
      });

      const files = [
        createFile('src/app.ts'),
        createFile('src/utils.ts'),
        createFile('test/app.test.ts'),
      ];

      const result = matcher.determineIntensity(files);

      expect(result.matchedPaths.length).toBeGreaterThan(0);
    });
  });

  describe('edge cases', () => {
    it('should handle empty file list', () => {
      const matcher = new PathMatcher(createDefaultPathMatcherConfig());

      const result = matcher.determineIntensity([]);

      expect(result.intensity).toBe('standard');
      expect(result.matchedPaths).toHaveLength(0);
    });

    it('should handle patterns with no matches', () => {
      const patterns: PathPattern[] = [
        { pattern: 'non-existent/**', intensity: 'thorough' },
      ];

      const matcher = new PathMatcher({
        enabled: true,
        defaultIntensity: 'standard',
        patterns,
      });

      const files = [createFile('src/app.ts')];
      const result = matcher.determineIntensity(files);

      expect(result.intensity).toBe('standard');
      expect(result.matchedPaths).toHaveLength(0);
    });

    it('should handle boundary pattern length (exactly MAX_PATTERN_LENGTH)', () => {
      const boundaryPattern = 'a'.repeat(MAX_PATTERN_LENGTH); // Exactly 500 chars

      expect(() => {
        new PathMatcher({
          enabled: true,
          defaultIntensity: 'standard',
          patterns: [{ pattern: boundaryPattern, intensity: 'thorough' }],
        });
      }).not.toThrow();
    });

    it('should handle boundary complexity score (exactly MAX_COMPLEXITY_SCORE)', () => {
      // 25 wildcards * 2 = 50 (exactly at MAX_COMPLEXITY_SCORE)
      // Pattern: a*b*c*d*e*f*g*h*i*j*k*l*m*n*o*p*q*r*s*t*u*v*w*x*y*
      const boundaryPattern = 'a*b*c*d*e*f*g*h*i*j*k*l*m*n*o*p*q*r*s*t*u*v*w*x*y*';

      expect(() => {
        new PathMatcher({
          enabled: true,
          defaultIntensity: 'standard',
          patterns: [{ pattern: boundaryPattern, intensity: 'thorough' }],
        });
      }).not.toThrow();
    });

    it('should reject pattern exceeding MAX_COMPLEXITY_SCORE', () => {
      // 26 wildcards * 2 = 52 (exceeds MAX_COMPLEXITY_SCORE of 50)
      const overLimitPattern = 'a*b*c*d*e*f*g*h*i*j*k*l*m*n*o*p*q*r*s*t*u*v*w*x*y*z*';

      expect(() => {
        new PathMatcher({
          enabled: true,
          defaultIntensity: 'standard',
          patterns: [{ pattern: overLimitPattern, intensity: 'thorough' }],
        });
      }).toThrow(/too complex/i);
    });

    it('should reject pattern with tab character (0x09 is control char)', () => {
      // Tab (0x09) is a control character (0x00-0x1F)
      const patternWithTab = 'src\t/app.ts';

      expect(() => {
        new PathMatcher({
          enabled: true,
          defaultIntensity: 'standard',
          patterns: [{ pattern: patternWithTab, intensity: 'thorough' }],
        });
      }).toThrow(/control characters/i);
    });

    it('allows patterns containing spaces when explicitly configured', () => {
      const patternWithSpace = 'my project/*.ts';

      expect(() => {
        new PathMatcher({
          enabled: true,
          defaultIntensity: 'standard',
          patterns: [{ pattern: patternWithSpace, intensity: 'thorough' }],
        });
      }).not.toThrow();
    });

    it('accepts common real-world globs with parentheses and tildes', () => {
      const matcher = new PathMatcher({
        enabled: true,
        defaultIntensity: 'standard',
        patterns: [
          { pattern: '**/* (copy).ts', intensity: 'standard' },
          { pattern: 'docs/(draft)/*.md', intensity: 'light' },
          { pattern: '~/**/config?.json', intensity: 'standard' },
        ],
      });

      const files = [
        createFile('src/foo (copy).ts'),
        createFile('docs/(draft)/intro.md'),
        createFile('~/app/config1.json'),
      ];

      expect(() => matcher.determineIntensity(files)).not.toThrow();
    });

    it('should reject pattern with disallowed characters (e.g., pipe or backtick)', () => {
      const badPatterns = ['src|app.ts', '`rm -rf`'];

      for (const badPattern of badPatterns) {
        expect(() => {
          new PathMatcher({
            enabled: true,
            defaultIntensity: 'standard',
            patterns: [{ pattern: badPattern, intensity: 'thorough' }],
          });
        }).toThrow(/unsupported characters/i);
      }
    });

    it('should reject patterns containing path traversal', () => {
      const traversalPattern = '../secrets/*';

      expect(() => {
        new PathMatcher({
          enabled: true,
          defaultIntensity: 'standard',
          patterns: [{ pattern: traversalPattern, intensity: 'thorough' }],
        });
      }).toThrow(/path traversal/i);
    });

    it('allows brace and bracket glob tokens used by minimatch', () => {
      const matcher = new PathMatcher({
        enabled: true,
        defaultIntensity: 'standard',
        patterns: [
          { pattern: 'src/{api,[a-z]*}/**/*.{ts,js}', intensity: 'thorough' },
        ],
      });

      const files = [
        createFile('src/api/user.ts'),
        createFile('src/alpha/index.js'),
      ];

      const result = matcher.determineIntensity(files);
      expect(result.intensity).toBe('thorough');
      expect(result.matchedPaths).toEqual(
        expect.arrayContaining(['src/api/user.ts', 'src/alpha/index.js'])
      );
    });
  });
});
