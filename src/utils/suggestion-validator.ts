/**
 * Suggestion line validation utilities for GitHub commit suggestions.
 *
 * This module validates that suggestion target lines exist in the diff
 * (RIGHT side only) before formatting suggestions. This prevents GitHub API
 * errors and ensures suggestions appear at correct positions.
 */

import { mapLinesToPositions } from './diff';

/**
 * Result of validating a suggestion range.
 */
export interface RangeValidationResult {
  isValid: boolean;
  reason?: string;
  startPosition?: number;
  endPosition?: number;
}

/**
 * Validates that a suggestion line exists in the diff and returns its position.
 *
 * This function checks if the specified line number exists in the RIGHT side
 * of the diff (the new file version). It uses the existing mapLinesToPositions
 * utility which maps absolute line numbers to diff positions.
 *
 * @param lineNumber - The absolute line number in the new file
 * @param patch - The unified diff patch string
 * @returns The diff position (1-indexed) if line exists, null otherwise
 *
 * @example
 * const patch = `@@ -1,3 +1,4 @@
 *  context line
 * +added line
 *  more context`;
 *
 * validateSuggestionLine(1, patch) // 2 (context line at position 2)
 * validateSuggestionLine(2, patch) // 3 (added line at position 3)
 * validateSuggestionLine(100, patch) // null (line not in diff)
 * validateSuggestionLine(1, undefined) // null (no patch)
 */
export function validateSuggestionLine(
  lineNumber: number,
  patch: string | undefined
): number | null {
  const lineMap = mapLinesToPositions(patch);
  return lineMap.get(lineNumber) ?? null;
}

/**
 * Convenience wrapper to check if a suggestion line is valid (exists in diff).
 *
 * @param lineNumber - The absolute line number in the new file
 * @param patch - The unified diff patch string
 * @returns true if line exists in diff, false otherwise
 *
 * @example
 * isSuggestionLineValid(1, patch) // true
 * isSuggestionLineValid(100, patch) // false
 */
export function isSuggestionLineValid(
  lineNumber: number,
  patch: string | undefined
): boolean {
  return validateSuggestionLine(lineNumber, patch) !== null;
}

/**
 * Validates that a suggestion range is valid for multi-line GitHub suggestions.
 *
 * This function validates that:
 * 1. The range is well-formed (start <= end)
 * 2. The range doesn't exceed sanity limits (max 50 lines)
 * 3. All lines in the range exist in the diff (RIGHT side)
 * 4. The lines form a consecutive sequence (no gaps)
 *
 * @param startLine - The starting absolute line number in the new file
 * @param endLine - The ending absolute line number in the new file (inclusive)
 * @param patch - The unified diff patch string
 * @returns Validation result with positions if valid, or error reason if invalid
 *
 * @example
 * const patch = `@@ -1,3 +1,4 @@
 *  context line
 * +added line
 *  more context`;
 *
 * validateSuggestionRange(1, 2, patch) // { isValid: true, startPosition: 2, endPosition: 3 }
 * validateSuggestionRange(5, 3, patch) // { isValid: false, reason: 'Invalid range: start > end' }
 * validateSuggestionRange(1, 100, patch) // { isValid: false, reason: 'Line ... not found in diff' }
 */
export function validateSuggestionRange(
  startLine: number,
  endLine: number,
  patch: string | undefined
): RangeValidationResult {
  // Check for patch availability
  if (!patch || patch.trim().length === 0) {
    return { isValid: false, reason: 'No patch available' };
  }

  // Check range direction
  if (startLine > endLine) {
    return { isValid: false, reason: 'Invalid range: start > end' };
  }

  // Check range length (inclusive: endLine - startLine + 1)
  const rangeLength = endLine - startLine + 1;
  if (rangeLength > 50) {
    return { isValid: false, reason: `Range too long: ${rangeLength} lines (max 50)` };
  }

  // Get line-to-position mapping
  const lineMap = mapLinesToPositions(patch);

  // Check that all lines in range exist in diff (consecutive check)
  for (let line = startLine; line <= endLine; line++) {
    if (!lineMap.has(line)) {
      return { isValid: false, reason: `Line ${line} not found in diff` };
    }
  }

  // Check for gaps (non-consecutive positions)
  const positions: number[] = [];
  for (let line = startLine; line <= endLine; line++) {
    const pos = lineMap.get(line);
    if (pos !== undefined) {
      positions.push(pos);
    }
  }

  // Verify positions are consecutive
  for (let i = 1; i < positions.length; i++) {
    if (positions[i] !== positions[i - 1] + 1) {
      return { isValid: false, reason: 'Range contains gaps (non-consecutive lines)' };
    }
  }

  // All checks passed - return valid with positions
  const startPosition = lineMap.get(startLine);
  const endPosition = lineMap.get(endLine);

  return {
    isValid: true,
    startPosition,
    endPosition
  };
}
