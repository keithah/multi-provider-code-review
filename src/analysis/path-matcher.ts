import { FileChange } from '../types';
import { logger } from '../utils/logger';

/**
 * Path-based review intensity configuration
 * Inspired by Claude Code Action's intelligent review routing
 */

export type ReviewIntensity = 'thorough' | 'standard' | 'light';

export interface PathPattern {
  pattern: string;
  intensity: ReviewIntensity;
  description?: string;
}

export interface PathMatcherConfig {
  enabled: boolean;
  patterns: PathPattern[];
  defaultIntensity: ReviewIntensity;
}

export interface IntensityResult {
  intensity: ReviewIntensity;
  matchedPaths: string[];
  reason: string;
}

/**
 * Matches file paths against patterns to determine review intensity
 */
export class PathMatcher {
  constructor(private readonly config: PathMatcherConfig) {}

  /**
   * Analyze files and determine review intensity based on path patterns
   */
  determineIntensity(files: FileChange[]): IntensityResult {
    if (!this.config.enabled || this.config.patterns.length === 0) {
      return {
        intensity: this.config.defaultIntensity,
        matchedPaths: [],
        reason: 'Path-based intensity disabled or no patterns configured',
      };
    }

    // Check each file against patterns, taking the highest intensity match
    let highestIntensity: ReviewIntensity | null = null;
    const matchedPaths: string[] = [];
    const matchedPatterns: PathPattern[] = [];

    for (const file of files) {
      for (const pathPattern of this.config.patterns) {
        if (this.matchesPattern(file.filename, pathPattern.pattern)) {
          matchedPaths.push(file.filename);
          matchedPatterns.push(pathPattern);

          // Update highest intensity (thorough > standard > light)
          if (highestIntensity === null || this.compareIntensity(pathPattern.intensity, highestIntensity) > 0) {
            highestIntensity = pathPattern.intensity;
          }
        }
      }
    }

    // Use default intensity if no patterns matched
    const finalIntensity = highestIntensity ?? this.config.defaultIntensity;

    // Deduplicate matched paths before using them
    const uniqueMatchedPaths = [...new Set(matchedPaths)];

    const reason = this.buildReason(finalIntensity, matchedPatterns, uniqueMatchedPaths);

    logger.info(`Path-based intensity: ${finalIntensity}`, {
      matchedPaths: uniqueMatchedPaths.length,
      patterns: matchedPatterns.map(p => p.pattern),
    });

    return {
      intensity: finalIntensity,
      matchedPaths: uniqueMatchedPaths,
      reason,
    };
  }

  /**
   * Match a file path against a glob-style pattern
   * Supports:
   * - ** for recursive directory matching
   * - * for single segment wildcard
   * - Exact matches
   */
  private matchesPattern(filePath: string, pattern: string): boolean {
    try {
      // Convert glob pattern to regex
      const regexPattern = this.globToRegex(pattern);
      return regexPattern.test(filePath);
    } catch (error) {
      // Log error and return false for invalid patterns
      logger.warn(`Invalid glob pattern "${pattern}": ${(error as Error).message}`);
      return false;
    }
  }

  /**
   * Convert glob pattern to regular expression
   * Validates input to prevent regex injection and ReDoS attacks
   */
  private globToRegex(pattern: string): RegExp {
    // Validate pattern to prevent regex injection
    if (!pattern || typeof pattern !== 'string') {
      throw new Error('Invalid glob pattern: must be a non-empty string');
    }

    // Limit pattern length to prevent complexity attacks
    if (pattern.length > 500) {
      throw new Error('Invalid glob pattern: pattern too long (max 500 characters)');
    }

    // Check for suspicious patterns that could cause ReDoS
    const suspiciousPatterns = [
      /(\*\*){3,}/, // Multiple consecutive **
      /(\*){10,}/, // Too many consecutive *
      /(.)\1{20,}/, // Excessive character repetition
      /(\*.*\*){3,}/, // Nested wildcard patterns
      /\{[^}]{100,}\}/, // Very long brace expansions
      /(\||\/){20,}/, // Excessive alternation or path separators
    ];

    for (const suspicious of suspiciousPatterns) {
      if (suspicious.test(pattern)) {
        throw new Error('Invalid glob pattern: potentially malicious pattern detected');
      }
    }

    // Calculate complexity score to catch subtle ReDoS patterns
    const complexityScore = this.calculatePatternComplexity(pattern);
    if (complexityScore > 100) {
      throw new Error(`Invalid glob pattern: complexity score too high (${complexityScore} > 100)`);
    }

    // Escape special regex characters except * and /
    let regexStr = pattern
      .replace(/[.+?^${}()|[\]\\]/g, '\\$&') // Escape special chars
      .replace(/\*\*/g, '___RECURSIVE___') // Placeholder for **
      .replace(/\*/g, '[^/]*') // * matches anything except /
      .replace(/___RECURSIVE___/g, '.*'); // ** matches everything

    // Anchor the pattern
    regexStr = `^${regexStr}$`;

