import { CacheStorage } from '../cache/storage';
import { logger } from '../utils/logger';
import { randomUUID } from 'crypto';

export interface SuppressionPattern {
  id: string;
  category: string;
  file: string;
  line: number;
  scope: 'pr' | 'repo';
  prNumber?: number;
  timestamp: number;
  expiresAt: number;
}

export interface SuppressionData {
  patterns: SuppressionPattern[];
  lastCleanup: number;
}

/**
 * Tracks dismissed suggestions and suppresses similar findings
 * to reduce noise from repeated suggestions users don't want.
 *
 * Supports two scopes:
 * - PR scope: Only suppress within the same PR (7 day TTL)
 * - Repo scope: Suppress across all PRs in repo (30 day TTL)
 *
 * Similarity detection:
 * - Same category (e.g., 'null-check', 'type-safety')
 * - Same file
 * - Line within 5 lines of dismissed finding
 */
export class SuppressionTracker {
  private static readonly PR_TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7 days
  private static readonly REPO_TTL_MS = 30 * 24 * 60 * 60 * 1000; // 30 days
  private static readonly LINE_PROXIMITY_THRESHOLD = 5;

  constructor(
    private readonly storage: CacheStorage,
    private readonly repoKey: string
  ) {}

  /**
   * Record a dismissal and create a suppression pattern
   *
   * @param finding - The finding to suppress (category, file, line)
   * @param scope - 'pr' for PR-only suppression, 'repo' for repo-wide
   * @param prNumber - Required if scope is 'pr'
   */
  async recordDismissal(
    finding: { category: string; file: string; line: number },
    scope: 'pr' | 'repo',
    prNumber?: number
  ): Promise<void> {
    const data = await this.loadData();

    const ttl = scope === 'pr' ? SuppressionTracker.PR_TTL_MS : SuppressionTracker.REPO_TTL_MS;
    const timestamp = Date.now();

    const pattern: SuppressionPattern = {
      id: randomUUID(),
      category: finding.category,
      file: finding.file,
      line: finding.line,
      scope,
      prNumber: scope === 'pr' ? prNumber : undefined,
      timestamp,
      expiresAt: timestamp + ttl,
    };

    data.patterns.push(pattern);
    await this.saveData(data);

    logger.debug(
      `Recorded ${scope}-scoped suppression: ${finding.category} at ${finding.file}:${finding.line}` +
      (scope === 'pr' ? ` (PR #${prNumber})` : '')
    );
  }

  /**
   * Check if a finding should be suppressed based on recorded patterns
   *
   * Matches patterns if:
   * - Same category and file
   * - Line within 5 lines of pattern
   * - Pattern not expired
   * - Scope matches (PR scope requires same PR number)
   *
   * @param finding - The finding to check
   * @param prNumber - Current PR number for scope matching
   * @returns true if finding should be suppressed
   */
  async shouldSuppress(
    finding: { category: string; file: string; line: number },
    prNumber: number
  ): Promise<boolean> {
    const data = await this.loadData();
    const now = Date.now();

    for (const pattern of data.patterns) {
      // Skip expired patterns
      if (pattern.expiresAt < now) {
        continue;
      }

      // Check category match
      if (pattern.category !== finding.category) {
        continue;
      }

      // Check file match
      if (pattern.file !== finding.file) {
        continue;
      }

      // Check line proximity (within 5 lines)
      const lineDiff = Math.abs(finding.line - pattern.line);
      if (lineDiff > SuppressionTracker.LINE_PROXIMITY_THRESHOLD) {
        continue;
      }

      // Check scope
      if (pattern.scope === 'pr') {
        // PR scope: only suppress if prNumber matches
        if (pattern.prNumber !== prNumber) {
          continue;
        }
      }
      // Repo scope: suppress for any PR (no additional check needed)

      // All checks passed - suppress this finding
      logger.debug(
        `Suppressing finding: ${finding.category} at ${finding.file}:${finding.line} ` +
        `(matches pattern ${pattern.id})`
      );
      return true;
    }

    return false;
  }

  /**
   * Get categories with active suppressions for a PR.
   * Used by PromptEnricher to inform LLM about dismissed categories.
   *
   * @param prNumber - PR number to check (includes repo-wide suppressions)
   * @returns Array of unique category names with active suppressions
   */
  async getActiveCategories(prNumber: number): Promise<string[]> {
    const data = await this.loadData();
    const now = Date.now();

    // Filter to non-expired patterns matching this PR or repo-wide
    const activePatterns = data.patterns.filter(p =>
      p.expiresAt > now &&
      (p.scope === 'repo' || (p.scope === 'pr' && p.prNumber === prNumber))
    );

    // Get unique categories
    const categorySet = new Set(activePatterns.map(p => p.category));
    const categories = Array.from(categorySet);

    return categories;
  }

  /**
   * Remove expired suppression patterns
   *
   * @returns Number of patterns cleared
   */
  async clearExpired(): Promise<number> {
    const data = await this.loadData();
    const now = Date.now();

    const beforeCount = data.patterns.length;
    data.patterns = data.patterns.filter(pattern => pattern.expiresAt >= now);
    const clearedCount = beforeCount - data.patterns.length;

    if (clearedCount > 0) {
      data.lastCleanup = now;
      await this.saveData(data);
      logger.info(`Cleared ${clearedCount} expired suppression patterns`);
    }

    return clearedCount;
  }

  /**
   * Get cache key for this repository
   */
  private getCacheKey(): string {
    return `suppression-${this.repoKey}`;
  }

  /**
   * Load suppression data from cache
   */
  private async loadData(): Promise<SuppressionData> {
    const raw = await this.storage.read(this.getCacheKey());

    if (!raw) {
      return {
        patterns: [],
        lastCleanup: Date.now(),
      };
    }

    try {
      return JSON.parse(raw) as SuppressionData;
    } catch (error) {
      logger.warn('Failed to parse suppression data, starting fresh', error as Error);
      return {
        patterns: [],
        lastCleanup: Date.now(),
      };
    }
  }

  /**
   * Save suppression data to cache
   */
  private async saveData(data: SuppressionData): Promise<void> {
    await this.storage.write(this.getCacheKey(), JSON.stringify(data));
  }
}
