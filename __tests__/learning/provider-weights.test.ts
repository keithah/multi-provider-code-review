import { ProviderWeightTracker, ProviderWeight } from '../../src/learning/provider-weights';
import { CacheStorage } from '../../src/cache/storage';
import * as fs from 'fs/promises';
import * as path from 'path';

describe('ProviderWeightTracker', () => {
  let storage: CacheStorage;
  let tracker: ProviderWeightTracker;
  const testCacheDir = path.join(process.cwd(), '.test-cache-weights');

  beforeEach(async () => {
    storage = new CacheStorage(testCacheDir);
    tracker = new ProviderWeightTracker(storage);
    // Clear any existing test cache
    await fs.rm(testCacheDir, { recursive: true, force: true });
  });

  afterEach(async () => {
    await fs.rm(testCacheDir, { recursive: true, force: true });
  });

  describe('recordFeedback', () => {
    it('should record positive feedback', async () => {
      await tracker.recordFeedback('claude', '👍');

      const weight = await tracker.getWeight('claude');
      const allWeights = await tracker.getAllWeights();

      expect(allWeights['claude']).toBeDefined();
      expect(allWeights['claude'].positiveCount).toBe(1);
      expect(allWeights['claude'].negativeCount).toBe(0);
      expect(allWeights['claude'].totalCount).toBe(1);
    });

    it('should record negative feedback', async () => {
      await tracker.recordFeedback('gemini', '👎');

      const allWeights = await tracker.getAllWeights();

      expect(allWeights['gemini']).toBeDefined();
      expect(allWeights['gemini'].positiveCount).toBe(0);
      expect(allWeights['gemini'].negativeCount).toBe(1);
      expect(allWeights['gemini'].totalCount).toBe(1);
    });

    it('should accumulate multiple feedback records', async () => {
      await tracker.recordFeedback('claude', '👍');
      await tracker.recordFeedback('claude', '👍');
      await tracker.recordFeedback('claude', '👎');

      const allWeights = await tracker.getAllWeights();
      const claudeWeight = allWeights['claude'];

      expect(claudeWeight.positiveCount).toBe(2);
      expect(claudeWeight.negativeCount).toBe(1);
      expect(claudeWeight.totalCount).toBe(3);
      expect(claudeWeight.positiveRate).toBeCloseTo(2 / 3, 2);
    });
  });

  describe('getWeight', () => {
    it('should return 1.0 for new provider with no feedback', async () => {
      const weight = await tracker.getWeight('new-provider');
      expect(weight).toBe(1.0);
    });

    it('should return 1.0 for providers with < 5 feedback records', async () => {
      // Record 4 feedbacks (below threshold)
      await tracker.recordFeedback('claude', '👍');
      await tracker.recordFeedback('claude', '👍');
      await tracker.recordFeedback('claude', '👎');
      await tracker.recordFeedback('claude', '👎');

      const weight = await tracker.getWeight('claude');
      expect(weight).toBe(1.0); // Still default until 5+ records
    });

    it('should calculate weight for 100% positive rate (5+ records)', async () => {
      // 5 positive feedbacks = 100% positive
      for (let i = 0; i < 5; i++) {
        await tracker.recordFeedback('claude', '👍');
      }

      const weight = await tracker.getWeight('claude');
      // weight = 0.3 + (0.7 * 1.0) = 1.0
      expect(weight).toBe(1.0);
    });

    it('should calculate weight for 80% positive rate', async () => {
      // 4 positive, 1 negative = 80%
      await tracker.recordFeedback('gemini', '👍');
      await tracker.recordFeedback('gemini', '👍');
      await tracker.recordFeedback('gemini', '👍');
      await tracker.recordFeedback('gemini', '👍');
      await tracker.recordFeedback('gemini', '👎');

      const weight = await tracker.getWeight('gemini');
      // weight = 0.3 + (0.7 * 0.8) = 0.86
      expect(weight).toBeCloseTo(0.86, 2);
    });

    it('should calculate weight for 50% positive rate', async () => {
      // 3 positive, 3 negative = 50%
      await tracker.recordFeedback('openrouter', '👍');
      await tracker.recordFeedback('openrouter', '👍');
      await tracker.recordFeedback('openrouter', '👍');
      await tracker.recordFeedback('openrouter', '👎');
      await tracker.recordFeedback('openrouter', '👎');
      await tracker.recordFeedback('openrouter', '👎');

      const weight = await tracker.getWeight('openrouter');
      // weight = 0.3 + (0.7 * 0.5) = 0.65
      expect(weight).toBeCloseTo(0.65, 2);
    });

    it('should calculate weight for 30% positive rate', async () => {
      // 3 positive, 7 negative = 30%
      await tracker.recordFeedback('codex', '👍');
      await tracker.recordFeedback('codex', '👍');
      await tracker.recordFeedback('codex', '👍');
      await tracker.recordFeedback('codex', '👎');
      await tracker.recordFeedback('codex', '👎');
      await tracker.recordFeedback('codex', '👎');
      await tracker.recordFeedback('codex', '👎');
      await tracker.recordFeedback('codex', '👎');
      await tracker.recordFeedback('codex', '👎');
      await tracker.recordFeedback('codex', '👎');

      const weight = await tracker.getWeight('codex');
      // weight = 0.3 + (0.7 * 0.3) = 0.51
      expect(weight).toBeCloseTo(0.51, 2);
    });

    it('should enforce minimum weight of 0.3 (0% positive)', async () => {
      // 0 positive, 5 negative = 0%
      for (let i = 0; i < 5; i++) {
        await tracker.recordFeedback('bad-provider', '👎');
      }

      const weight = await tracker.getWeight('bad-provider');
      // weight = 0.3 + (0.7 * 0.0) = 0.3 (minimum)
      expect(weight).toBe(0.3);
    });
  });

  describe('getAllWeights', () => {
    it('should return empty object if no feedback recorded', async () => {
      const weights = await tracker.getAllWeights();
      expect(weights).toEqual({});
    });

    it('should return weights for all providers with feedback', async () => {
      await tracker.recordFeedback('claude', '👍');
      await tracker.recordFeedback('claude', '👍');
      await tracker.recordFeedback('gemini', '👎');

      const weights = await tracker.getAllWeights();

      expect(Object.keys(weights)).toHaveLength(2);
      expect(weights['claude']).toBeDefined();
      expect(weights['gemini']).toBeDefined();
      expect(weights['claude'].provider).toBe('claude');
      expect(weights['gemini'].provider).toBe('gemini');
    });

    it('should include all ProviderWeight fields', async () => {
      await tracker.recordFeedback('claude', '👍');
      await tracker.recordFeedback('claude', '👎');

      const weights = await tracker.getAllWeights();
      const claudeWeight = weights['claude'];

      expect(claudeWeight).toMatchObject({
        provider: 'claude',
        positiveCount: expect.any(Number),
        negativeCount: expect.any(Number),
        totalCount: expect.any(Number),
        positiveRate: expect.any(Number),
        weight: expect.any(Number),
        lastUpdated: expect.any(Number),
      });
    });
  });

  describe('recalculateWeights', () => {
    it('should recalculate all provider weights', async () => {
      // Record feedback for multiple providers
      for (let i = 0; i < 5; i++) {
        await tracker.recordFeedback('claude', '👍');
      }
      for (let i = 0; i < 3; i++) {
        await tracker.recordFeedback('gemini', '👍');
      }
      for (let i = 0; i < 2; i++) {
        await tracker.recordFeedback('gemini', '👎');
      }

      await tracker.recalculateWeights();

      const weights = await tracker.getAllWeights();
      expect(weights['claude'].weight).toBe(1.0); // 100% positive
      expect(weights['gemini'].weight).toBeCloseTo(0.72, 2); // 60% positive = 0.3 + 0.7*0.6
    });

    it('should update lastUpdated timestamp', async () => {
      const before = Date.now();

      for (let i = 0; i < 5; i++) {
        await tracker.recordFeedback('claude', '👍');
      }

      await tracker.recalculateWeights();

      const weights = await tracker.getAllWeights();
      expect(weights['claude'].lastUpdated).toBeGreaterThanOrEqual(before);
    });
  });

  describe('weight calculation formula', () => {
    it('should follow formula: weight = 0.3 + (0.7 * positiveRate)', async () => {
      const testCases = [
        { positive: 5, negative: 0, expectedWeight: 1.0 },   // 100%
        { positive: 4, negative: 1, expectedWeight: 0.86 },  // 80%
        { positive: 3, negative: 2, expectedWeight: 0.72 },  // 60%
        { positive: 2, negative: 3, expectedWeight: 0.58 },  // 40%
        { positive: 1, negative: 4, expectedWeight: 0.44 },  // 20%
        { positive: 0, negative: 5, expectedWeight: 0.3 },   // 0% (minimum)
      ];

      for (const testCase of testCases) {
        const provider = `provider-${testCase.positive}-${testCase.negative}`;

        for (let i = 0; i < testCase.positive; i++) {
          await tracker.recordFeedback(provider, '👍');
        }
        for (let i = 0; i < testCase.negative; i++) {
          await tracker.recordFeedback(provider, '👎');
        }

        const weight = await tracker.getWeight(provider);
        expect(weight).toBeCloseTo(testCase.expectedWeight, 2);
      }
    });
  });
});
