import { CacheStorage } from '../cache/storage';
import { logger } from '../utils/logger';

export interface ProviderWeight {
  provider: string;
  positiveCount: number;
  negativeCount: number;
  totalCount: number;
  positiveRate: number;
  weight: number;
  lastUpdated: number;
}

export interface ProviderWeightData {
  weights: Record<string, ProviderWeight>;
  lastAggregation: number;
}

/**
 * Tracks provider performance based on user feedback (thumbs up/down)
 * and adjusts provider weights for confidence score calculation.
 *
 * Weight calculation:
 * - Minimum weight: 0.3 (never fully exclude a provider)
 * - Variable weight: 0.7 * positiveRate
 * - Final weight = 0.3 + (0.7 * positiveRate)
 * - Range: 0.3 (0% positive) to 1.0 (100% positive)
 *
 * Requires minimum 5 feedback records before adjusting from default 1.0
 */
export class ProviderWeightTracker {
  private static readonly CACHE_KEY = 'provider-weights';
  private static readonly MIN_WEIGHT = 0.3;
  private static readonly VARIABLE_WEIGHT = 0.7;
  private static readonly MIN_FEEDBACK_THRESHOLD = 5;

  constructor(private readonly storage = new CacheStorage()) {}

  /**
   * Record feedback for a provider and update its weight
   *
   * @param provider - Provider name (e.g., 'claude', 'gemini')
   * @param reaction - User reaction: '👍' (good) or '👎' (bad)
   */
  async recordFeedback(
    provider: string,
    reaction: '👍' | '👎'
  ): Promise<void> {
    const data = await this.loadData();

    // Get or create provider weight record
    let providerWeight = data.weights[provider];
    if (!providerWeight) {
      providerWeight = {
        provider,
        positiveCount: 0,
        negativeCount: 0,
        totalCount: 0,
        positiveRate: 0,
        weight: 1.0, // Default weight
        lastUpdated: Date.now(),
      };
      data.weights[provider] = providerWeight;
    }

    // Update counts
    if (reaction === '👍') {
      providerWeight.positiveCount++;
    } else {
      providerWeight.negativeCount++;
    }
    providerWeight.totalCount = providerWeight.positiveCount + providerWeight.negativeCount;
    providerWeight.positiveRate = providerWeight.positiveCount / providerWeight.totalCount;
    providerWeight.lastUpdated = Date.now();

    // Recalculate weight
    providerWeight.weight = this.calculateWeight(
      providerWeight.positiveRate,
      providerWeight.totalCount
    );

    await this.saveData(data);

    logger.debug(
      `Recorded ${reaction} feedback for ${provider} ` +
      `(${providerWeight.positiveCount}👍 ${providerWeight.negativeCount}👎, weight: ${providerWeight.weight.toFixed(2)})`
    );
  }

  /**
   * Get the current weight for a provider
   *
   * @param provider - Provider name
   * @returns Weight value (0.3-1.0), or 1.0 for new providers
   */
  async getWeight(provider: string): Promise<number> {
    const data = await this.loadData();
    const providerWeight = data.weights[provider];

    if (!providerWeight) {
      return 1.0; // Default weight for new providers
    }

    return providerWeight.weight;
  }

  /**
   * Get all provider weights
   *
   * @returns Map of provider name to ProviderWeight record
   */
  async getAllWeights(): Promise<Record<string, ProviderWeight>> {
    const data = await this.loadData();
    return data.weights;
  }

  /**
   * Recalculate weights for all providers
   */
  async recalculateWeights(): Promise<void> {
    const data = await this.loadData();

    for (const provider in data.weights) {
      const providerWeight = data.weights[provider];
      providerWeight.weight = this.calculateWeight(
        providerWeight.positiveRate,
        providerWeight.totalCount
      );
      providerWeight.lastUpdated = Date.now();
    }

    data.lastAggregation = Date.now();
    await this.saveData(data);

    logger.info('Recalculated weights for all providers');
  }

  /**
   * Calculate weight based on positive rate
   *
   * Formula: weight = MIN_WEIGHT + (VARIABLE_WEIGHT * positiveRate)
   * - MIN_WEIGHT = 0.3 (floor, never fully exclude provider)
   * - VARIABLE_WEIGHT = 0.7
   * - Result range: 0.3 (0% positive) to 1.0 (100% positive)
   *
   * @param positiveRate - Ratio of positive feedback (0.0-1.0)
   * @param totalCount - Total feedback count
   * @returns Weight value (0.3-1.0), or 1.0 if below threshold
   */
  private calculateWeight(positiveRate: number, totalCount: number): number {
    // Don't adjust weight until we have enough feedback
    if (totalCount < ProviderWeightTracker.MIN_FEEDBACK_THRESHOLD) {
      return 1.0;
    }

    // Calculate weight: 0.3 + (0.7 * positiveRate)
    return ProviderWeightTracker.MIN_WEIGHT +
           (ProviderWeightTracker.VARIABLE_WEIGHT * positiveRate);
  }

  /**
   * Load provider weight data from cache
   */
  private async loadData(): Promise<ProviderWeightData> {
    const raw = await this.storage.read(ProviderWeightTracker.CACHE_KEY);

    if (!raw) {
      return {
        weights: {},
        lastAggregation: Date.now(),
      };
    }

    try {
      return JSON.parse(raw) as ProviderWeightData;
    } catch (error) {
      logger.warn('Failed to parse provider weight data, starting fresh', error as Error);
      return {
        weights: {},
        lastAggregation: Date.now(),
      };
    }
  }

  /**
   * Save provider weight data to cache
   */
  private async saveData(data: ProviderWeightData): Promise<void> {
    await this.storage.write(ProviderWeightTracker.CACHE_KEY, JSON.stringify(data));
  }
}
