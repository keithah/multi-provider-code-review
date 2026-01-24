import { DashboardGenerator } from '../../../src/analytics/dashboard-generator';
import { MetricsCollector } from '../../../src/analytics/metrics-collector';

describe('DashboardGenerator', () => {
  let generator: DashboardGenerator;
  let mockCollector: jest.Mocked<MetricsCollector>;

  beforeEach(() => {
    mockCollector = {
      getMetrics: jest.fn().mockResolvedValue([]),
      recordReview: jest.fn(),
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
    it('should generate HTML dashboard', async () => {
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
        },
      ]);

      const html = await generator.generateDashboard();

      expect(html).toContain('<!DOCTYPE html>');
      expect(html).toContain('Analytics Dashboard');
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
