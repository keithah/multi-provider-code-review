import { Review, Finding } from '../types';
import { CacheStorage } from '../cache/storage';
import { logger } from '../utils/logger';

export interface ReviewMetric {
  timestamp: number;
  prNumber: number;
  filesReviewed: number;
  findingsCount: number;
  costUsd: number;
  durationSeconds: number;
  providersUsed: number;
  cacheHit: boolean;
}

export interface CategoryMetric {
  category: string;
  count: number;
  avgConfidence: number;
}

export interface ProviderMetric {
  provider: string;
  totalReviews: number;
  successRate: number;
  avgCost: number;
  avgDuration: number;
}

export interface MetricsData {
  reviews: ReviewMetric[];
  totalReviews: number;
  totalCost: number;
  totalFindings: number;
  avgReviewTime: number;
  cacheHitRate: number;
  lastUpdated: number;
}

/**
 * Collects and aggregates metrics from reviews for analytics dashboard
 */
export class MetricsCollector {
  private static readonly CACHE_KEY = 'analytics-metrics-data';
  private static readonly MAX_REVIEWS_STORED = 1000; // Keep last 1000 reviews

  constructor(private readonly storage = new CacheStorage()) {}

  /**
   * Record a completed review
   */
  async recordReview(review: Review, prNumber: number): Promise<void> {
    const data = await this.loadData();

    // Calculate files reviewed from findings
    const filesReviewed = new Set(review.findings.map(f => f.file)).size;

    const metric: ReviewMetric = {
      timestamp: Date.now(),
      prNumber,
      filesReviewed,
      findingsCount: review.metrics.totalFindings,
      costUsd: review.metrics.totalCost,
      durationSeconds: review.metrics.durationSeconds,
      providersUsed: review.metrics.providersUsed,
      cacheHit: review.metrics.cached || false,
    };

    data.reviews.push(metric);

    // Keep only last N reviews to prevent unbounded growth
    if (data.reviews.length > MetricsCollector.MAX_REVIEWS_STORED) {
      data.reviews = data.reviews.slice(-MetricsCollector.MAX_REVIEWS_STORED);
    }

    // Update aggregated stats
    this.updateAggregatedStats(data);

    await this.saveData(data);

    logger.debug(`Recorded review metrics for PR #${prNumber}`);
  }

  /**
   * Get metrics for a specific time period
   */
  async getMetrics(fromTimestamp?: number, toTimestamp?: number): Promise<ReviewMetric[]> {
    const data = await this.loadData();

    let filtered = data.reviews;

    if (fromTimestamp) {
      filtered = filtered.filter((r) => r.timestamp >= fromTimestamp);
    }

    if (toTimestamp) {
      filtered = filtered.filter((r) => r.timestamp <= toTimestamp);
    }

    return filtered;
  }

  /**
   * Get aggregated statistics
   */
  async getStats(): Promise<MetricsData> {
    return this.loadData();
  }

  /**
   * Get cost trends over time (grouped by day)
   */
  async getCostTrends(days: number = 30): Promise<Array<{ date: string; cost: number; reviews: number }>> {
    const data = await this.loadData();
    const cutoff = Date.now() - days * 24 * 60 * 60 * 1000;

    const filtered = data.reviews.filter((r) => r.timestamp >= cutoff);

    // Group by day
    const byDay = new Map<string, { cost: number; reviews: number }>();

    for (const review of filtered) {
      const date = new Date(review.timestamp).toISOString().split('T')[0];
      const existing = byDay.get(date) || { cost: 0, reviews: 0 };
      existing.cost += review.costUsd;
      existing.reviews += 1;
      byDay.set(date, existing);
    }

    // Convert to array and sort
    const trends = Array.from(byDay.entries())
      .map(([date, data]) => ({ date, ...data }))
      .sort((a, b) => a.date.localeCompare(b.date));

    return trends;
  }

  /**
   * Get provider performance comparison
   */
  async getProviderStats(): Promise<ProviderMetric[]> {
    const data = await this.loadData();

    // This is simplified - in real implementation would track per-provider
    // For now, return overall stats
    const totalProviders = data.reviews.reduce((sum, r) => sum + r.providersUsed, 0);

    return [
      {
        provider: 'All Providers',
        totalReviews: data.totalReviews,
        successRate: 1.0, // Simplified - all reviews succeeded if they're recorded
        avgCost: data.totalReviews > 0 ? data.totalCost / data.totalReviews : 0,
        avgDuration: data.avgReviewTime,
      },
    ];
  }

