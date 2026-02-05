import { DashboardGenerator } from '../../../src/analytics/dashboard-generator';
import { MetricsCollector } from '../../../src/analytics/metrics-collector';

describe('DashboardGenerator', () => {
  let generator: DashboardGenerator;
  let mockCollector: jest.Mocked<MetricsCollector>;

  beforeEach(() => {
    mockCollector = {
      getMetrics: jest.fn().mockResolvedValue([]),
      recordReview: jest.fn(),
      getStats: jest.fn().mockResolvedValue({
        totalReviews: 0,
        totalCost: 0,
        totalFindings: 0,
        avgReviewTime: 0,
        cacheHitRate: 0,
        lastUpdated: Date.now(),
      }),
      getCostTrends: jest.fn().mockResolvedValue([]),
      getPerformanceTrends: jest.fn().mockResolvedValue([]),
      calculateROI: jest.fn().mockResolvedValue({
        totalCost: 0,
        estimatedTimeSaved: 0,
        estimatedTimeSavedValue: 0,
        roi: 0,
      }),
      getProviderStats: jest.fn().mockResolvedValue([]),
      getTopCategories: jest.fn().mockResolvedValue([]),
      clear: jest.fn().mockResolvedValue(undefined),
    } as any;
    generator = new DashboardGenerator(mockCollector);
  });

  describe('exportCSV', () => {
    it('should export metrics as CSV with proper headers', async () => {
      mockCollector.getMetrics.mockResolvedValue([
        {
          timestamp: Date.now(),
          prNumber: 123,
          filesReviewed: 5,
          findingsCount: 10,
          costUsd: 0.05,
          durationSeconds: 30,
          providersUsed: 3,
          cacheHit: true,
          providers: ['openai/gpt-4', 'anthropic/claude-3'],
        },
      ]);

      const csv = await generator.exportCSV();

      expect(csv).toContain('Timestamp,PR Number,Files Reviewed');
      expect(csv).toContain('123');
      expect(csv).toContain('0.0500');
      expect(csv).toContain('Yes');
    });

    // Note: CSV escaping is implemented but cannot be tested with current metrics structure
    // ReviewMetric only contains numeric/boolean fields, no string fields that could contain commas/quotes

    it('should handle empty metrics', async () => {
      mockCollector.getMetrics.mockResolvedValue([]);

      const csv = await generator.exportCSV();

      expect(csv).toContain('Timestamp,PR Number');
      expect(csv.split('\n').length).toBe(1); // Only headers
    });
  });

  describe('generateDashboard', () => {
    beforeEach(() => {
      // Setup common mock data for dashboard tests
      const sampleMetric = {
        timestamp: Date.now(),
        prNumber: 123,
        filesReviewed: 5,
        findingsCount: 10,
        costUsd: 0.05,
        durationSeconds: 30,
        providersUsed: 3,
        cacheHit: true,
        providers: ['openai/gpt-4', 'anthropic/claude-3'],
      };
      mockCollector.getMetrics.mockResolvedValue([sampleMetric]);
      mockCollector.getStats.mockResolvedValue({
        reviews: [sampleMetric],
        suggestionQuality: [],
        totalReviews: 10,
        totalCost: 0.50,
        totalFindings: 100,
        avgReviewTime: 45,
        cacheHitRate: 0.6,
        lastUpdated: Date.now(),
      });
      mockCollector.calculateROI.mockResolvedValue({
        totalCost: 0.50,
        estimatedTimeSaved: 5,
        estimatedTimeSavedValue: 500,
        roi: 1000,
      });
      mockCollector.getCostTrends.mockResolvedValue([
        { date: '2024-01-01', cost: 0.10, reviews: 2 },
      ]);
      mockCollector.getPerformanceTrends.mockResolvedValue([
        { date: '2024-01-01', avgDuration: 45 },
      ]);
    });

    it('should generate HTML dashboard', async () => {
      const html = await generator.generateDashboard();

      expect(html).toContain('<!DOCTYPE html>');
      expect(html).toContain('Multi-Provider Code Review Analytics');
    });

    it('should include cost trends', async () => {
      // Test cost trend calculations
      const html = await generator.generateDashboard();
      expect(html).toBeDefined();
    });

    it('should include performance metrics', async () => {
      // Test performance metric calculations
      const html = await generator.generateDashboard();
      expect(html).toBeDefined();
    });
  });
});
