import { QuietModeFilter, type QuietModeConfig } from '../../../src/learning/quiet-mode';
import { FeedbackTracker } from '../../../src/learning/feedback-tracker';
import { Finding } from '../../../src/types';

describe('QuietModeFilter', () => {
  const createFinding = (category: string, confidence: number): Finding => ({
    file: 'test.ts',
    line: 10,
    severity: 'major',
    title: 'Test finding',
    message: 'Test message',
    category,
    confidence,
  });

  describe('with quiet mode disabled', () => {
    it('should return all findings when disabled', async () => {
      const config: QuietModeConfig = {
        enabled: false,
        minConfidence: 0.5,
        useLearning: false,
      };
      const filter = new QuietModeFilter(config);
      const findings = [createFinding('security', 0.3), createFinding('style', 0.8)];

      const filtered = await filter.filterByConfidence(findings);

      expect(filtered).toHaveLength(2);
      expect(filtered).toEqual(findings);
    });
  });

  describe('with quiet mode enabled', () => {
    it('should filter findings below threshold', async () => {
      const config: QuietModeConfig = {
        enabled: true,
        minConfidence: 0.5,
        useLearning: false,
      };
      const filter = new QuietModeFilter(config);
      const findings = [
        createFinding('security', 0.3),
        createFinding('security', 0.6),
        createFinding('style', 0.8),
      ];

      const filtered = await filter.filterByConfidence(findings);

      expect(filtered).toHaveLength(2);
      expect(filtered[0].confidence).toBe(0.6);
      expect(filtered[1].confidence).toBe(0.8);
    });

    it('should keep findings exactly at threshold', async () => {
      const config: QuietModeConfig = {
        enabled: true,
        minConfidence: 0.5,
        useLearning: false,
      };
      const filter = new QuietModeFilter(config);
      const findings = [createFinding('security', 0.5)];

      const filtered = await filter.filterByConfidence(findings);

      expect(filtered).toHaveLength(1);
    });

    it('should handle findings without confidence score', async () => {
      const config: QuietModeConfig = {
        enabled: true,
        minConfidence: 0.5,
        useLearning: false,
      };
      const filter = new QuietModeFilter(config);
      const finding: Finding = {
        file: 'test.ts',
        line: 10,
        severity: 'major',
        title: 'Test',
        message: 'Test',
        category: 'security',
        // No confidence
      };

      const filtered = await filter.filterByConfidence([finding]);

      expect(filtered).toHaveLength(0); // Filtered out (treated as 0)
    });

    it('should filter all findings if all below threshold', async () => {
      const config: QuietModeConfig = {
        enabled: true,
        minConfidence: 0.9,
        useLearning: false,
      };
      const filter = new QuietModeFilter(config);
      const findings = [
        createFinding('security', 0.3),
        createFinding('style', 0.5),
        createFinding('performance', 0.7),
      ];

      const filtered = await filter.filterByConfidence(findings);

      expect(filtered).toHaveLength(0);
    });
  });

  describe('with learning enabled', () => {
    it('should use learned thresholds when available', async () => {
      const mockTracker = {
        getConfidenceThreshold: jest.fn(),
      } as unknown as FeedbackTracker;

      (mockTracker.getConfidenceThreshold as jest.Mock).mockImplementation(async (category: string) => {
        if (category === 'security') return 0.3; // Low threshold (show more)
        if (category === 'style') return 0.8; // High threshold (show fewer)
        return 0.5;
      });

      const config: QuietModeConfig = {
        enabled: true,
        minConfidence: 0.5,
        useLearning: true,
      };
      const filter = new QuietModeFilter(config, mockTracker);
      const findings = [
        createFinding('security', 0.4), // Above learned (0.3), below config (0.5)
        createFinding('style', 0.6), // Below learned (0.8)
      ];

      const filtered = await filter.filterByConfidence(findings);

      // Should use max(learned, config)
      // security: max(0.3, 0.5) = 0.5 -> 0.4 filtered out
      // style: max(0.8, 0.5) = 0.8 -> 0.6 filtered out
      expect(filtered).toHaveLength(0);
    });

    it('should use config threshold as minimum', async () => {
      const mockTracker = {
        getConfidenceThreshold: jest.fn(),
      } as unknown as FeedbackTracker;

      (mockTracker.getConfidenceThreshold as jest.Mock).mockResolvedValue(0.3); // Learned threshold

      const config: QuietModeConfig = {
        enabled: true,
        minConfidence: 0.6, // Higher than learned
        useLearning: true,
      };
      const filter = new QuietModeFilter(config, mockTracker);
      const findings = [
        createFinding('security', 0.4), // Above learned (0.3), below config (0.6)
        createFinding('security', 0.7), // Above both
      ];

      const filtered = await filter.filterByConfidence(findings);

      expect(filtered).toHaveLength(1);
      expect(filtered[0].confidence).toBe(0.7);
    });

    it('should fallback to config if no tracker', async () => {
      const config: QuietModeConfig = {
        enabled: true,
        minConfidence: 0.6,
        useLearning: true,
      };
      const filter = new QuietModeFilter(config); // No tracker
      const findings = [createFinding('security', 0.5), createFinding('security', 0.7)];

      const filtered = await filter.filterByConfidence(findings);

      expect(filtered).toHaveLength(1);
      expect(filtered[0].confidence).toBe(0.7);
    });
  });

  describe('getFilterStats', () => {
    it('should return stats when disabled', async () => {
      const config: QuietModeConfig = {
        enabled: false,
        minConfidence: 0.5,
        useLearning: false,
      };
      const filter = new QuietModeFilter(config);
      const findings = [createFinding('security', 0.3), createFinding('style', 0.8)];

      const stats = await filter.getFilterStats(findings);

      expect(stats.total).toBe(2);
      expect(stats.filtered).toBe(0);
      expect(stats.kept).toBe(2);
      expect(stats.filterRate).toBe(0);
    });

    it('should calculate correct filter rate', async () => {
      const config: QuietModeConfig = {
        enabled: true,
        minConfidence: 0.5,
        useLearning: false,
      };
      const filter = new QuietModeFilter(config);
      const findings = [
        createFinding('security', 0.3),
        createFinding('security', 0.4),
        createFinding('style', 0.6),
        createFinding('style', 0.8),
      ];

      const stats = await filter.getFilterStats(findings);

      expect(stats.total).toBe(4);
      expect(stats.filtered).toBe(2);
      expect(stats.kept).toBe(2);
      expect(stats.filterRate).toBe(50);
    });

    it('should provide per-category stats', async () => {
      const config: QuietModeConfig = {
        enabled: true,
        minConfidence: 0.5,
        useLearning: false,
      };
      const filter = new QuietModeFilter(config);
      const findings = [
        createFinding('security', 0.3),
        createFinding('security', 0.6),
        createFinding('style', 0.2),
        createFinding('style', 0.4),
        createFinding('style', 0.8),
      ];

      const stats = await filter.getFilterStats(findings);

      expect(stats.byCategory['security']).toEqual({
        total: 2,
        filtered: 1,
        kept: 1,
      });
      expect(stats.byCategory['style']).toEqual({
        total: 3,
        filtered: 2,
        kept: 1,
      });
    });

    it('should handle empty findings', async () => {
      const config: QuietModeConfig = {
        enabled: true,
        minConfidence: 0.5,
        useLearning: false,
      };
      const filter = new QuietModeFilter(config);

      const stats = await filter.getFilterStats([]);

      expect(stats.total).toBe(0);
      expect(stats.filtered).toBe(0);
      expect(stats.kept).toBe(0);
      expect(stats.filterRate).toBe(0);
    });
  });
});
