import { Finding } from '../types';
import { CacheStorage } from '../cache/storage';
import { logger } from '../utils/logger';

export type ReactionType = '👍' | '👎';

export interface FeedbackRecord {
  findingId: string;
  category: string;
  severity: string;
  reaction: ReactionType;
  timestamp: number;
  prNumber?: number;
}

export interface CategoryStats {
  category: string;
  totalFeedback: number;
  positiveCount: number;
  negativeCount: number;
  positiveRate: number;
  confidenceThreshold: number;
  lastUpdated: number;
}

export interface FeedbackData {
  records: FeedbackRecord[];
  categoryStats: Record<string, CategoryStats>;
  lastAggregation: number;
}

/**
 * Tracks feedback (thumbs up/down reactions) and adjusts confidence thresholds
 * per category based on user feedback.
 *
 * Learning algorithm:
 * - Track reactions per finding category
 * - Calculate positive rate: 👍 / (👍 + 👎)
 * - Adjust confidence thresholds:
 *   - If positive_rate > 0.8: increase threshold (show fewer of this category)
 *   - If positive_rate < 0.5: decrease threshold (show more of this category)
 * - Use weighted averages with decay over time
 */
export class FeedbackTracker {
  private static readonly CACHE_KEY = 'feedback-learning-data';
  private static readonly DEFAULT_THRESHOLD = 0.5;
  private static readonly HIGH_QUALITY_THRESHOLD = 0.8;
  private static readonly LOW_QUALITY_THRESHOLD = 0.5;
  private static readonly THRESHOLD_ADJUSTMENT = 0.1;
  private static readonly MIN_THRESHOLD = 0.3;
  private static readonly MAX_THRESHOLD = 0.9;
  private static readonly MIN_FEEDBACK_FOR_LEARNING = 5;
  private static readonly AGGREGATION_INTERVAL_MS = 24 * 60 * 60 * 1000; // 1 day

  constructor(
    private readonly storage = new CacheStorage(),
    private readonly minFeedbackCount = FeedbackTracker.MIN_FEEDBACK_FOR_LEARNING
  ) {}

  /**
   * Record a reaction to a finding
   */
  async recordReaction(
    findingId: string,
    category: string,
    severity: string,
    reaction: ReactionType,
    prNumber?: number
  ): Promise<void> {
    const data = await this.loadData();

    const record: FeedbackRecord = {
      findingId,
      category,
      severity,
      reaction,
      timestamp: Date.now(),
      prNumber,
    };

    data.records.push(record);

    // Check if we should aggregate
    const timeSinceAggregation = Date.now() - data.lastAggregation;
    if (timeSinceAggregation > FeedbackTracker.AGGREGATION_INTERVAL_MS) {
      await this.aggregateAndAdjust(data);
    }

    await this.saveData(data);

    logger.info(`Recorded ${reaction} feedback for finding ${findingId} (category: ${category})`);
  }

  /**
   * Get the current confidence threshold for a category
   * Returns higher threshold for categories with high false positive rate
   */
  async getConfidenceThreshold(category: string): Promise<number> {
    const data = await this.loadData();
    const stats = data.categoryStats[category];

    if (!stats) {
      return FeedbackTracker.DEFAULT_THRESHOLD;
    }

    return stats.confidenceThreshold;
  }

  /**
   * Get all category statistics
   */
  async getCategoryStats(): Promise<Record<string, CategoryStats>> {
    const data = await this.loadData();
    return data.categoryStats;
  }

  /**
   * Get feedback records for a specific finding
   */
  async getFindingFeedback(findingId: string): Promise<FeedbackRecord[]> {
    const data = await this.loadData();
    return data.records.filter((r) => r.findingId === findingId);
  }

  /**
   * Aggregate feedback and adjust confidence thresholds
   */
  async adjustWeights(): Promise<void> {
    const data = await this.loadData();
    await this.aggregateAndAdjust(data);
    await this.saveData(data);
  }

  /**
   * Clear all feedback data (useful for testing)
   */
  async clear(): Promise<void> {
    const emptyData: FeedbackData = {
      records: [],
      categoryStats: {},
      lastAggregation: Date.now(),
    };
    await this.saveData(emptyData);
    logger.info('Cleared all feedback data');
  }

