/**
 * Configuration validation helpers for intensity behavior fields.
 *
 * Per CONTEXT.md decisions:
 * - Consensus percentages: clamp to 0-100 with warning (continue running)
 * - Severity enums: strict validation with typo suggestions (fail fast)
 */

import { Severity } from '../types';
import { ValidationError } from '../utils/validation';
import { logger } from '../utils/logger';

const SEVERITY_VALUES = ['critical', 'major', 'minor'] as const;

/**
 * Calculate Levenshtein edit distance between two strings.
 * Used for typo detection in enum validation.
 */
export function levenshteinDistance(a: string, b: string): number {
  const matrix: number[][] = [];

  // Initialize first column
  for (let i = 0; i <= a.length; i++) {
    matrix[i] = [i];
  }

  // Initialize first row
  for (let j = 0; j <= b.length; j++) {
    matrix[0][j] = j;
  }

  // Fill matrix
  for (let i = 1; i <= a.length; i++) {
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      matrix[i][j] = Math.min(
        matrix[i - 1][j] + 1,      // deletion
        matrix[i][j - 1] + 1,      // insertion
        matrix[i - 1][j - 1] + cost // substitution
      );
    }
  }

  return matrix[a.length][b.length];
}

/**
 * Find closest matching string from candidates.
 * Only returns match if distance <= 2 to avoid bad suggestions.
 */
function findClosestMatch(input: string, candidates: readonly string[]): string | null {
  const normalized = input.toLowerCase();
  let closest: string | null = null;
  let minDistance = Infinity;

  for (const candidate of candidates) {
    const distance = levenshteinDistance(normalized, candidate);
    if (distance < minDistance && distance <= 2) {
      minDistance = distance;
      closest = candidate;
    }
  }

  return closest;
}

/**
 * Clamp percentage to valid 0-100 range, logging warning if adjusted.
 * Per CONTEXT.md: clamp with warning, don't fail.
 */
export function clampPercentage(value: number, fieldName: string): number {
  // Handle NaN separately from Infinity
  if (Number.isNaN(value)) {
    logger.warn(`${fieldName}: invalid value ${value}, using 50`);
    return 50;
  }

  // Handle Infinity as extremely large/small values
  if (value === Infinity) {
    logger.warn(`${fieldName}: ${value} clamped to 100 (valid range: 0-100)`);
    return 100;
  }

  if (value === -Infinity) {
    logger.warn(`${fieldName}: ${value} clamped to 0 (valid range: 0-100)`);
    return 0;
  }

  if (value < 0) {
    logger.warn(`${fieldName}: ${value} clamped to 0 (valid range: 0-100)`);
    return 0;
  }

  if (value > 100) {
    logger.warn(`${fieldName}: ${value} clamped to 100 (valid range: 0-100)`);
    return 100;
  }

  return value;
}

/**
 * Validate severity enum with typo suggestions.
 * Per CONTEXT.md: strict validation, fail with helpful message.
 */
export function validateSeverityWithSuggestion(
  value: unknown,
  field: string
): Severity {
  if (typeof value !== 'string') {
    throw new ValidationError(
      `${field} must be a string`,
      field,
      `Received type: ${typeof value}`
    );
  }

  const normalized = value.toLowerCase();

  if (SEVERITY_VALUES.includes(normalized as Severity)) {
    return normalized as Severity;
  }

  // Find closest match for typo suggestion
  const suggestion = findClosestMatch(normalized, SEVERITY_VALUES);

  throw new ValidationError(
    `${field} has invalid value: "${value}"`,
    field,
    suggestion
      ? `Did you mean '${suggestion}'?`
      : `Valid values: ${SEVERITY_VALUES.join(', ')}`
  );
}
