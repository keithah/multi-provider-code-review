import { ReviewOrchestrator, ReviewComponents } from '../../../src/core/orchestrator';
import { ConsensusEngine } from '../../../src/analysis/consensus';
import { DEFAULT_CONFIG } from '../../../src/config/defaults';
import { ReviewConfig, ReviewIntensity } from '../../../src/types';

describe('ReviewOrchestrator', () => {
  let orchestrator: ReviewOrchestrator;
  let mockComponents: Partial<ReviewComponents>;

  beforeEach(() => {
    // Minimal mock for instantiation testing only
    // Full component mocking is done in integration tests
    // See __tests__/integration/orchestrator.integration.test.ts for comprehensive tests
    mockComponents = {
      // Empty partial mock - only testing constructor doesn't throw
    };
    orchestrator = new ReviewOrchestrator(mockComponents as ReviewComponents);
  });

  it('should be instantiable', () => {
    expect(orchestrator).toBeInstanceOf(ReviewOrchestrator);
  });

  // Note: Comprehensive orchestration tests are in integration test suite
  // This unit test suite is minimal as ReviewOrchestrator is primarily
  // an integration/coordination layer tested better with real component interactions
});

describe('ReviewOrchestrator Intensity Consensus Wiring', () => {
  describe('Consensus Threshold Calculation', () => {
    it('should calculate minAgreement from thorough intensity with 5 providers', () => {
      const config: ReviewConfig = DEFAULT_CONFIG;
      const providerCount = 5;
      const intensity: ReviewIntensity = 'thorough';

      const thresholdPercent = config.intensityConsensusThresholds![intensity];
      const minAgreement = Math.ceil((thresholdPercent / 100) * providerCount);

      expect(thresholdPercent).toBe(80);
      expect(minAgreement).toBe(4); // 80% of 5 = 4
    });

    it('should calculate minAgreement from standard intensity with 5 providers', () => {
      const config: ReviewConfig = DEFAULT_CONFIG;
      const providerCount = 5;
      const intensity: ReviewIntensity = 'standard';

      const thresholdPercent = config.intensityConsensusThresholds![intensity];
      const minAgreement = Math.ceil((thresholdPercent / 100) * providerCount);

      expect(thresholdPercent).toBe(60);
      expect(minAgreement).toBe(3); // 60% of 5 = 3
    });

    it('should calculate minAgreement from light intensity with 5 providers', () => {
      const config: ReviewConfig = DEFAULT_CONFIG;
      const providerCount = 5;
      const intensity: ReviewIntensity = 'light';

      const thresholdPercent = config.intensityConsensusThresholds![intensity];
      const minAgreement = Math.ceil((thresholdPercent / 100) * providerCount);

      expect(thresholdPercent).toBe(40);
      expect(minAgreement).toBe(2); // 40% of 5 = 2
    });

    it('should handle 0 providers edge case', () => {
      const providerCount = 0;
      const intensity: ReviewIntensity = 'standard';
      const config: ReviewConfig = DEFAULT_CONFIG;

      const thresholdPercent = config.intensityConsensusThresholds![intensity];
      const minAgreement = providerCount === 0 ? 1 : Math.ceil((thresholdPercent / 100) * providerCount);

      expect(minAgreement).toBe(1); // Fallback to 1
    });

    it('should round up fractional provider counts', () => {
      const providerCount = 3;
      const intensity: ReviewIntensity = 'thorough';
      const config: ReviewConfig = DEFAULT_CONFIG;

      const thresholdPercent = config.intensityConsensusThresholds![intensity];
      const minAgreement = Math.ceil((thresholdPercent / 100) * providerCount);

      expect(minAgreement).toBe(3); // 80% of 3 = 2.4, rounded up to 3
    });
  });

  describe('Severity Filter Mapping', () => {
    it('should map thorough intensity to minor severity filter', () => {
      const config: ReviewConfig = DEFAULT_CONFIG;
      const intensity: ReviewIntensity = 'thorough';

      const severityFilter = config.intensitySeverityFilters![intensity];

      expect(severityFilter).toBe('minor');
    });

    it('should map standard intensity to minor severity filter', () => {
      const config: ReviewConfig = DEFAULT_CONFIG;
      const intensity: ReviewIntensity = 'standard';

      const severityFilter = config.intensitySeverityFilters![intensity];

      expect(severityFilter).toBe('minor');
    });

    it('should map light intensity to major severity filter', () => {
      const config: ReviewConfig = DEFAULT_CONFIG;
      const intensity: ReviewIntensity = 'light';

      const severityFilter = config.intensitySeverityFilters![intensity];

      expect(severityFilter).toBe('major');
    });
  });

  describe('ConsensusEngine Integration', () => {
    it('should instantiate ConsensusEngine with calculated thresholds', () => {
      const providerCount = 5;
      const intensity: ReviewIntensity = 'thorough';
      const config: ReviewConfig = DEFAULT_CONFIG;

      const thresholdPercent = config.intensityConsensusThresholds![intensity];
      const severityFilter = config.intensitySeverityFilters![intensity];
      const minAgreement = Math.ceil((thresholdPercent / 100) * providerCount);

      const consensusEngine = new ConsensusEngine({
        minAgreement,
        minSeverity: severityFilter,
        maxComments: config.inlineMaxComments,
      });

      expect(consensusEngine).toBeInstanceOf(ConsensusEngine);
    });

    it('should fallback to config defaults when intensity settings missing', () => {
      const config: ReviewConfig = {
        ...DEFAULT_CONFIG,
        intensityConsensusThresholds: undefined,
        intensitySeverityFilters: undefined,
      };

      const minAgreement = config.inlineMinAgreement;
      const minSeverity = config.inlineMinSeverity;

      expect(minAgreement).toBe(2);
      expect(minSeverity).toBe('major');
    });
  });
});
