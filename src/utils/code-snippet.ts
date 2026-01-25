/**
 * Utility functions for extracting and formatting code snippets
 */

export interface CodeSnippet {
  startLine: number;
  endLine: number;
  lines: string[];
  highlightLine: number; // Line number to highlight (the finding line)
}

/**
 * Extract a code snippet around a specific line
 * @param content - Full file content
 * @param targetLine - Line number to highlight (1-indexed)
 * @param contextLines - Number of lines to show before/after (default: 3)
 * @returns Code snippet with context
 */
export function extractCodeSnippet(
  content: string,
  targetLine: number,
  contextLines: number = 3
): CodeSnippet | null {
  if (!content || targetLine <= 0) {
    return null;
  }

  const lines = content.split('\n');

  // Validate line number
  if (targetLine > lines.length) {
    return null;
  }

  // Calculate start and end lines (0-indexed for array, 1-indexed for display)
  const startIdx = Math.max(0, targetLine - 1 - contextLines);
  const endIdx = Math.min(lines.length, targetLine + contextLines);

  const snippetLines = lines.slice(startIdx, endIdx);

  return {
    startLine: startIdx + 1, // Convert to 1-indexed
    endLine: endIdx,
    lines: snippetLines,
    highlightLine: targetLine,
  };
}

/**
 * Format a code snippet for display in a GitHub comment
 * @param snippet - Code snippet to format
 * @param language - Programming language for syntax highlighting
 * @param showLineNumbers - Whether to show line numbers (default: true)
 * @returns Formatted markdown string
 */
export function formatSnippet(
  snippet: CodeSnippet,
  language: string = '',
  showLineNumbers: boolean = true
): string {
  if (!snippet || snippet.lines.length === 0) {
    return '';
  }

  const { startLine, lines, highlightLine } = snippet;

  // Format with line numbers and highlight marker
  const formattedLines = lines.map((line, idx) => {
    const lineNum = startLine + idx;
    const isHighlight = lineNum === highlightLine;
    const marker = isHighlight ? '→' : ' ';

    if (showLineNumbers) {
      // Right-align line numbers for better readability
      const paddedNum = String(lineNum).padStart(4, ' ');
      return `${paddedNum}${marker} ${line}`;
    } else {
      return `${marker} ${line}`;
    }
  });

  return `\`\`\`${language}\n${formattedLines.join('\n')}\n\`\`\``;
}

/**
 * Detect language from file extension
 * @param filePath - File path
 * @returns Language identifier for syntax highlighting
 */
export function detectLanguage(filePath: string): string {
  const ext = filePath.split('.').pop()?.toLowerCase() || '';

  const languageMap: Record<string, string> = {
    'ts': 'typescript',
    'tsx': 'tsx',
    'js': 'javascript',
    'jsx': 'jsx',
    'py': 'python',
    'java': 'java',
    'go': 'go',
    'rs': 'rust',
    'c': 'c',
    'cpp': 'cpp',
    'h': 'c',
    'hpp': 'cpp',
    'cs': 'csharp',
    'rb': 'ruby',
    'php': 'php',
    'swift': 'swift',
    'kt': 'kotlin',
    'scala': 'scala',
    'sh': 'bash',
    'bash': 'bash',
    'zsh': 'bash',
    'yml': 'yaml',
    'yaml': 'yaml',
    'json': 'json',
    'xml': 'xml',
    'html': 'html',
    'css': 'css',
    'scss': 'scss',
    'sql': 'sql',
    'md': 'markdown',
  };

  return languageMap[ext] || '';
}

/**
 * Create an enhanced inline comment body with code snippet
 * @param originalBody - Original comment body
 * @param snippet - Code snippet to include
 * @param filePath - File path for language detection
 * @returns Enhanced comment body
 */
export function createEnhancedCommentBody(
  originalBody: string,
  snippet: CodeSnippet | null,
  filePath: string
): string {
  if (!snippet) {
    return originalBody;
  }

  const language = detectLanguage(filePath);
  const formattedSnippet = formatSnippet(snippet, language);

  // Structure: Original message + code snippet + footer
  return `${originalBody}\n\n**Code Context:**\n${formattedSnippet}`;
}
