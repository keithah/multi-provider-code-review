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
 */
export class ReliabilityTracker {
  private static readonly CACHE_KEY = 'provider-reliability-data';
  private static readonly AGGREGATION_INTERVAL_MS = 24 * 60 * 60 * 1000; // 1 day
  private static readonly MIN_ATTEMPTS_FOR_SCORING = 5;

  // Reliability score weights
  private static readonly WEIGHTS = {
    successRate: 0.5, // 50% - Most important
    falsePositiveRate: 0.3, // 30% - Very important
    responseTime: 0.2, // 20% - Nice to have
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

    const result: ProviderResult = {
      providerId,
      success,
      timestamp: Date.now(),
      durationMs,
      error,
    };

    data.results.push(result);

    // Circuit breaker bookkeeping
    if (success) {
      await this.circuitBreaker.recordSuccess(providerId);
    } else {
      await this.circuitBreaker.recordFailure(providerId);
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
    await this.saveData(data);

    logger.info(`Recorded false positive from provider ${providerId} (finding: ${findingId})`);
  }

  /**
   * Get reliability score for a provider (0-1, higher is better)
   */
  async getReliabilityScore(providerId: string): Promise<number> {
    const data = await this.loadData();
    const stats = data.stats[providerId];

    if (!stats || stats.totalAttempts < this.minAttempts) {
      return 0.5; // Default neutral score
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
    const durationsWithValues = results.filter((r) => r.durationMs !== undefined);
    const averageDurationMs =
      durationsWithValues.length > 0
        ? durationsWithValues.reduce((sum, r) => sum + (r.durationMs || 0), 0) / durationsWithValues.length
        : 0;

    // False positive rate (0-1, inverted for scoring)
    const falsePositiveCount = falsePositives.length;
    const falsePositiveRate = totalAttempts > 0 ? falsePositiveCount / totalAttempts : 0;

    // Response time score (0-1, faster is better)
    // Assume 500ms is excellent, 5000ms is poor
    const responseTimeScore = Math.max(0, Math.min(1, 1 - (averageDurationMs - 500) / 4500));

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
