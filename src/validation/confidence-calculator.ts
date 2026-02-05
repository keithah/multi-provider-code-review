import type { Finding, Severity } from '../types';

/**
 * Confidence calculation constants.
 *
 * These values control how validation signals boost or penalize LLM confidence scores.
 */
const CONFIDENCE_MULTIPLIERS = {
  /** Boost factor when syntax is valid (10% increase) */
  SYNTAX_BOOST: 1.1,
  /** Penalty factor when syntax is invalid (10% decrease) */
  SYNTAX_PENALTY: 0.9,
  /** Boost factor when consensus achieved (20% increase) */
  CONSENSUS_BOOST: 1.2
} as const;

/**
 * Fallback scoring constants when LLM confidence is unavailable.
 */
const FALLBACK_SCORING = {
  /** Base confidence without any signals */
  BASE: 0.5,
  /** Bonus added for valid syntax */
  SYNTAX_BONUS: 0.2,
  /** Bonus added for consensus */
  CONSENSUS_BONUS: 0.2
} as const;

/**
 * Default quality configuration values.
 */
export const DEFAULT_QUALITY_CONFIG = {
  /** Default minimum confidence threshold (70%) */
  MIN_CONFIDENCE: 0.7,
  /** Default minimum providers for consensus */
  MIN_AGREEMENT: 2
} as const;

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
 * This function implements a two-path confidence calculation strategy:
 *
 * **Path 1: LLM Confidence Available**
 * - Starts with provider-reported confidence (0-1)
 * - Multiplies by syntax boost (1.1x) or penalty (0.9x)
 * - Multiplies by consensus boost (1.2x) if multiple providers agree
 * - Weights final score by provider's historical reliability
 * - Example: 0.8 LLM confidence × 1.1 syntax × 1.2 consensus × 0.9 reliability = 0.95
 *
 * **Path 2: Fallback Scoring (no LLM confidence)**
 * - Starts with base confidence (0.5)
 * - Adds syntax bonus (+0.2) if valid
 * - Adds consensus bonus (+0.2) if achieved
 * - Weights final score by provider reliability
 * - Example: (0.5 base + 0.2 syntax) × 0.9 reliability = 0.63
 *
 * All scores are capped at 1.0 to prevent over-confidence.
 *
 * @param signals - Confidence signals from validation and provider
 * @returns Confidence score between 0 and 1
 *
 * @example
 * ```typescript
 * // High confidence: LLM + valid syntax + consensus
 * calculateConfidence({
 *   llmConfidence: 0.8,
 *   syntaxValid: true,
 *   hasConsensus: true,
 *   providerReliability: 1.0
 * }); // Returns 1.0 (0.8 × 1.1 × 1.2 = 1.056, capped)
 *
 * // Fallback: no LLM, valid syntax only
 * calculateConfidence({
 *   syntaxValid: true,
 *   hasConsensus: false,
 *   providerReliability: 0.9
 * }); // Returns 0.63 ((0.5 + 0.2) × 0.9)
 * ```
 */
export function calculateConfidence(signals: ConfidenceSignals): number {
  let confidence: number;

  if (signals.llmConfidence !== undefined) {
    // Start with LLM-reported confidence
    confidence = signals.llmConfidence;

    // Apply syntax boost or penalty
    if (signals.syntaxValid) {
      confidence *= CONFIDENCE_MULTIPLIERS.SYNTAX_BOOST;
    } else {
      confidence *= CONFIDENCE_MULTIPLIERS.SYNTAX_PENALTY;
    }

    // Apply consensus boost
    if (signals.hasConsensus) {
      confidence *= CONFIDENCE_MULTIPLIERS.CONSENSUS_BOOST;
    }

    // Weight by provider reliability
    confidence *= signals.providerReliability;
  } else {
    // Fallback scoring without LLM confidence
    confidence = FALLBACK_SCORING.BASE;

    // Add syntax boost
    if (signals.syntaxValid) {
      confidence += FALLBACK_SCORING.SYNTAX_BONUS;
    }

    // Add consensus boost
    if (signals.hasConsensus) {
      confidence += FALLBACK_SCORING.CONSENSUS_BONUS;
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
 * This function implements a two-gate quality check:
 *
 * **Gate 1: Confidence Threshold**
 * - Uses severity-specific threshold if configured (e.g., critical: 0.8, minor: 0.6)
 * - Falls back to global min_confidence (default: 0.7)
 * - Suggestion rejected if confidence below threshold
 *
 * **Gate 2: Consensus Requirement (Critical Only)**
 * - If finding.severity === 'critical' AND consensus.required_for_critical === true
 * - Checks that providers.length >= min_agreement (default: 2)
 * - Ensures multiple providers agree before posting critical suggestions
 *
 * Both gates must pass for suggestion to be posted.
 *
 * @param finding - The finding with severity and provider information
 * @param confidence - Calculated confidence score (0-1)
 * @param config - Quality configuration with thresholds and consensus rules
 * @returns True if suggestion should be posted, false otherwise
 *
 * @example
 * ```typescript
 * // Pass: confidence above threshold
 * shouldPostSuggestion(
 *   { severity: 'major', ... },
 *   0.8,
 *   { min_confidence: 0.7 }
 * ); // Returns true
 *
 * // Fail: critical without consensus
 * shouldPostSuggestion(
 *   { severity: 'critical', providers: ['provider-a'], ... },
 *   0.9,
 *   { consensus: { required_for_critical: true, min_agreement: 2 } }
 * ); // Returns false (only 1 provider)
 *
 * // Pass: critical with consensus
 * shouldPostSuggestion(
 *   { severity: 'critical', providers: ['a', 'b'], ... },
 *   0.9,
 *   { consensus: { required_for_critical: true, min_agreement: 2 } }
 * ); // Returns true (2 providers)
 * ```
 */
export function shouldPostSuggestion(
  finding: Finding,
  confidence: number,
  config: QualityConfig
): boolean {
  // Get threshold for this severity
  const severityThreshold = config.confidence_threshold?.[finding.severity];
  const threshold = severityThreshold ?? config.min_confidence ?? DEFAULT_QUALITY_CONFIG.MIN_CONFIDENCE;

  // Check confidence threshold
  if (confidence < threshold) {
    return false;
  }

  // Check consensus requirement for critical severity
  if (finding.severity === 'critical' && config.consensus?.required_for_critical) {
    const providerCount = finding.providers?.length ?? 0;
    const minAgreement = config.consensus.min_agreement ?? DEFAULT_QUALITY_CONFIG.MIN_AGREEMENT;

    if (providerCount < minAgreement) {
      return false;
    }
  }

  return true;
}
