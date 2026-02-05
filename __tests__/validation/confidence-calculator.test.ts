import { calculateConfidence, shouldPostSuggestion } from '../../src/validation/confidence-calculator';
import type { ConfidenceSignals, QualityConfig } from '../../src/validation/confidence-calculator';
import type { Finding } from '../../src/types';

describe('calculateConfidence', () => {
  describe('LLM confidence with validation signals', () => {
    it('should use LLM confidence with syntax boost', () => {
      const signals: ConfidenceSignals = {
        llmConfidence: 0.8,
        syntaxValid: true,
        hasConsensus: false,
        providerReliability: 1.0
      };

      const result = calculateConfidence(signals);

      // 0.8 * 1.1 (syntax boost) = 0.88
      expect(result).toBeCloseTo(0.88, 2);
    });

    it('should use LLM confidence with consensus boost', () => {
      const signals: ConfidenceSignals = {
        llmConfidence: 0.8,
        syntaxValid: true,
        hasConsensus: true,
        providerReliability: 1.0
      };

      const result = calculateConfidence(signals);

      // 0.8 * 1.1 (syntax) * 1.2 (consensus) = 1.056 → capped at 1.0
      expect(result).toBe(1.0);
    });

    it('should apply syntax penalty when invalid', () => {
      const signals: ConfidenceSignals = {
        llmConfidence: 0.9,
        syntaxValid: false,
        hasConsensus: false,
        providerReliability: 1.0
      };

      const result = calculateConfidence(signals);

      // 0.9 * 0.9 (penalty) = 0.81
      expect(result).toBeCloseTo(0.81, 2);
    });

    it('should multiply by provider reliability', () => {
      const signals: ConfidenceSignals = {
        llmConfidence: 0.8,
        syntaxValid: true,
        hasConsensus: false,
        providerReliability: 0.9
      };

      const result = calculateConfidence(signals);

      // 0.8 * 1.1 * 0.9 = 0.792
      expect(result).toBeCloseTo(0.792, 2);
    });
  });

  describe('Fallback scoring without LLM confidence', () => {
    it('should use fallback base with syntax boost', () => {
      const signals: ConfidenceSignals = {
        syntaxValid: true,
        hasConsensus: false,
        providerReliability: 1.0
      };

      const result = calculateConfidence(signals);

      // 0.5 (base) + 0.2 (syntax) = 0.7
      expect(result).toBeCloseTo(0.7, 2);
    });

    it('should use fallback with consensus boost', () => {
      const signals: ConfidenceSignals = {
        syntaxValid: true,
        hasConsensus: true,
        providerReliability: 1.0
      };

      const result = calculateConfidence(signals);

      // 0.5 + 0.2 (syntax) + 0.2 (consensus) = 0.9
      expect(result).toBeCloseTo(0.9, 2);
    });

    it('should multiply fallback by provider reliability', () => {
      const signals: ConfidenceSignals = {
        syntaxValid: true,
        hasConsensus: false,
        providerReliability: 0.9
      };

      const result = calculateConfidence(signals);

      // (0.5 + 0.2) * 0.9 = 0.63
      expect(result).toBeCloseTo(0.63, 2);
    });

    it('should handle minimum confidence case', () => {
      const signals: ConfidenceSignals = {
        syntaxValid: false,
        hasConsensus: false,
        providerReliability: 1.0
      };

      const result = calculateConfidence(signals);

      // 0.5 (base only)
      expect(result).toBeCloseTo(0.5, 2);
    });
  });

  describe('Edge cases', () => {
    it('should cap confidence at 1.0', () => {
      const signals: ConfidenceSignals = {
        llmConfidence: 0.95,
        syntaxValid: true,
        hasConsensus: true,
        providerReliability: 1.0
      };

      const result = calculateConfidence(signals);

      expect(result).toBeLessThanOrEqual(1.0);
      expect(result).toBe(1.0);
    });

    it('should handle zero provider reliability', () => {
      const signals: ConfidenceSignals = {
        llmConfidence: 0.8,
        syntaxValid: true,
        hasConsensus: false,
        providerReliability: 0.0
      };

      const result = calculateConfidence(signals);

      expect(result).toBe(0.0);
    });

    it('should never return negative confidence', () => {
      const signals: ConfidenceSignals = {
        syntaxValid: false,
        hasConsensus: false,
        providerReliability: 0.0
      };

      const result = calculateConfidence(signals);

      expect(result).toBeGreaterThanOrEqual(0.0);
    });
  });
});

