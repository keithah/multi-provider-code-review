import { generateAnalytics, printSummary } from '../../../src/cli/analytics';
import { MetricsCollector } from '../../../src/analytics/metrics-collector';
import { DashboardGenerator } from '../../../src/analytics/dashboard-generator';
import * as fs from 'fs/promises';

jest.mock('../../../src/analytics/metrics-collector');
jest.mock('../../../src/analytics/dashboard-generator');
jest.mock('fs/promises');

describe('CLI Analytics', () => {
  let mockCollector: jest.Mocked<MetricsCollector>;
  let mockGenerator: jest.Mocked<DashboardGenerator>;

  beforeEach(() => {
    jest.clearAllMocks();

    mockCollector = {
      getMetrics: jest.fn().mockResolvedValue([
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
      ]),
      getCostTrends: jest.fn().mockResolvedValue([
        { date: '2024-01-01', cost: 0.05, reviews: 1 },
      ]),
      getProviderStats: jest.fn().mockResolvedValue([
        { provider: 'test-provider', totalReviews: 10, successRate: 0.95, avgCost: 0.01, avgDuration: 25 },
      ]),
      calculateROI: jest.fn().mockResolvedValue({
        totalCost: 0.05,
        estimatedTimeSaved: 0.5,
        estimatedTimeSavedValue: 50,
        roi: 1000,
      }),
    } as any;

    mockGenerator = {
      saveDashboard: jest.fn().mockResolvedValue(undefined),
      saveCSV: jest.fn().mockResolvedValue(undefined),
    } as any;

    (MetricsCollector as jest.MockedClass<typeof MetricsCollector>).mockImplementation(() => mockCollector);
    (DashboardGenerator as jest.MockedClass<typeof DashboardGenerator>).mockImplementation(() => mockGenerator);
  });

  describe('generateAnalytics', () => {
    it('should generate HTML dashboard by default', async () => {
      await generateAnalytics();

      expect(mockGenerator.saveDashboard).toHaveBeenCalledWith(expect.stringContaining('analytics-dashboard.html'));
      expect(mockGenerator.saveCSV).not.toHaveBeenCalled();
    });

    it('should generate CSV when format is csv', async () => {
      await generateAnalytics({ format: 'csv' });

      expect(mockGenerator.saveCSV).toHaveBeenCalledWith(expect.stringContaining('analytics-export.csv'));
      expect(mockGenerator.saveDashboard).not.toHaveBeenCalled();
    });

    it('should generate JSON when format is json', async () => {
      (fs.writeFile as jest.Mock).mockResolvedValue(undefined);

      await generateAnalytics({ format: 'json', days: 7 });

      expect(mockCollector.getMetrics).toHaveBeenCalled();
      expect(fs.writeFile).toHaveBeenCalledWith(
        expect.stringContaining('analytics-metrics.json'),
        expect.any(String),
        'utf8'
      );
    });

    it('should use custom output directory', async () => {
      await generateAnalytics({ output: './custom-reports' });

      expect(mockGenerator.saveDashboard).toHaveBeenCalledWith(expect.stringContaining('custom-reports'));
    });

    it('should handle errors gracefully', async () => {
      mockGenerator.saveDashboard.mockRejectedValue(new Error('Write failed'));
      const exitSpy = jest.spyOn(process, 'exit').mockImplementation(() => undefined as never);

      await generateAnalytics();

      expect(exitSpy).toHaveBeenCalledWith(1);
      exitSpy.mockRestore();
    });
  });

  describe('printSummary', () => {
    let consoleSpy: jest.SpyInstance;

    beforeEach(() => {
      consoleSpy = jest.spyOn(console, 'log').mockImplementation();
    });

    afterEach(() => {
      consoleSpy.mockRestore();
    });

    it('should print summary statistics', async () => {
      await printSummary(30);

      expect(mockCollector.getMetrics).toHaveBeenCalled();
      expect(mockCollector.getCostTrends).toHaveBeenCalledWith(30);
      expect(mockCollector.getProviderStats).toHaveBeenCalled();
      expect(mockCollector.calculateROI).toHaveBeenCalled();
      expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('Analytics Summary'));
      expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('Total Reviews'));
    });

    it('should handle custom days parameter', async () => {
      await printSummary(7);

      expect(mockCollector.getCostTrends).toHaveBeenCalledWith(7);
    });

    it('should handle errors gracefully', async () => {
      mockCollector.getMetrics.mockRejectedValue(new Error('Cache error'));
      const exitSpy = jest.spyOn(process, 'exit').mockImplementation(() => undefined as never);

      await printSummary();

      expect(exitSpy).toHaveBeenCalledWith(1);
      exitSpy.mockRestore();
    });
  });
});
