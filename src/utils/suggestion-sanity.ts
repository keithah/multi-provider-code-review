/**
 * Suggestion sanity validation utilities for LLM-generated code suggestions.
 *
 * This module provides basic quality checks to catch obvious red flags in
 * LLM-generated suggestions before they enter the pipeline. This is Phase 2
 * "basic sanity checks" - NOT syntax validation (Phase 4).
 *
 * Validation checks:
 * - Not null/undefined/empty
 * - Not excessively long (>50 lines)
 * - Contains code syntax indicators
 */

/**
 * Result of suggestion sanity validation.
 *
 * When valid: isValid=true, suggestion contains trimmed code, no reason
 * When invalid: isValid=false, reason explains why, no suggestion
 */
export interface SuggestionSanityResult {
  /** Whether the suggestion passed sanity checks */
  isValid: boolean;
  /** Explanation of why validation failed (only present when isValid=false) */
  reason?: string;
  /** Trimmed suggestion code (only present when isValid=true) */
  suggestion?: string;
}

/**
 * Validates that a suggestion passes basic sanity checks.
 *
 * This function performs lightweight validation to catch obvious problems:
 * - Rejects null/undefined/empty input
 * - Rejects excessively long suggestions (>50 lines)
 * - Rejects plain English without code syntax
 * - Trims whitespace from valid suggestions
 *
 * This is NOT deep validation - it doesn't check syntax correctness,
 * semantic meaning, or line number alignment. Those checks happen elsewhere.
 *
 * @param suggestion - The code suggestion to validate (can be null/undefined)
 * @returns Structured validation result with isValid flag, reason (if invalid), and trimmed suggestion (if valid)
 *
 * @example
 * // Valid code
 * validateSuggestionSanity('const x = 1;')
 * // Returns: { isValid: true, suggestion: 'const x = 1;' }
 *
 * @example
 * // Plain English (no code)
 * validateSuggestionSanity('You should consider refactoring')
 * // Returns: { isValid: false, reason: 'Suggestion lacks code syntax' }
 *
 * @example
 * // Null input
 * validateSuggestionSanity(null)
 * // Returns: { isValid: false, reason: 'No suggestion provided' }
 */
export function validateSuggestionSanity(
  suggestion: string | undefined | null
): SuggestionSanityResult {
  // Check 1: Reject null/undefined
  if (suggestion === undefined || suggestion === null) {
    return {
      isValid: false,
      reason: 'No suggestion provided',
    };
  }

  // Trim whitespace for further checks
  const trimmed = suggestion.trim();

  // Check 2: Reject empty or whitespace-only
  if (trimmed === '') {
    return {
      isValid: false,
      reason: 'Empty suggestion',
    };
  }

  // Check 3: Count lines and reject if too long
  const lineCount = trimmed.split('\n').length;
  if (lineCount > 50) {
    return {
      isValid: false,
      reason: 'Suggestion too long (>50 lines)',
    };
  }

  // Check 4: Verify it contains code syntax indicators
  // Code typically has: {} () [] ; = => -> : :: < >
  const hasCodeSyntax = /[{}()\[\];=<>:]/.test(trimmed);
  if (!hasCodeSyntax) {
    return {
      isValid: false,
      reason: 'Suggestion lacks code syntax',
    };
  }

  // All checks passed - return valid result with trimmed suggestion
  return {
    isValid: true,
    suggestion: trimmed,
  };
}
