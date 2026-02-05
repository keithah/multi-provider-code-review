import { PromptEnricher, EnrichmentContext } from '../../src/learning/prompt-enrichment';
import { SuppressionTracker } from '../../src/learning/suppression-tracker';
import { FeedbackTracker, CategoryStats } from '../../src/learning/feedback-tracker';

describe('PromptEnricher', () => {
  describe('empty enrichment when no trackers provided', () => {
    it('should return empty context when no trackers provided', async () => {
      const enricher = new PromptEnricher();
      const context = await enricher.getEnrichmentContext(123);

      expect(context.suppressedCategories).toEqual([]);
      expect(context.lowQualityCategories).toEqual([]);
      expect(context.repoPreferences).toEqual([]);
      expect(context.promptAdditions).toEqual([]);
    });

    it('should return empty prompt text when no trackers provided', async () => {
      const enricher = new PromptEnricher();
      const promptText = await enricher.getPromptText(123);

      expect(promptText).toBe('');
    });
  });

  describe('suppressed categories', () => {
    it('should include suppressed categories in context', async () => {
      const mockTracker = {
        getActiveCategories: jest.fn().mockResolvedValue(['null-check', 'type-safety'])
      } as unknown as SuppressionTracker;

      const enricher = new PromptEnricher(mockTracker);
      const context = await enricher.getEnrichmentContext(123);

      expect(context.suppressedCategories).toEqual(['null-check', 'type-safety']);
      expect(mockTracker.getActiveCategories).toHaveBeenCalledWith(123);
    });

    it('should respect max categories limit', async () => {
      const mockTracker = {
        getActiveCategories: jest.fn().mockResolvedValue([
          'cat1', 'cat2', 'cat3', 'cat4', 'cat5', 'cat6', 'cat7'
        ])
      } as unknown as SuppressionTracker;

      const enricher = new PromptEnricher(mockTracker, undefined, {
        maxSuppressionCategories: 3
      });
      const context = await enricher.getEnrichmentContext(123);

      expect(context.suppressedCategories).toEqual(['cat1', 'cat2', 'cat3']);
    });

    it('should handle errors from suppression tracker gracefully', async () => {
      const mockTracker = {
        getActiveCategories: jest.fn().mockRejectedValue(new Error('Storage error'))
      } as unknown as SuppressionTracker;

      const enricher = new PromptEnricher(mockTracker);
      const context = await enricher.getEnrichmentContext(123);

      expect(context.suppressedCategories).toEqual([]);
    });
  });

  describe('low-quality categories', () => {
    it('should identify categories with high false-positive rate', async () => {
      const mockStats: Record<string, CategoryStats> = {
        'good-category': {
          category: 'good-category',
          totalFeedback: 10,
          positiveCount: 8,
          negativeCount: 2,
          positiveRate: 0.8,
          confidenceThreshold: 0.5,
          lastUpdated: Date.now()
        },
        'bad-category': {
          category: 'bad-category',
          totalFeedback: 10,
          positiveCount: 3,
          negativeCount: 7,
          positiveRate: 0.3,
          confidenceThreshold: 0.7,
          lastUpdated: Date.now()
        }
      };

      const mockFeedbackTracker = {
        getCategoryStats: jest.fn().mockResolvedValue(mockStats)
      } as unknown as FeedbackTracker;

      const enricher = new PromptEnricher(undefined, mockFeedbackTracker);
      const context = await enricher.getEnrichmentContext(123);

      expect(context.lowQualityCategories).toEqual(['bad-category']);
    });

    it('should require minimum feedback count before flagging', async () => {
      const mockStats: Record<string, CategoryStats> = {
        'low-feedback': {
          category: 'low-feedback',
          totalFeedback: 3,
          positiveCount: 0,
          negativeCount: 3,
          positiveRate: 0.0,
          confidenceThreshold: 0.5,
          lastUpdated: Date.now()
        }
      };

      const mockFeedbackTracker = {
        getCategoryStats: jest.fn().mockResolvedValue(mockStats)
      } as unknown as FeedbackTracker;

      const enricher = new PromptEnricher(undefined, mockFeedbackTracker);
      const context = await enricher.getEnrichmentContext(123);

      // Should not include category with only 3 feedback items (default min is 5)
      expect(context.lowQualityCategories).toEqual([]);
    });

    it('should respect custom low quality threshold', async () => {
      const mockStats: Record<string, CategoryStats> = {
        'borderline-category': {
          category: 'borderline-category',
          totalFeedback: 10,
          positiveCount: 6,
          negativeCount: 4,
          positiveRate: 0.6,
          confidenceThreshold: 0.5,
          lastUpdated: Date.now()
        }
      };

      const mockFeedbackTracker = {
        getCategoryStats: jest.fn().mockResolvedValue(mockStats)
      } as unknown as FeedbackTracker;

      const enricher = new PromptEnricher(undefined, mockFeedbackTracker, {
        lowQualityThreshold: 0.7  // Category with 0.6 rate should now be flagged
      });
      const context = await enricher.getEnrichmentContext(123);

      expect(context.lowQualityCategories).toEqual(['borderline-category']);
    });
  });

  describe('prompt text generation', () => {
    it('should generate prompt text with suppressed categories', async () => {
      const mockTracker = {
        getActiveCategories: jest.fn().mockResolvedValue(['null-check', 'type-safety'])
      } as unknown as SuppressionTracker;

      const enricher = new PromptEnricher(mockTracker);
      const promptText = await enricher.getPromptText(123);

      expect(promptText).toContain('LEARNED PREFERENCES');
      expect(promptText).toContain('AVOID suggesting fixes in these categories');
      expect(promptText).toContain('null-check, type-safety');
    });

    it('should generate prompt text with low-quality categories', async () => {
      const mockStats: Record<string, CategoryStats> = {
        'bad-category': {
          category: 'bad-category',
          totalFeedback: 10,
          positiveCount: 3,
          negativeCount: 7,
          positiveRate: 0.3,
          confidenceThreshold: 0.7,
          lastUpdated: Date.now()
        }
      };

      const mockFeedbackTracker = {
        getCategoryStats: jest.fn().mockResolvedValue(mockStats)
      } as unknown as FeedbackTracker;

      const enricher = new PromptEnricher(undefined, mockFeedbackTracker);
      const promptText = await enricher.getPromptText(123);

      expect(promptText).toContain('LEARNED PREFERENCES');
      expect(promptText).toContain('BE EXTRA CAREFUL with these categories');
      expect(promptText).toContain('bad-category');
    });

    it('should combine both suppressed and low-quality categories', async () => {
      const mockTracker = {
        getActiveCategories: jest.fn().mockResolvedValue(['null-check'])
      } as unknown as SuppressionTracker;

      const mockStats: Record<string, CategoryStats> = {
        'bad-category': {
          category: 'bad-category',
          totalFeedback: 10,
          positiveCount: 3,
          negativeCount: 7,
          positiveRate: 0.3,
          confidenceThreshold: 0.7,
          lastUpdated: Date.now()
        }
      };

      const mockFeedbackTracker = {
        getCategoryStats: jest.fn().mockResolvedValue(mockStats)
      } as unknown as FeedbackTracker;

      const enricher = new PromptEnricher(mockTracker, mockFeedbackTracker);
      const promptText = await enricher.getPromptText(123);

      expect(promptText).toContain('AVOID suggesting fixes');
      expect(promptText).toContain('null-check');
      expect(promptText).toContain('BE EXTRA CAREFUL');
      expect(promptText).toContain('bad-category');
    });

    it('should return empty string when no enrichment available', async () => {
      const mockTracker = {
        getActiveCategories: jest.fn().mockResolvedValue([])
      } as unknown as SuppressionTracker;

      const mockFeedbackTracker = {
        getCategoryStats: jest.fn().mockResolvedValue({})
      } as unknown as FeedbackTracker;

      const enricher = new PromptEnricher(mockTracker, mockFeedbackTracker);
      const promptText = await enricher.getPromptText(123);

      expect(promptText).toBe('');
    });
  });

  describe('repo preferences', () => {
    it('should generate human-readable preference descriptions', async () => {
      const mockTracker = {
        getActiveCategories: jest.fn().mockResolvedValue(['null-check'])
      } as unknown as SuppressionTracker;

      const mockStats: Record<string, CategoryStats> = {
        'bad-category': {
          category: 'bad-category',
          totalFeedback: 10,
          positiveCount: 3,
          negativeCount: 7,
          positiveRate: 0.3,
          confidenceThreshold: 0.7,
          lastUpdated: Date.now()
        }
      };

      const mockFeedbackTracker = {
        getCategoryStats: jest.fn().mockResolvedValue(mockStats)
      } as unknown as FeedbackTracker;

      const enricher = new PromptEnricher(mockTracker, mockFeedbackTracker);
      const context = await enricher.getEnrichmentContext(123);

      expect(context.repoPreferences).toContain(
        'User has dismissed suggestions in these categories: null-check'
      );
      expect(context.repoPreferences).toContain(
        'These categories have high false-positive rates: bad-category'
      );
    });
  });
});