    try {
      return new RegExp(regexStr);
    } catch (error) {
      throw new Error(`Invalid glob pattern: failed to compile regex - ${(error as Error).message}`);
    }
  }

  /**
   * Calculate complexity score for a pattern to detect potential ReDoS
   * Higher scores indicate more complex/dangerous patterns
   */
  private calculatePatternComplexity(pattern: string): number {
    let score = 0;

    // Count wildcards (each adds complexity)
    const wildcardCount = (pattern.match(/\*/g) || []).length;
    score += wildcardCount * 2;

    // Count double wildcards (more complex)
    const doubleWildcardCount = (pattern.match(/\*\*/g) || []).length;
    score += doubleWildcardCount * 5;

    // Count alternations (brace expansions)
    const braceCount = (pattern.match(/\{/g) || []).length;
    score += braceCount * 3;

    // Count character classes
    const charClassCount = (pattern.match(/\[/g) || []).length;
    score += charClassCount * 2;

    // Penalty for very long patterns
    if (pattern.length > 200) {
      score += Math.floor(pattern.length / 50);
    }

    // Penalty for nested quantifiers (wildcard followed by wildcard)
    const nestedQuantifiers = (pattern.match(/\*+.*\*+/g) || []).length;
    score += nestedQuantifiers * 10;

    return score;
  }

  /**
   * Compare two intensity levels (higher value = more thorough)
   * Returns: 1 if a > b, -1 if a < b, 0 if equal
   */
  private compareIntensity(a: ReviewIntensity, b: ReviewIntensity): number {
    const levels: Record<ReviewIntensity, number> = {
      light: 1,
      standard: 2,
      thorough: 3,
    };

    return levels[a] - levels[b];
  }

  /**
   * Build a human-readable reason for the intensity decision
   */
  private buildReason(
    intensity: ReviewIntensity,
    matchedPatterns: PathPattern[],
    matchedPaths: string[]
  ): string {
    if (matchedPaths.length === 0) {
      return `Using ${intensity} review intensity (default)`;
    }

    const uniquePatterns = [...new Set(matchedPatterns.map(p => p.pattern))];
    const descriptions = matchedPatterns
      .filter(p => p.description)
      .map(p => p.description)
      .filter((v, i, a) => a.indexOf(v) === i); // Unique descriptions

    let reason = `Using ${intensity} review intensity: matched ${matchedPaths.length} file(s) against patterns: ${uniquePatterns.join(', ')}`;

    if (descriptions.length > 0) {
      reason += `. Reason: ${descriptions.join(', ')}`;
    }

    return reason;
  }
}

/**
 * Create default path matcher configuration
 */
export function createDefaultPathMatcherConfig(): PathMatcherConfig {
  return {
    enabled: false,
    defaultIntensity: 'standard',
    patterns: [
      // Critical security paths - thorough review
      {
        pattern: 'src/auth/**',
        intensity: 'thorough',
        description: 'Authentication code requires thorough review',
      },
      {
        pattern: '**/auth/**',
        intensity: 'thorough',
        description: 'Authentication code requires thorough review',
      },
      {
        pattern: 'src/security/**',
        intensity: 'thorough',
        description: 'Security code requires thorough review',
      },
      {
        pattern: '**/payment/**',
        intensity: 'thorough',
        description: 'Payment processing requires thorough review',
      },
      {
        pattern: '**/billing/**',
        intensity: 'thorough',
        description: 'Billing code requires thorough review',
      },

      // Infrastructure - thorough for safety
      {
        pattern: 'infrastructure/**',
        intensity: 'thorough',
        description: 'Infrastructure changes need careful review',
      },
      {
        pattern: 'terraform/**',
        intensity: 'thorough',
        description: 'Infrastructure as code needs careful review',
      },
      {
        pattern: 'k8s/**',
        intensity: 'thorough',
        description: 'Kubernetes configs need careful review',
      },
      {
        pattern: 'Dockerfile',
        intensity: 'thorough',
        description: 'Docker configs need security review',
      },
      {
        pattern: '**/Dockerfile',
        intensity: 'thorough',
        description: 'Docker configs need security review',
      },
      {
        pattern: '*.Dockerfile',
        intensity: 'thorough',
        description: 'Docker configs need security review',
      },
      {
        pattern: '**/*.Dockerfile',
        intensity: 'thorough',
        description: 'Docker configs need security review',
      },
      {
        pattern: 'docker-compose*.yml',
        intensity: 'thorough',
        description: 'Docker Compose configs need security review',
      },

      // Tests - light review (focus on coverage)
      {
        pattern: '**/*.test.ts',
        intensity: 'light',
        description: 'Test files get lighter review',
      },
      {
        pattern: '**/*.test.js',
        intensity: 'light',
        description: 'Test files get lighter review',
      },
      {
        pattern: '**/*.spec.ts',
        intensity: 'light',
        description: 'Test files get lighter review',
      },
      {
        pattern: '**/*.spec.js',
        intensity: 'light',
        description: 'Test files get lighter review',
      },
      {
        pattern: '__tests__/**',
        intensity: 'light',
        description: 'Test files get lighter review',
      },
    ],
  };
}
