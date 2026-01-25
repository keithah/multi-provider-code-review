import { FileChange } from '../types';
import { logger } from '../utils/logger';
import { minimatch } from 'minimatch';

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
 * Performance: Uses memoization to cache pattern matching results
 */
export class PathMatcher {
  // Cache for pattern matching results: `${filePath}:${pattern}` -> boolean
  private readonly matchCache = new Map<string, boolean>();

  constructor(private readonly config: PathMatcherConfig) {
    // Validate all patterns on construction
    this.validatePatterns();
  }

  /**
   * Validate all patterns for security and correctness
   * Throws if any pattern is invalid
   */
  private validatePatterns(): void {
    for (const pathPattern of this.config.patterns) {
      this.validateSinglePattern(pathPattern.pattern);
    }
  }

  /**
   * Validate a single pattern for security issues
   */
  private validateSinglePattern(pattern: string): void {
    this.checkPatternLength(pattern);
    this.checkPatternComplexity(pattern);
    this.checkControlCharacters(pattern);
  }

  /**
   * Check if pattern exceeds maximum length
   */
  private checkPatternLength(pattern: string): void {
    const MAX_LENGTH = 500;
    if (pattern.length > MAX_LENGTH) {
      throw new Error(`Pattern too long (${pattern.length} chars, max ${MAX_LENGTH}): ${pattern}`);
    }
  }

  /**
   * Check if pattern complexity is within acceptable limits
   */
  private checkPatternComplexity(pattern: string): void {
    const wildcardCount = (pattern.match(/\*/g) || []).length;
    const braceCount = (pattern.match(/\{/g) || []).length;
    const complexityScore = wildcardCount * 2 + braceCount * 3;
    const MAX_COMPLEXITY = 50;

    if (complexityScore > MAX_COMPLEXITY) {
      throw new Error(`Pattern too complex (score ${complexityScore}): ${pattern}`);
    }
  }

  /**
   * Check for control characters in pattern
   */
  private checkControlCharacters(pattern: string): void {
    for (let i = 0; i < pattern.length; i++) {
      if (pattern.charCodeAt(i) <= 0x1F) {
        throw new Error(`Pattern contains control characters: ${pattern}`);
      }
    }
  }

  /**
   * Analyze files and determine review intensity based on path patterns
   */
  determineIntensity(files: FileChange[]): IntensityResult {
    if (!this.config.enabled || this.config.patterns.length === 0) {
      return this.createDefaultResult();
    }

    const matches = this.findMatchingPatterns(files);
    const finalIntensity = matches.highestIntensity ?? this.config.defaultIntensity;
    const uniqueMatchedPaths = [...new Set(matches.matchedPaths)];
    const reason = this.buildReason(finalIntensity, matches.matchedPatterns, uniqueMatchedPaths);

    this.logIntensityDecision(finalIntensity, uniqueMatchedPaths, matches.matchedPatterns);

    return {
      intensity: finalIntensity,
      matchedPaths: uniqueMatchedPaths,
      reason,
    };
  }

  /**
   * Create default result when path matching is disabled
   */
  private createDefaultResult(): IntensityResult {
    return {
      intensity: this.config.defaultIntensity,
      matchedPaths: [],
      reason: 'Path-based intensity disabled or no patterns configured',
    };
  }

  /**
   * Find all patterns that match the given files
   */
  private findMatchingPatterns(files: FileChange[]): {
    highestIntensity: ReviewIntensity | null;
    matchedPaths: string[];
    matchedPatterns: PathPattern[];
  } {
    let highestIntensity: ReviewIntensity | null = null;
    const matchedPaths: string[] = [];
    const matchedPatterns: PathPattern[] = [];

    for (const file of files) {
      for (const pathPattern of this.config.patterns) {
        if (this.matchesPattern(file.filename, pathPattern.pattern)) {
          matchedPaths.push(file.filename);
          matchedPatterns.push(pathPattern);

          if (this.isHigherIntensity(pathPattern.intensity, highestIntensity)) {
            highestIntensity = pathPattern.intensity;
          }
        }
      }
    }

    return { highestIntensity, matchedPaths, matchedPatterns };
  }

  /**
   * Check if intensity A is higher than intensity B
   */
  private isHigherIntensity(a: ReviewIntensity, b: ReviewIntensity | null): boolean {
    return b === null || this.compareIntensity(a, b) > 0;
  }

  /**
   * Log the intensity decision for debugging
   */
  private logIntensityDecision(
    intensity: ReviewIntensity,
    matchedPaths: string[],
    matchedPatterns: PathPattern[]
  ): void {
    logger.info(`Path-based intensity: ${intensity}`, {
      matchedPaths: matchedPaths.length,
      patterns: matchedPatterns.map(p => p.pattern),
    });
  }

  /**
   * Match a file path against a glob-style pattern using minimatch library
   * Supports:
   * - ** for recursive directory matching
   * - * for single segment wildcard
   * - Exact matches
   * - Brace expansion: {a,b,c}
   * - Character classes: [abc]
   *
   * Uses minimatch library which is battle-tested and ReDoS-safe
   * Performance: Results are memoized to avoid redundant matching
   */
  private matchesPattern(filePath: string, pattern: string): boolean {
    // Check cache first
    const cacheKey = `${filePath}:${pattern}`;
    const cached = this.matchCache.get(cacheKey);
    if (cached !== undefined) {
      return cached;
    }

    try {
      // Use minimatch with safe options
      const result = minimatch(filePath, pattern, {
        dot: true,           // Match dotfiles
        matchBase: false,    // Don't match basenames only
        nocase: false,       // Case-sensitive matching
        nonegate: true,      // Disable negation patterns (security)
        nocomment: true,     // Disable comment patterns (security)
      });

      // Cache the result
      this.matchCache.set(cacheKey, result);
      return result;
    } catch (error) {
      // Log error and return false for invalid patterns
      logger.warn(`Invalid glob pattern "${pattern}": ${(error as Error).message}`);

      // Cache negative result to avoid repeated errors
      this.matchCache.set(cacheKey, false);
      return false;
    }
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
      {
        pattern: 'docker-compose*.yaml',
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
