import type { Finding, Severity } from '../types';

/**
 * Signals used to calculate confidence score for a suggestion.
 */
export interface ConfidenceSignals {
  /** LLM-reported confidence (0-1), if available */
  llmConfidence?: number;
  /** Whether the suggested code passes syntax validation */
  syntaxValid: boolean;
  /** Whether 2+ providers agree on this suggestion */
  hasConsensus: boolean;
  /** Historical accuracy of the provider (0-1) */
  providerReliability: number;
}

/**
 * Quality configuration for confidence thresholds and consensus requirements.
 */
export interface QualityConfig {
  /** Global minimum confidence threshold (default: 0.7) */
  min_confidence?: number;
  /** Per-severity confidence thresholds (overrides min_confidence) */
  confidence_threshold?: {
    critical?: number;
    major?: number;
    minor?: number;
  };
  /** Consensus configuration */
  consensus?: {
    /** Whether critical severity requires consensus */
    required_for_critical: boolean;
    /** Minimum number of providers for consensus (default: 2) */
    min_agreement: number;
  };
}

/**
 * Calculates confidence score for a suggestion using hybrid approach.
 *
 * Combines LLM-reported confidence (when available) with validation signals:
 * - Syntax validity boosts confidence
 * - Consensus boosts confidence
 * - Invalid syntax applies penalty
 * - Provider reliability weights the final score
 *
 * When LLM confidence is unavailable, uses fallback scoring based on validation signals.
 *
 * @param signals - Confidence signals from validation and provider
 * @returns Confidence score between 0 and 1
 */
export function calculateConfidence(signals: ConfidenceSignals): number {
  let confidence: number;

  if (signals.llmConfidence !== undefined) {
    // Start with LLM-reported confidence
    confidence = signals.llmConfidence;

    // Apply syntax boost or penalty
    if (signals.syntaxValid) {
      confidence *= 1.1; // 10% boost for valid syntax
    } else {
      confidence *= 0.9; // 10% penalty for invalid syntax
    }

    // Apply consensus boost
    if (signals.hasConsensus) {
      confidence *= 1.2; // 20% boost for consensus
    }

    // Weight by provider reliability
    confidence *= signals.providerReliability;
  } else {
    // Fallback scoring without LLM confidence
    confidence = 0.5; // Base confidence

    // Add syntax boost
    if (signals.syntaxValid) {
      confidence += 0.2;
    }

    // Add consensus boost
    if (signals.hasConsensus) {
      confidence += 0.2;
    }

    // Weight by provider reliability
    confidence *= signals.providerReliability;
  }

  // Cap at 1.0
  return Math.min(1.0, confidence);
}

/**
 * Determines whether a suggestion should be posted based on confidence and configuration.
 *
 * Checks:
 * 1. Confidence meets severity-specific threshold (or global min_confidence)
 * 2. Consensus requirement satisfied (for critical severity when configured)
 *
 * @param finding - The finding with severity and provider information
 * @param confidence - Calculated confidence score (0-1)
 * @param config - Quality configuration with thresholds and consensus rules
 * @returns True if suggestion should be posted, false otherwise
 */
export function shouldPostSuggestion(
  finding: Finding,
  confidence: number,
  config: QualityConfig
): boolean {
  // Get threshold for this severity
  const severityThreshold = config.confidence_threshold?.[finding.severity];
  const threshold = severityThreshold ?? config.min_confidence ?? 0.7;

  // Check confidence threshold
  if (confidence < threshold) {
    return false;
  }

  // Check consensus requirement for critical severity
  if (finding.severity === 'critical' && config.consensus?.required_for_critical) {
    const providerCount = finding.providers?.length ?? 0;
    const minAgreement = config.consensus.min_agreement ?? 2;

    if (providerCount < minAgreement) {
      return false;
    }
  }

  return true;
}
