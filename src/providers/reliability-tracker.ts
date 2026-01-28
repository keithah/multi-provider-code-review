import { CacheStorage } from '../cache/storage';
import { logger } from '../utils/logger';
import { CircuitBreaker } from './circuit-breaker';

export interface ProviderResult {
  providerId: string;
  success: boolean;
  timestamp: number;
  durationMs?: number;
  error?: string;
}

export interface FalsePositiveReport {
  providerId: string;
  findingId: string;
  timestamp: number;
  category?: string;
}

export interface ReliabilityStats {
  providerId: string;
  totalAttempts: number;
  successCount: number;
  failureCount: number;
  successRate: number;
  averageDurationMs: number;
  falsePositiveCount: number;
  reliabilityScore: number;
  lastUpdated: number;
}

export interface ReliabilityData {
  results: ProviderResult[];
  falsePositives: FalsePositiveReport[];
  stats: Record<string, ReliabilityStats>;
  lastAggregation: number;
}

/**
 * Tracks provider reliability based on:
 * - Success/failure rates
 * - False positive rates (from user feedback)
 * - Response time consistency
 * - Cost efficiency
 *
 * Enables ranking providers by reliability and auto-downranking unreliable ones.
 *
 * Reliability Scoring Algorithm:
 * The reliability score (0-1, higher is better) is calculated as a weighted average:
 * - Success Rate (50%): Percentage of successful executions
 * - False Positive Rate (30%): Inverted rate of false positives reported by users
 * - Response Time (20%): Score based on average response time (500ms = excellent, 5000ms = poor)
 *
 * Data Management:
 * - Results are aggregated daily to calculate statistics
 * - Raw results are retained up to MAX_RESULTS_HISTORY (1000) to prevent unbounded growth
 * - False positive reports are retained up to MAX_FALSE_POSITIVE_HISTORY (500)
 * - Providers need MIN_ATTEMPTS_FOR_SCORING (5) attempts before receiving a calculated score
 * - New providers receive a default neutral score (0.5) until they have sufficient history
 */
export class ReliabilityTracker {
  private static readonly CACHE_KEY = 'provider-reliability-data';
  private static readonly AGGREGATION_INTERVAL_MS = 24 * 60 * 60 * 1000; // 1 day
  private static readonly MIN_ATTEMPTS_FOR_SCORING = 5;
  private static readonly MAX_RESULTS_HISTORY = 1000; // Prevent unbounded growth
  private static readonly MAX_FALSE_POSITIVE_HISTORY = 500;

  // Reliability score weights (must sum to 1.0)
  // These weights determine the relative importance of each factor in the overall score
  private static readonly WEIGHTS = {
    successRate: 0.5,         // 50% - Most critical: did the provider complete successfully?
    falsePositiveRate: 0.3,   // 30% - Very important: does it produce accurate results?
    responseTime: 0.2,        // 20% - Nice to have: is it fast?
  };

  constructor(
    private readonly storage = new CacheStorage(),
    private readonly minAttempts = ReliabilityTracker.MIN_ATTEMPTS_FOR_SCORING,
    private readonly circuitBreaker = new CircuitBreaker(storage)
  ) {}

  /**
   * Record a provider execution result
   */
  async recordResult(
    providerId: string,
    success: boolean,
    durationMs?: number,
    error?: string
  ): Promise<void> {
    const data = await this.loadData();

    // Normalize duration to a finite, non-negative number to avoid NaN skew in averages
    const safeDurationMs = Number.isFinite(durationMs) && durationMs! >= 0 ? durationMs : undefined;

    const result: ProviderResult = {
      providerId,
      success,
      timestamp: Date.now(),
      durationMs: safeDurationMs,
      error,
    };

    data.results.push(result);

    // Trim old results to prevent unbounded growth
    // Keep most recent results up to MAX_RESULTS_HISTORY
    if (data.results.length > ReliabilityTracker.MAX_RESULTS_HISTORY) {
      const excess = data.results.length - ReliabilityTracker.MAX_RESULTS_HISTORY;
      data.results.splice(0, excess);
      logger.debug(`Trimmed ${excess} old reliability results to prevent unbounded growth`);
    }

    // Circuit breaker bookkeeping (if available)
    if (this.circuitBreaker) {
      if (success) {
        await this.circuitBreaker.recordSuccess(providerId);
      } else {
        await this.circuitBreaker.recordFailure(providerId);
      }
    }

    // Check if we should aggregate
    const timeSinceAggregation = Date.now() - data.lastAggregation;
    if (timeSinceAggregation > ReliabilityTracker.AGGREGATION_INTERVAL_MS) {
      await this.aggregateStats(data);
    }

    await this.saveData(data);

    logger.debug(
      `Recorded ${success ? 'success' : 'failure'} for provider ${providerId}${durationMs ? ` (${durationMs}ms)` : ''}`
    );
  }