describe('shouldPostSuggestion', () => {
  describe('Basic threshold checks', () => {
    it('should return true when confidence exceeds default threshold', () => {
      const finding: Finding = {
        file: 'test.ts',
        line: 1,
        severity: 'major',
        title: 'Test',
        message: 'Test finding'
      };
      const config: QualityConfig = {
        min_confidence: 0.7
      };

      const result = shouldPostSuggestion(finding, 0.8, config);

      expect(result).toBe(true);
    });

    it('should return false when confidence below threshold', () => {
      const finding: Finding = {
        file: 'test.ts',
        line: 1,
        severity: 'major',
        title: 'Test',
        message: 'Test finding'
      };
      const config: QualityConfig = {
        min_confidence: 0.7
      };

      const result = shouldPostSuggestion(finding, 0.5, config);

      expect(result).toBe(false);
    });

    it('should use default threshold of 0.7 when not configured', () => {
      const finding: Finding = {
        file: 'test.ts',
        line: 1,
        severity: 'major',
        title: 'Test',
        message: 'Test finding'
      };
      const config: QualityConfig = {};

      const result = shouldPostSuggestion(finding, 0.75, config);

      expect(result).toBe(true);
    });
  });

  describe('Per-severity thresholds', () => {
    it('should use critical-specific threshold', () => {
      const finding: Finding = {
        file: 'test.ts',
        line: 1,
        severity: 'critical',
        title: 'Test',
        message: 'Test finding'
      };
      const config: QualityConfig = {
        min_confidence: 0.7,
        confidence_threshold: {
          critical: 0.8
        }
      };

      const result = shouldPostSuggestion(finding, 0.75, config);

      expect(result).toBe(false);
    });

    it('should fall back to min_confidence for major severity', () => {
      const finding: Finding = {
        file: 'test.ts',
        line: 1,
        severity: 'major',
        title: 'Test',
        message: 'Test finding'
      };
      const config: QualityConfig = {
        min_confidence: 0.7,
        confidence_threshold: {
          critical: 0.8
        }
      };

      const result = shouldPostSuggestion(finding, 0.75, config);

      expect(result).toBe(true);
    });

    it('should handle minor severity with custom threshold', () => {
      const finding: Finding = {
        file: 'test.ts',
        line: 1,
        severity: 'minor',
        title: 'Test',
        message: 'Test finding'
      };
      const config: QualityConfig = {
        min_confidence: 0.7,
        confidence_threshold: {
          minor: 0.6
        }
      };

      const result = shouldPostSuggestion(finding, 0.65, config);

      expect(result).toBe(true);
    });
  });

  describe('Consensus requirements', () => {
    it('should reject critical findings without consensus when required', () => {
      const finding: Finding = {
        file: 'test.ts',
        line: 1,
        severity: 'critical',
        title: 'Test',
        message: 'Test finding',
        providers: ['provider-a']
      };
      const config: QualityConfig = {
        min_confidence: 0.7,
        consensus: {
          required_for_critical: true,
          min_agreement: 2
        }
      };

      const result = shouldPostSuggestion(finding, 0.9, config);

      expect(result).toBe(false);
    });

    it('should accept critical findings with consensus', () => {
      const finding: Finding = {
        file: 'test.ts',
        line: 1,
        severity: 'critical',
        title: 'Test',
        message: 'Test finding',
        providers: ['provider-a', 'provider-b']
      };
      const config: QualityConfig = {
        min_confidence: 0.7,
        consensus: {
          required_for_critical: true,
          min_agreement: 2
        }
      };

      const result = shouldPostSuggestion(finding, 0.9, config);

      expect(result).toBe(true);
    });

    it('should accept major findings without consensus requirement', () => {
      const finding: Finding = {
        file: 'test.ts',
        line: 1,
        severity: 'major',
        title: 'Test',
        message: 'Test finding',
        providers: ['provider-a']
      };
      const config: QualityConfig = {
        min_confidence: 0.7,
        consensus: {
          required_for_critical: true,
          min_agreement: 2
        }
      };

      const result = shouldPostSuggestion(finding, 0.8, config);

      expect(result).toBe(true);
    });

    it('should not require consensus when config is disabled', () => {
      const finding: Finding = {
        file: 'test.ts',
        line: 1,
        severity: 'critical',
        title: 'Test',
        message: 'Test finding',
        providers: ['provider-a']
      };
      const config: QualityConfig = {
        min_confidence: 0.7,
        consensus: {
          required_for_critical: false,
          min_agreement: 2
        }
      };

      const result = shouldPostSuggestion(finding, 0.9, config);

      expect(result).toBe(true);
    });
  });

  describe('Edge cases', () => {
    it('should handle exactly at threshold', () => {
      const finding: Finding = {
        file: 'test.ts',
        line: 1,
        severity: 'major',
        title: 'Test',
        message: 'Test finding'
      };
      const config: QualityConfig = {
        min_confidence: 0.7
      };

      const result = shouldPostSuggestion(finding, 0.7, config);

      expect(result).toBe(true);
    });

    it('should handle finding without providers array', () => {
      const finding: Finding = {
        file: 'test.ts',
        line: 1,
        severity: 'critical',
        title: 'Test',
        message: 'Test finding'
        // No providers field
      };
      const config: QualityConfig = {
        consensus: {
          required_for_critical: true,
          min_agreement: 2
        }
      };

      const result = shouldPostSuggestion(finding, 0.9, config);

      expect(result).toBe(false);
    });
  });
});
