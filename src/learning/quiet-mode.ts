import { Finding } from '../types';
import { FeedbackTracker } from './feedback-tracker';
import { logger } from '../utils/logger';

export interface QuietModeConfig {
  enabled: boolean;
  minConfidence: number;
  useLearning: boolean;
}

/**
 * Filters findings based on confidence thresholds, optionally using
 * learned thresholds from feedback data.
 *
 * Quiet mode reduces noise by only showing high-confidence findings,
 * with thresholds adjusted based on user feedback over time.
 */
export class QuietModeFilter {
  constructor(
    private readonly config: QuietModeConfig,
    private readonly feedbackTracker?: FeedbackTracker
  ) {}

  /**
   * Filter findings based on confidence thresholds
   * Returns only findings that meet the confidence criteria
   */
  async filterByConfidence(findings: Finding[]): Promise<Finding[]> {
    if (!this.config.enabled) {
      logger.debug('Quiet mode disabled, returning all findings');
      return findings;
    }

    logger.info(`Quiet mode enabled (min confidence: ${this.config.minConfidence}), filtering findings`);

    const filtered: Finding[] = [];
    const rejected: Finding[] = [];

    for (const finding of findings) {
      const threshold = await this.getThreshold(finding);
      const confidence = finding.confidence || 0;

      if (confidence >= threshold) {
        filtered.push(finding);
      } else {
        rejected.push(finding);
        logger.debug(
          `Filtered out ${finding.category} finding (confidence: ${confidence.toFixed(2)}, threshold: ${threshold.toFixed(2)})`
        );
      }
    }

    const filterRate = findings.length > 0 ? (rejected.length / findings.length) * 100 : 0;

    logger.info(
      `Quiet mode filtered ${rejected.length}/${findings.length} findings (${filterRate.toFixed(1)}% reduction)`
    );

    return filtered;
  }

  /**
   * Get statistics about what would be filtered
   */
  async getFilterStats(findings: Finding[]): Promise<{
    total: number;
    filtered: number;
    kept: number;
    filterRate: number;
    byCategory: Record<string, { total: number; filtered: number; kept: number }>;
  }> {
    if (!this.config.enabled) {
      return {
        total: findings.length,
        filtered: 0,
        kept: findings.length,
        filterRate: 0,
        byCategory: {},
      };
    }

    const byCategory: Record<string, { total: number; filtered: number; kept: number }> = {};
    let totalFiltered = 0;

    for (const finding of findings) {
      const threshold = await this.getThreshold(finding);
      const confidence = finding.confidence || 0;
      const category = finding.category || 'unknown';

      if (!byCategory[category]) {
        byCategory[category] = { total: 0, filtered: 0, kept: 0 };
      }

      byCategory[category].total++;

      if (confidence >= threshold) {
        byCategory[category].kept++;
      } else {
        byCategory[category].filtered++;
        totalFiltered++;
      }
    }

    return {
      total: findings.length,
      filtered: totalFiltered,
      kept: findings.length - totalFiltered,
      filterRate: findings.length > 0 ? (totalFiltered / findings.length) * 100 : 0,
      byCategory,
    };
  }

  /**
   * Get the confidence threshold for a finding
   * Uses learned threshold if available, otherwise falls back to config
   */
  private async getThreshold(finding: Finding): Promise<number> {
    if (!this.config.useLearning || !this.feedbackTracker) {
      return this.config.minConfidence;
    }

    const category = finding.category || 'unknown';
    const learnedThreshold = await this.feedbackTracker.getConfidenceThreshold(category);

    // Use the higher of learned threshold or configured minimum
    return Math.max(learnedThreshold, this.config.minConfidence);
  }
}