  /**
   * Record a false positive finding from a provider
   */
  async recordFalsePositive(providerId: string, findingId: string, category?: string): Promise<void> {
    const data = await this.loadData();

    const report: FalsePositiveReport = {
      providerId,
      findingId,
      timestamp: Date.now(),
      category,
    };

    data.falsePositives.push(report);

    // Trim old false positive reports to prevent unbounded growth
    if (data.falsePositives.length > ReliabilityTracker.MAX_FALSE_POSITIVE_HISTORY) {
      const excess = data.falsePositives.length - ReliabilityTracker.MAX_FALSE_POSITIVE_HISTORY;
      data.falsePositives.splice(0, excess);
      logger.debug(`Trimmed ${excess} old false positive reports`);
    }

    await this.saveData(data);

    logger.info(`Recorded false positive from provider ${providerId} (finding: ${findingId})`);
  }

  /**
   * Get reliability score for a provider (0-1, higher is better)
   * Returns default neutral score (0.5) for providers with insufficient history
   */
  async getReliabilityScore(providerId: string): Promise<number> {
    const data = await this.loadData();
    const stats = data.stats[providerId];

    // Default neutral score for new/untested providers
    // This can be overridden by passing a custom minAttempts in the constructor
    const DEFAULT_SCORE = 0.5;

    if (!stats || stats.totalAttempts < this.minAttempts) {
      return DEFAULT_SCORE;
    }

    return stats.reliabilityScore;
  }

  /**
   * Get detailed statistics for a provider
   */
  async getStats(providerId: string): Promise<ReliabilityStats | null> {
    const data = await this.loadData();
    return data.stats[providerId] || null;
  }

  /**
   * Get all provider statistics
   */
  async getAllStats(): Promise<Record<string, ReliabilityStats>> {
    const data = await this.loadData();
    return data.stats;
  }

  /**
   * Rank providers by reliability score (best first)
   */
  async rankProviders(providerIds: string[]): Promise<Array<{ providerId: string; score: number }>> {
    const ranked: Array<{ providerId: string; score: number }> = [];

    for (const providerId of providerIds) {
      const score = await this.getReliabilityScore(providerId);
      ranked.push({ providerId, score });
    }

    // Sort by score descending
    ranked.sort((a, b) => b.score - a.score);

    logger.debug(
      `Ranked ${ranked.length} providers: ${ranked.map((r) => `${r.providerId}=${r.score.toFixed(2)}`).join(', ')}`
    );

    return ranked;
  }

  /**
   * Get provider recommendations based on reliability
   */
  async getRecommendations(minScore: number = 0.6): Promise<string[]> {
    const data = await this.loadData();
    const recommended: string[] = [];

    for (const [providerId, stats] of Object.entries(data.stats)) {
      if (stats.reliabilityScore >= minScore && stats.totalAttempts >= this.minAttempts) {
        recommended.push(providerId);
      }
    }

    // Sort by score
    recommended.sort((a, b) => {
      const scoreA = data.stats[a].reliabilityScore;
      const scoreB = data.stats[b].reliabilityScore;
      return scoreB - scoreA;
    });

    logger.info(`Found ${recommended.length} recommended providers with score >= ${minScore}`);

    return recommended;
  }

  /**
   * Check whether a provider's circuit is open.
   */
  async isCircuitOpen(providerId: string): Promise<boolean> {
    if (!this.circuitBreaker) {
      return false; // If no circuit breaker, assume circuit is closed
    }
    return this.circuitBreaker.isOpen(providerId);
  }

  /**
   * Aggregate results and calculate statistics
   */
  async aggregateStats(data?: ReliabilityData): Promise<void> {
    const reliabilityData = data || (await this.loadData());

    logger.info('Aggregating provider reliability statistics');

    // Group results by provider
    const providerGroups = new Map<string, ProviderResult[]>();
    for (const result of reliabilityData.results) {
      const group = providerGroups.get(result.providerId) || [];
      group.push(result);
      providerGroups.set(result.providerId, group);
    }

    // Group false positives by provider
    const fpGroups = new Map<string, FalsePositiveReport[]>();
    for (const fp of reliabilityData.falsePositives) {
      const group = fpGroups.get(fp.providerId) || [];
      group.push(fp);
      fpGroups.set(fp.providerId, group);
    }

    // Calculate stats for each provider
    for (const [providerId, results] of providerGroups) {
      const stats = this.calculateStats(providerId, results, fpGroups.get(providerId) || []);
      reliabilityData.stats[providerId] = stats;

      logger.debug(
        `${providerId}: ${stats.successRate.toFixed(0)}% success, ` +
          `${stats.falsePositiveCount} FP, score=${stats.reliabilityScore.toFixed(2)}`
      );
    }

    reliabilityData.lastAggregation = Date.now();

    if (!data) {
      await this.saveData(reliabilityData);
    }
  }

