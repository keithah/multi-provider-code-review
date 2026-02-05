/**
 * Suggestion formatting utilities for GitHub commit suggestions.
 *
 * This module provides functions to format code suggestions as GitHub-compatible
 * markdown suggestion blocks, handling backtick escaping to prevent markdown conflicts.
 */

/**
 * Counts the maximum number of consecutive backticks in a string.
 *
 * This is used to determine the appropriate fence delimiter for markdown code blocks.
 * GitHub suggestion blocks use backtick fences, so we need to use more backticks
 * than appear in the content to avoid conflicts.
 *
 * @param str - The string to analyze
 * @returns The maximum consecutive backtick count (0 if none found)
 *
 * @example
 * countMaxConsecutiveBackticks('hello') // 0
 * countMaxConsecutiveBackticks('`x`') // 1
 * countMaxConsecutiveBackticks('```code```') // 3
 */
export function countMaxConsecutiveBackticks(str: string): number {
  const backtickSequences = str.match(/`+/g);

  if (!backtickSequences) {
    return 0;
  }

  return Math.max(...backtickSequences.map((seq) => seq.length));
}

/**
 * Formats code content as a GitHub suggestion block.
 *
 * Creates a markdown fenced code block with 'suggestion' language tag.
 * Automatically escapes backticks in the content by using a fence delimiter
 * with more backticks than appear in the content.
 *
 * @param content - The code suggestion to format
 * @returns GitHub suggestion markdown block, or empty string for empty/whitespace input
 *
 * @example
 * formatSuggestionBlock('const x = 1;')
 * // Returns: ```suggestion\nconst x = 1;\n```
 *
 * @example
 * formatSuggestionBlock('```typescript\ncode\n```')
 * // Returns: ````suggestion\n```typescript\ncode\n```\n````
 *
 * @example
 * formatSuggestionBlock('') // Returns: ''
 */
export function formatSuggestionBlock(content: string): string {
  // Return empty string for empty or whitespace-only input
  if (!content || content.trim() === '') {
    return '';
  }

  // Count maximum consecutive backticks to determine fence delimiter
  const maxBackticks = countMaxConsecutiveBackticks(content);

  // Use at least 3 backticks (standard markdown fence)
  // If content has backticks, use one more than the maximum
  const fenceCount = Math.max(3, maxBackticks + 1);
  const fence = '`'.repeat(fenceCount);

  // Format as GitHub suggestion block
  return `${fence}suggestion\n${content}\n${fence}`;
}
