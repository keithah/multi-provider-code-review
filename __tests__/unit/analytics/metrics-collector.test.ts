import { MetricsCollector } from '../../../src/analytics/metrics-collector';
import { Review } from '../../../src/types';

describe('MetricsCollector', () => {
  let collector: MetricsCollector;

  beforeEach(() => {
    collector = new MetricsCollector();
  });

  describe('recordReview', () => {
    it('should record a review metric', async () => {
      const review: Partial<Review> = {
        prNumber: 123,
        findings: [{} as any, {} as any],
        metrics: {
          durationSeconds: 30,
          totalCost: 0.05,
          totalTokens: 1000,
          providersUsed: 3,
          providersSuccess: 3,
          providersFailed: 0,
        },
        runDetails: {
          cacheHit: true,
        } as any,
      };

      await collector.recordReview(review as Review);

      const metrics = await collector.getMetrics();
      expect(metrics).toHaveLength(1);
      expect(metrics[0].prNumber).toBe(123);
      expect(metrics[0].findingsCount).toBe(2);
    });

    it('should limit stored metrics to max count', async () => {
      // Test that old metrics are pruned when max is reached
      const review = { prNumber: 1, findings: [], metrics: { totalCost: 0 } } as any;

      // Record more than max
      for (let i = 0; i < 1100; i++) {
        await collector.recordReview({ ...review, prNumber: i });
      }

      const metrics = await collector.getMetrics();
      expect(metrics.length).toBeLessThanOrEqual(1000);
    });
  });

  describe('getMetrics', () => {
    it('should return empty array when no metrics recorded', async () => {
      const metrics = await collector.getMetrics();
      expect(metrics).toEqual([]);
    });

    it('should return metrics in chronological order', async () => {
      await collector.recordReview({ prNumber: 1 } as any);
      await collector.recordReview({ prNumber: 2 } as any);

      const metrics = await collector.getMetrics();
      expect(metrics[0].prNumber).toBeLessThan(metrics[1].prNumber);
    });
  });
});