  /**
   * Calculate statistics for a provider
   */
  private calculateStats(
    providerId: string,
    results: ProviderResult[],
    falsePositives: FalsePositiveReport[]
  ): ReliabilityStats {
    const successCount = results.filter((r) => r.success).length;
    const failureCount = results.filter((r) => !r.success).length;
    const totalAttempts = results.length;

    // Success rate (0-1)
    const successRate = totalAttempts > 0 ? successCount / totalAttempts : 0;

    // Average duration
    const durationsWithValues = results.filter((r) => Number.isFinite(r.durationMs));
    const averageDurationMs =
      durationsWithValues.length > 0
        ? durationsWithValues.reduce((sum, r) => sum + (r.durationMs || 0), 0) / durationsWithValues.length
        : 0;

    // False positive rate (0-1, inverted for scoring)
    const falsePositiveCount = falsePositives.length;
    const falsePositiveRate = totalAttempts > 0 ? falsePositiveCount / totalAttempts : 0;

    // Response time score (0-1, faster is better)
    // Response time thresholds for scoring
    const EXCELLENT_RESPONSE_MS = 500;  // <= 500ms is considered excellent
    const POOR_RESPONSE_MS = 5000;       // >= 5000ms is considered poor
    const responseTimeRange = POOR_RESPONSE_MS - EXCELLENT_RESPONSE_MS;
    const responseTimeScore = Math.max(0, Math.min(1, 1 - (averageDurationMs - EXCELLENT_RESPONSE_MS) / responseTimeRange));

    // Calculate weighted reliability score (0-1)
    const reliabilityScore =
      ReliabilityTracker.WEIGHTS.successRate * successRate +
      ReliabilityTracker.WEIGHTS.falsePositiveRate * (1 - falsePositiveRate) +
      ReliabilityTracker.WEIGHTS.responseTime * responseTimeScore;

    return {
      providerId,
      totalAttempts,
      successCount,
      failureCount,
      successRate: successRate * 100, // Convert to percentage
      averageDurationMs: Math.round(averageDurationMs),
      falsePositiveCount,
      reliabilityScore,
      lastUpdated: Date.now(),
    };
  }

  /**
   * Clear all reliability data
   */
  async clear(): Promise<void> {
    const emptyData: ReliabilityData = {
      results: [],
      falsePositives: [],
      stats: {},
      lastAggregation: Date.now(),
    };
    await this.saveData(emptyData);
    logger.info('Cleared all reliability data');
  }

  /**
   * Get overall summary statistics
   */
  async getSummary(): Promise<{
    totalProviders: number;
    totalAttempts: number;
    averageReliability: number;
    topProvider: string | null;
    worstProvider: string | null;
  }> {
    const data = await this.loadData();
    const stats = Object.values(data.stats);

    if (stats.length === 0) {
      return {
        totalProviders: 0,
        totalAttempts: 0,
        averageReliability: 0,
        topProvider: null,
        worstProvider: null,
      };
    }

    const totalAttempts = stats.reduce((sum, s) => sum + s.totalAttempts, 0);
    const averageReliability = stats.reduce((sum, s) => sum + s.reliabilityScore, 0) / stats.length;

    const sorted = [...stats].sort((a, b) => b.reliabilityScore - a.reliabilityScore);
    const topProvider = sorted[0]?.providerId || null;
    const worstProvider = sorted[sorted.length - 1]?.providerId || null;

    return {
      totalProviders: stats.length,
      totalAttempts,
      averageReliability,
      topProvider,
      worstProvider,
    };
  }

  /**
   * Load reliability data from cache
   */
  private async loadData(): Promise<ReliabilityData> {
    const raw = await this.storage.read(ReliabilityTracker.CACHE_KEY);
    if (!raw) {
      return {
        results: [],
        falsePositives: [],
        stats: {},
        lastAggregation: Date.now(),
      };
    }

    try {
      return JSON.parse(raw) as ReliabilityData;
    } catch (error) {
      logger.warn('Failed to parse reliability data, starting fresh', error as Error);
      return {
        results: [],
        falsePositives: [],
        stats: {},
        lastAggregation: Date.now(),
      };
    }
  }

  /**
   * Save reliability data to cache
   */
  private async saveData(data: ReliabilityData): Promise<void> {
    await this.storage.write(ReliabilityTracker.CACHE_KEY, JSON.stringify(data));
  }
}
