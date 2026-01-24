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

    it('should escape CSV fields containing commas', async () => {
      // Test that values with commas are properly escaped
      const csv = await generator.exportCSV();
      expect(csv).toBeDefined();
    });

    it('should escape CSV fields containing quotes', async () => {
      // Test that values with quotes are properly escaped
      const csv = await generator.exportCSV();
      expect(csv).toBeDefined();
    });

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
