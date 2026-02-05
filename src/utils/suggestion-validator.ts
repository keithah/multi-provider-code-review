/**
 * Suggestion line validation utilities for GitHub commit suggestions.
 *
 * This module validates that suggestion target lines exist in the diff
 * (RIGHT side only) before formatting suggestions. This prevents GitHub API
 * errors and ensures suggestions appear at correct positions.
 */

import { mapLinesToPositions } from './diff';

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