  /**
   * Get feedback statistics summary
   */
  async getStats(): Promise<{
    totalFeedback: number;
    categoriesTracked: number;
    overallPositiveRate: number;
    lastAggregation: number;
  }> {
    const data = await this.loadData();
    const totalPositive = data.records.filter((r) => r.reaction === '👍').length;
    const totalNegative = data.records.filter((r) => r.reaction === '👎').length;
    const total = totalPositive + totalNegative;

    return {
      totalFeedback: total,
      categoriesTracked: Object.keys(data.categoryStats).length,
      overallPositiveRate: total > 0 ? totalPositive / total : 0,
      lastAggregation: data.lastAggregation,
    };
  }

  /**
   * Load feedback data from cache
   */
  private async loadData(): Promise<FeedbackData> {
    const raw = await this.storage.read(FeedbackTracker.CACHE_KEY);
    if (!raw) {
      return {
        records: [],
        categoryStats: {},
        lastAggregation: Date.now(),
      };
    }

    try {
      return JSON.parse(raw) as FeedbackData;
    } catch (error) {
      logger.warn('Failed to parse feedback data, starting fresh', error as Error);
      return {
        records: [],
        categoryStats: {},
        lastAggregation: Date.now(),
      };
    }
  }

  /**
   * Save feedback data to cache
   */
  private async saveData(data: FeedbackData): Promise<void> {
    await this.storage.write(FeedbackTracker.CACHE_KEY, JSON.stringify(data));
  }

  /**
   * Aggregate feedback records and adjust confidence thresholds
   */
  private async aggregateAndAdjust(data: FeedbackData): Promise<void> {
    logger.info('Aggregating feedback and adjusting confidence thresholds');

    // Group feedback by category
    const categoryGroups = new Map<string, FeedbackRecord[]>();
    for (const record of data.records) {
      const group = categoryGroups.get(record.category) || [];
      group.push(record);
      categoryGroups.set(record.category, group);
    }

    // Calculate stats and adjust thresholds for each category
    for (const [category, records] of categoryGroups) {
      const positiveCount = records.filter((r) => r.reaction === '👍').length;
      const negativeCount = records.filter((r) => r.reaction === '👎').length;
      const totalCount = positiveCount + negativeCount;

      // Skip if not enough feedback
      if (totalCount < this.minFeedbackCount) {
        continue;
      }

      const positiveRate = positiveCount / totalCount;
      const currentStats = data.categoryStats[category];
      const currentThreshold = currentStats?.confidenceThreshold || FeedbackTracker.DEFAULT_THRESHOLD;

      // Adjust threshold based on positive rate
      let newThreshold = currentThreshold;

      if (positiveRate > FeedbackTracker.HIGH_QUALITY_THRESHOLD) {
        // High quality findings - can show more (lower threshold)
        newThreshold = Math.max(
          FeedbackTracker.MIN_THRESHOLD,
          currentThreshold - FeedbackTracker.THRESHOLD_ADJUSTMENT
        );
        logger.debug(
          `Category ${category}: High quality (${(positiveRate * 100).toFixed(1)}%), lowering threshold ${currentThreshold.toFixed(2)} → ${newThreshold.toFixed(2)}`
        );
      } else if (positiveRate < FeedbackTracker.LOW_QUALITY_THRESHOLD) {
        // Low quality findings - show fewer (raise threshold)
        newThreshold = Math.min(
          FeedbackTracker.MAX_THRESHOLD,
          currentThreshold + FeedbackTracker.THRESHOLD_ADJUSTMENT
        );
        logger.debug(
          `Category ${category}: Low quality (${(positiveRate * 100).toFixed(1)}%), raising threshold ${currentThreshold.toFixed(2)} → ${newThreshold.toFixed(2)}`
        );
      }

      // Update category stats
      data.categoryStats[category] = {
        category,
        totalFeedback: totalCount,
        positiveCount,
        negativeCount,
        positiveRate,
        confidenceThreshold: newThreshold,
        lastUpdated: Date.now(),
      };

      logger.info(
        `Updated ${category}: ${positiveCount}👍 ${negativeCount}👎 (${(positiveRate * 100).toFixed(1)}% positive), threshold: ${newThreshold.toFixed(2)}`
      );
    }

    data.lastAggregation = Date.now();
  }
}