  /**
   * Get top finding categories
   */
  async getTopCategories(limit: number = 10): Promise<CategoryMetric[]> {
    // This would need to be tracked separately or extracted from reviews
    // For now, return placeholder
    return [];
  }

  /**
   * Calculate ROI (time saved vs cost)
   */
  async calculateROI(): Promise<{
    totalCost: number;
    estimatedTimeSaved: number;
    estimatedTimeSavedValue: number;
    roi: number;
  }> {
    const data = await this.loadData();

    // Assumptions:
    // - Manual review takes ~30 minutes per PR
    // - Developer time valued at $100/hour
    const avgManualReviewMinutes = 30;
    const developerHourlyRate = 100;

    const totalReviews = data.totalReviews;
    const totalCost = data.totalCost;

    const estimatedTimeSaved = totalReviews * avgManualReviewMinutes; // minutes
    const estimatedTimeSavedValue = (estimatedTimeSaved / 60) * developerHourlyRate; // USD

    const roi = totalCost > 0 ? ((estimatedTimeSavedValue - totalCost) / totalCost) * 100 : 0;

    return {
      totalCost,
      estimatedTimeSaved,
      estimatedTimeSavedValue,
      roi,
    };
  }

  /**
   * Get performance over time (review speed trends)
   */
  async getPerformanceTrends(days: number = 30): Promise<Array<{ date: string; avgDuration: number }>> {
    const data = await this.loadData();
    const cutoff = Date.now() - days * 24 * 60 * 60 * 1000;

    const filtered = data.reviews.filter((r) => r.timestamp >= cutoff);

    // Group by day
    const byDay = new Map<string, { totalDuration: number; count: number }>();

    for (const review of filtered) {
      const date = new Date(review.timestamp).toISOString().split('T')[0];
      const existing = byDay.get(date) || { totalDuration: 0, count: 0 };
      existing.totalDuration += review.durationSeconds;
      existing.count += 1;
      byDay.set(date, existing);
    }

    // Convert to array and calculate averages
    const trends = Array.from(byDay.entries())
      .map(([date, data]) => ({
        date,
        avgDuration: data.count > 0 ? data.totalDuration / data.count : 0,
      }))
      .sort((a, b) => a.date.localeCompare(b.date));

    return trends;
  }

  /**
   * Clear all metrics data
   */
  async clear(): Promise<void> {
    const emptyData: MetricsData = {
      reviews: [],
      totalReviews: 0,
      totalCost: 0,
      totalFindings: 0,
      avgReviewTime: 0,
      cacheHitRate: 0,
      lastUpdated: Date.now(),
    };

    await this.saveData(emptyData);
    logger.info('Cleared all analytics metrics');
  }

  /**
   * Update aggregated statistics
   */
  private updateAggregatedStats(data: MetricsData): void {
    data.totalReviews = data.reviews.length;
    data.totalCost = data.reviews.reduce((sum, r) => sum + r.costUsd, 0);
    data.totalFindings = data.reviews.reduce((sum, r) => sum + r.findingsCount, 0);

    const totalDuration = data.reviews.reduce((sum, r) => sum + r.durationSeconds, 0);
    data.avgReviewTime = data.totalReviews > 0 ? totalDuration / data.totalReviews : 0;

    const cacheHits = data.reviews.filter((r) => r.cacheHit).length;
    data.cacheHitRate = data.totalReviews > 0 ? (cacheHits / data.totalReviews) * 100 : 0;

    data.lastUpdated = Date.now();
  }

  /**
   * Load metrics data from cache
   */
  private async loadData(): Promise<MetricsData> {
    const raw = await this.storage.read(MetricsCollector.CACHE_KEY);
    if (!raw) {
      return {
        reviews: [],
        totalReviews: 0,
        totalCost: 0,
        totalFindings: 0,
        avgReviewTime: 0,
        cacheHitRate: 0,
        lastUpdated: Date.now(),
      };
    }

    try {
      return JSON.parse(raw) as MetricsData;
    } catch (error) {
      logger.warn('Failed to parse metrics data, starting fresh', error as Error);
      return {
        reviews: [],
        totalReviews: 0,
        totalCost: 0,
        totalFindings: 0,
        avgReviewTime: 0,
        cacheHitRate: 0,
        lastUpdated: Date.now(),
      };
    }
  }

  /**
   * Save metrics data to cache
   */
  private async saveData(data: MetricsData): Promise<void> {
    await this.storage.write(MetricsCollector.CACHE_KEY, JSON.stringify(data));
  }
}
