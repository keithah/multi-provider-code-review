import { SuppressionTracker, SuppressionPattern } from './suppression-tracker';
import { FeedbackTracker, CategoryStats } from './feedback-tracker';
import { logger } from '../utils/logger';

export interface EnrichmentContext {
  suppressedCategories: string[];        // Categories with active suppressions
  lowQualityCategories: string[];        // Categories with <50% positive rate
  repoPreferences: string[];             // Human-readable preference descriptions
  promptAdditions: string[];             // Lines to add to prompt
}

export interface EnrichmentConfig {
  minFeedbackForLowQuality: number;      // Min feedback before flagging (default: 5)
  lowQualityThreshold: number;           // Positive rate below this is "low quality" (default: 0.5)
  maxSuppressionCategories: number;      // Max categories to mention (default: 5)
}

const DEFAULT_CONFIG: EnrichmentConfig = {
  minFeedbackForLowQuality: 5,
  lowQualityThreshold: 0.5,
  maxSuppressionCategories: 5
};

export class PromptEnricher {
  private readonly config: EnrichmentConfig;

  constructor(
    private readonly suppressionTracker?: SuppressionTracker,
    private readonly feedbackTracker?: FeedbackTracker,
    config?: Partial<EnrichmentConfig>
  ) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  /**
   * Get enrichment context for a specific PR.
   * Aggregates suppression patterns and feedback stats.
   */
  async getEnrichmentContext(prNumber: number): Promise<EnrichmentContext> {
    const context: EnrichmentContext = {
      suppressedCategories: [],
      lowQualityCategories: [],
      repoPreferences: [],
      promptAdditions: []
    };

    // Get suppressed categories from SuppressionTracker
    if (this.suppressionTracker) {
      const suppressions = await this.getSuppressedCategories(prNumber);
      context.suppressedCategories = suppressions.slice(0, this.config.maxSuppressionCategories);
    }

    // Get low-quality categories from FeedbackTracker
    if (this.feedbackTracker) {
      const categoryStats = await this.feedbackTracker.getCategoryStats();
      context.lowQualityCategories = this.identifyLowQualityCategories(categoryStats);
    }

    // Generate human-readable preferences
    context.repoPreferences = this.generatePreferences(context);

    // Generate prompt additions
    context.promptAdditions = this.generatePromptAdditions(context);

    return context;
  }

  /**
   * Get prompt text to inject into LLM prompt.
   * Returns empty string if no enrichment available.
   */
  async getPromptText(prNumber: number): Promise<string> {
    const context = await this.getEnrichmentContext(prNumber);

    if (context.promptAdditions.length === 0) {
      return '';
    }

    return [
      'LEARNED PREFERENCES (from user feedback in this repository):',
      ...context.promptAdditions,
      ''
    ].join('\n');
  }

  private async getSuppressedCategories(prNumber: number): Promise<string[]> {
    // This would need a method on SuppressionTracker to get active categories
    // For now, return empty - will be wired when SuppressionTracker adds this method
    // The SuppressionTracker stores patterns with categories, so this is retrievable
    try {
      // Assume SuppressionTracker has getActiveCategories method (add if not present)
      const categories = await (this.suppressionTracker as any).getActiveCategories?.(prNumber);
      return categories || [];
    } catch {
      return [];
    }
  }

  private identifyLowQualityCategories(stats: Record<string, CategoryStats>): string[] {
    return Object.values(stats)
      .filter(s =>
        s.totalFeedback >= this.config.minFeedbackForLowQuality &&
        s.positiveRate < this.config.lowQualityThreshold
      )
      .map(s => s.category)
      .slice(0, this.config.maxSuppressionCategories);
  }

  private generatePreferences(context: EnrichmentContext): string[] {
    const prefs: string[] = [];

    if (context.suppressedCategories.length > 0) {
      prefs.push(`User has dismissed suggestions in these categories: ${context.suppressedCategories.join(', ')}`);
    }

    if (context.lowQualityCategories.length > 0) {
      prefs.push(`These categories have high false-positive rates: ${context.lowQualityCategories.join(', ')}`);
    }

    return prefs;
  }

  private generatePromptAdditions(context: EnrichmentContext): string[] {
    const additions: string[] = [];

    if (context.suppressedCategories.length > 0) {
      additions.push(
        `- AVOID suggesting fixes in these categories (recently dismissed): ${context.suppressedCategories.join(', ')}`
      );
    }

    if (context.lowQualityCategories.length > 0) {
      additions.push(
        `- BE EXTRA CAREFUL with these categories (high false-positive history): ${context.lowQualityCategories.join(', ')}`
      );
    }

    return additions;
  }
}
