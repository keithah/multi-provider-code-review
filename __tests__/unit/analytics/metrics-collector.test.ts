import { MetricsCollector } from '../../../src/analytics/metrics-collector';
import { Review } from '../../../src/types';
import { CacheStorage } from '../../../src/cache/storage';
import * as path from 'path';
import * as fs from 'fs/promises';

describe('MetricsCollector', () => {
  let collector: MetricsCollector;
  let testCacheDir: string;

  beforeEach(async () => {
    // Use a unique cache directory for each test run to avoid interference
    testCacheDir = path.join(process.cwd(), `.mpr-cache-test-${Date.now()}`);
    const storage = new CacheStorage(testCacheDir);
    collector = new MetricsCollector(storage);
    // Clear all metrics before each test for isolation
    await collector.clear();
  });

  afterEach(async () => {
    // Clean up test cache directory
    try {
      await fs.rm(testCacheDir, { recursive: true, force: true });
    } catch {
      // Ignore cleanup errors
    }
  });

  describe('recordReview', () => {
    it('should record a review metric', async () => {
      const review: Partial<Review> = {
        findings: [{} as any, {} as any],
        metrics: {
          totalFindings: 2,
          critical: 0,
          major: 1,
          minor: 1,
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

      await collector.recordReview(review as Review, 123);

      const metrics = await collector.getMetrics();
      expect(metrics).toHaveLength(1);
      expect(metrics[0].prNumber).toBe(123);
      expect(metrics[0].findingsCount).toBe(2);
    });

    it('should limit stored metrics to max count', async () => {
      // Test that old metrics are pruned when max is reached
      const review = {
        findings: [],
        metrics: {
          totalFindings: 0,
          critical: 0,
          major: 0,
          minor: 0,
          durationSeconds: 0,
          totalCost: 0,
          totalTokens: 0,
          providersUsed: 0,
          providersSuccess: 0,
          providersFailed: 0,
        }
      } as any;

      // Record more than max
      for (let i = 0; i < 1100; i++) {
        await collector.recordReview(review, i);
      }

      const metrics = await collector.getMetrics();
      expect(metrics.length).toBeLessThanOrEqual(1000);
    }, 10000); // Increase timeout to 10 seconds for this test
  });

  describe('getMetrics', () => {
    it('should return empty array when no metrics recorded', async () => {
      const metrics = await collector.getMetrics();
      expect(metrics).toEqual([]);
    });

    it('should return metrics in chronological order', async () => {
      const review = {
        findings: [],
        metrics: {
          totalFindings: 0,
          critical: 0,
          major: 0,
          minor: 0,
          durationSeconds: 0,
          totalCost: 0,
          totalTokens: 0,
          providersUsed: 0,
          providersSuccess: 0,
          providersFailed: 0,
        }
      } as any;

      await collector.recordReview(review, 1);
      await collector.recordReview(review, 2);

      const metrics = await collector.getMetrics();
      expect(metrics[0].prNumber).toBeLessThan(metrics[1].prNumber);
    });
  });
});
