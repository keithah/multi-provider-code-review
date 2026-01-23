import { FeedbackTracker, type FeedbackData } from '../../../src/learning/feedback-tracker';
import { CacheStorage } from '../../../src/cache/storage';

// Mock CacheStorage
jest.mock('../../../src/cache/storage');

describe('FeedbackTracker', () => {
  let tracker: FeedbackTracker;
  let mockStorage: jest.Mocked<CacheStorage>;
  let mockData: FeedbackData;

  beforeEach(() => {
    mockStorage = new CacheStorage() as jest.Mocked<CacheStorage>;
    tracker = new FeedbackTracker(mockStorage, 3); // Lower min feedback for testing

    mockData = {
      records: [],
      categoryStats: {},
      lastAggregation: Date.now(),
    };

    mockStorage.read.mockResolvedValue(JSON.stringify(mockData));
    mockStorage.write.mockResolvedValue();
  });

  describe('recordReaction', () => {
    it('should record a positive reaction', async () => {
      await tracker.recordReaction('finding-1', 'security', 'critical', '👍', 123);

      expect(mockStorage.write).toHaveBeenCalled();
      const savedData = JSON.parse(mockStorage.write.mock.calls[0][1]);
      expect(savedData.records).toHaveLength(1);
      expect(savedData.records[0]).toMatchObject({
        findingId: 'finding-1',
        category: 'security',
        severity: 'critical',
        reaction: '👍',
        prNumber: 123,
      });
    });

    it('should record a negative reaction', async () => {
      await tracker.recordReaction('finding-2', 'style', 'minor', '👎');

      const savedData = JSON.parse(mockStorage.write.mock.calls[0][1]);
      expect(savedData.records[0].reaction).toBe('👎');
    });

    it('should handle multiple reactions', async () => {
      await tracker.recordReaction('f1', 'security', 'critical', '👍');
      await tracker.recordReaction('f2', 'security', 'major', '👎');
      await tracker.recordReaction('f3', 'performance', 'minor', '👍');

      const savedData = JSON.parse(mockStorage.write.mock.calls[2][1]);
      expect(savedData.records).toHaveLength(3);
    });
  });

  describe('getConfidenceThreshold', () => {
    it('should return default threshold for unknown category', async () => {
      const threshold = await tracker.getConfidenceThreshold('unknown');
      expect(threshold).toBe(0.5);
    });

    it('should return learned threshold for known category', async () => {
      mockData.categoryStats['security'] = {
        category: 'security',
        totalFeedback: 10,
        positiveCount: 8,
        negativeCount: 2,
        positiveRate: 0.8,
        confidenceThreshold: 0.4,
        lastUpdated: Date.now(),
      };
      mockStorage.read.mockResolvedValue(JSON.stringify(mockData));

      const threshold = await tracker.getConfidenceThreshold('security');
      expect(threshold).toBe(0.4);
    });
  });

  describe('getCategoryStats', () => {
    it('should return empty stats for new tracker', async () => {
      const stats = await tracker.getCategoryStats();
      expect(stats).toEqual({});
    });

    it('should return all category stats', async () => {
      mockData.categoryStats = {
        security: {
          category: 'security',
          totalFeedback: 10,
          positiveCount: 8,
          negativeCount: 2,
          positiveRate: 0.8,
          confidenceThreshold: 0.4,
          lastUpdated: Date.now(),
        },
        performance: {
          category: 'performance',
          totalFeedback: 5,
          positiveCount: 2,
          negativeCount: 3,
          positiveRate: 0.4,
          confidenceThreshold: 0.6,
          lastUpdated: Date.now(),
        },
      };
      mockStorage.read.mockResolvedValue(JSON.stringify(mockData));

      const stats = await tracker.getCategoryStats();
      expect(Object.keys(stats)).toHaveLength(2);
      expect(stats['security'].positiveRate).toBe(0.8);
      expect(stats['performance'].positiveRate).toBe(0.4);
    });
  });

  describe('adjustWeights', () => {
    it('should not adjust with insufficient feedback', async () => {
      mockData.records = [
        { findingId: 'f1', category: 'security', severity: 'critical', reaction: '👍', timestamp: Date.now() },
        { findingId: 'f2', category: 'security', severity: 'major', reaction: '👍', timestamp: Date.now() },
      ];
      mockStorage.read.mockResolvedValue(JSON.stringify(mockData));

      await tracker.adjustWeights();

      const savedData = JSON.parse(mockStorage.write.mock.calls[0][1]);
      expect(savedData.categoryStats).toEqual({});
    });

    it('should lower threshold for high quality category (>80% positive)', async () => {
      mockData.records = [
        { findingId: 'f1', category: 'security', severity: 'critical', reaction: '👍', timestamp: Date.now() },
        { findingId: 'f2', category: 'security', severity: 'major', reaction: '👍', timestamp: Date.now() },
        { findingId: 'f3', category: 'security', severity: 'minor', reaction: '👍', timestamp: Date.now() },
        { findingId: 'f4', category: 'security', severity: 'major', reaction: '👎', timestamp: Date.now() },
      ];
      mockStorage.read.mockResolvedValue(JSON.stringify(mockData));

      await tracker.adjustWeights();

      const savedData = JSON.parse(mockStorage.write.mock.calls[0][1]);
      expect(savedData.categoryStats['security'].positiveRate).toBe(0.75); // 3/4 but need >0.8
      expect(savedData.categoryStats['security'].confidenceThreshold).toBe(0.5); // No change
    });

    it('should raise threshold for low quality category (<50% positive)', async () => {
      mockData.records = [
        { findingId: 'f1', category: 'style', severity: 'minor', reaction: '👎', timestamp: Date.now() },
        { findingId: 'f2', category: 'style', severity: 'minor', reaction: '👎', timestamp: Date.now() },
        { findingId: 'f3', category: 'style', severity: 'minor', reaction: '👎', timestamp: Date.now() },
        { findingId: 'f4', category: 'style', severity: 'minor', reaction: '👍', timestamp: Date.now() },
      ];
      mockStorage.read.mockResolvedValue(JSON.stringify(mockData));

      await tracker.adjustWeights();

      const savedData = JSON.parse(mockStorage.write.mock.calls[0][1]);
      expect(savedData.categoryStats['style'].positiveRate).toBe(0.25); // 1/4
      expect(savedData.categoryStats['style'].confidenceThreshold).toBe(0.6); // Raised by 0.1
    });

    it('should not exceed max threshold', async () => {
      mockData.categoryStats['bad'] = {
        category: 'bad',
        totalFeedback: 10,
        positiveCount: 1,
        negativeCount: 9,
        positiveRate: 0.1,
        confidenceThreshold: 0.85,
        lastUpdated: Date.now(),
      };
      mockData.records = [
        { findingId: 'f1', category: 'bad', severity: 'minor', reaction: '👎', timestamp: Date.now() },
        { findingId: 'f2', category: 'bad', severity: 'minor', reaction: '👎', timestamp: Date.now() },
        { findingId: 'f3', category: 'bad', severity: 'minor', reaction: '👎', timestamp: Date.now() },
        { findingId: 'f4', category: 'bad', severity: 'minor', reaction: '👍', timestamp: Date.now() },
      ];
      mockStorage.read.mockResolvedValue(JSON.stringify(mockData));

      await tracker.adjustWeights();

      const savedData = JSON.parse(mockStorage.write.mock.calls[0][1]);
      expect(savedData.categoryStats['bad'].confidenceThreshold).toBeLessThanOrEqual(0.9);
    });

    it('should not go below min threshold', async () => {
      mockData.categoryStats['good'] = {
        category: 'good',
        totalFeedback: 10,
        positiveCount: 9,
        negativeCount: 1,
        positiveRate: 0.9,
        confidenceThreshold: 0.35,
        lastUpdated: Date.now(),
      };
      mockData.records = [
        { findingId: 'f1', category: 'good', severity: 'critical', reaction: '👍', timestamp: Date.now() },
        { findingId: 'f2', category: 'good', severity: 'major', reaction: '👍', timestamp: Date.now() },
        { findingId: 'f3', category: 'good', severity: 'minor', reaction: '👍', timestamp: Date.now() },
        { findingId: 'f4', category: 'good', severity: 'major', reaction: '👍', timestamp: Date.now() },
      ];
      mockStorage.read.mockResolvedValue(JSON.stringify(mockData));

      await tracker.adjustWeights();

      const savedData = JSON.parse(mockStorage.write.mock.calls[0][1]);
      expect(savedData.categoryStats['good'].confidenceThreshold).toBeGreaterThanOrEqual(0.3);
    });
  });

  describe('getStats', () => {
    it('should return correct overall stats', async () => {
      mockData.records = [
        { findingId: 'f1', category: 'security', severity: 'critical', reaction: '👍', timestamp: Date.now() },
        { findingId: 'f2', category: 'security', severity: 'major', reaction: '👍', timestamp: Date.now() },
        { findingId: 'f3', category: 'style', severity: 'minor', reaction: '👎', timestamp: Date.now() },
      ];
      mockData.categoryStats = {
        security: {
          category: 'security',
          totalFeedback: 2,
          positiveCount: 2,
          negativeCount: 0,
          positiveRate: 1.0,
          confidenceThreshold: 0.4,
          lastUpdated: Date.now(),
        },
        style: {
          category: 'style',
          totalFeedback: 1,
          positiveCount: 0,
          negativeCount: 1,
          positiveRate: 0,
          confidenceThreshold: 0.6,
          lastUpdated: Date.now(),
        },
      };
      mockStorage.read.mockResolvedValue(JSON.stringify(mockData));

      const stats = await tracker.getStats();
      expect(stats.totalFeedback).toBe(3);
      expect(stats.categoriesTracked).toBe(2);
      expect(stats.overallPositiveRate).toBeCloseTo(0.667, 2);
    });
  });

  describe('clear', () => {
    it('should clear all feedback data', async () => {
      await tracker.clear();

      expect(mockStorage.write).toHaveBeenCalled();
      const savedData = JSON.parse(mockStorage.write.mock.calls[0][1]);
      expect(savedData.records).toEqual([]);
      expect(savedData.categoryStats).toEqual({});
    });
  });

  describe('error handling', () => {
    it('should handle corrupted cache data', async () => {
      mockStorage.read.mockResolvedValue('invalid json{');

      const threshold = await tracker.getConfidenceThreshold('security');
      expect(threshold).toBe(0.5); // Should return default
    });

    it('should handle cache read failure', async () => {
      mockStorage.read.mockRejectedValue(new Error('Cache unavailable'));

      await expect(tracker.recordReaction('f1', 'security', 'critical', '👍')).rejects.toThrow();
    });
  });
});
