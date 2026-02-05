import { getParser, Language } from '../analysis/ast/parsers';
import type Parser from 'tree-sitter';

export interface SyntaxValidationResult {
  isValid: boolean;
  skipped?: boolean;
  reason?: string;
  errors: Array<{
    type: 'ERROR' | 'MISSING';
    line: number;
    column: number;
    text?: string;
  }>;
}

/**
 * Validates suggested code fixes using tree-sitter syntax parsing.
 *
 * CRITICAL: Checks BOTH node.type === 'ERROR' AND node.isMissing
 * - ERROR nodes: unparseable text (syntax errors)
 * - MISSING nodes: parser-inserted recovery tokens (unclosed braces, missing semicolons)
 * - Only checking hasError misses MISSING nodes!
 *
 * @param code - The code to validate
 * @param language - The language to parse (typescript, javascript, python, go)
 * @returns Validation result with error details or skip status
 */
export function validateSyntax(code: string, language: Language): SyntaxValidationResult {
  // Handle unsupported languages
  if (language === 'unknown' || language === 'rust') {
    return {
      isValid: true,
      skipped: true,
      reason: 'Unsupported language',
      errors: []
    };
  }

  // Get parser for language
  const parser = getParser(language);
  if (!parser) {
    return {
      isValid: true,
      skipped: true,
      reason: 'Parser not available',
      errors: []
    };
  }

  // Parse code
  const tree = parser.parse(code);
  const errors: Array<{
    type: 'ERROR' | 'MISSING';
    line: number;
    column: number;
    text?: string;
  }> = [];

  // Walk tree to find ERROR and MISSING nodes
  const cursor = tree.walk();

  const visitNode = (node: Parser.SyntaxNode): void => {
    // Check for ERROR nodes (unparseable text)
    if (node.type === 'ERROR') {
      errors.push({
        type: 'ERROR',
        line: node.startPosition.row + 1, // 1-indexed
        column: node.startPosition.column + 1, // 1-indexed
        text: node.text || undefined
      });
    }

    // Check for MISSING nodes (parser recovery tokens)
    if (node.isMissing) {
      errors.push({
        type: 'MISSING',
        line: node.startPosition.row + 1,
        column: node.startPosition.column + 1,
        text: node.text || undefined
      });
    }

    // Recursively check children
    for (let i = 0; i < node.childCount; i++) {
      const child = node.child(i);
      if (child) {
        visitNode(child);
      }
    }
  };

  visitNode(tree.rootNode);

  return {
    isValid: errors.length === 0,
    errors
  };
}
