import { getParser, Language } from '../analysis/ast/parsers';
import Parser from 'tree-sitter';

/**
 * Result of comparing two ASTs for structural equivalence
 */
export interface ASTComparisonResult {
  /** Whether the ASTs are structurally equivalent */
  equivalent: boolean;
  /** Reason for non-equivalence (if false) */
  reason?: string;
  /** How deep the comparison went */
  comparisonDepth?: number;
}

/**
 * Node types to treat as "value-only" - compare type but not content
 * These represent identifiers and literals where the specific value
 * doesn't matter for structural equivalence
 */
const VALUE_ONLY_TYPES = new Set([
  // Identifiers
  'identifier',
  'property_identifier',
  'type_identifier',
  // Literals
  'string',
  'number',
  'true',
  'false',
  'null',
  'template_string',
  'regex',
  // Python-specific
  'integer',
  'float',
  'string_content',
  // JavaScript-specific
  'number_literal',
  'string_literal',
]);

/**
 * Check if a tree-sitter tree has parse errors
 */
function hasParseErrors(tree: Parser.Tree): boolean {
  // Check if root has errors
  if (tree.rootNode.hasError) {
    return true;
  }

  // Walk tree to find ERROR or MISSING nodes
  const cursor = tree.walk();
  let reachedRoot = false;

  while (!reachedRoot) {
    const node = cursor.currentNode;

    // ERROR nodes indicate unparseable text
    if (node.type === 'ERROR') {
      return true;
    }

    // MISSING nodes indicate parser recovery (inserted tokens)
    if (node.isMissing) {
      return true;
    }

    // Try to descend into children first
    if (cursor.gotoFirstChild()) {
      continue;
    }

    // Try to go to next sibling
    if (cursor.gotoNextSibling()) {
      continue;
    }

    // Go up to parent and try next sibling
    let retracing = true;
    while (retracing) {
      if (!cursor.gotoParent()) {
        reachedRoot = true;
        retracing = false;
      } else if (cursor.gotoNextSibling()) {
        retracing = false;
      }
    }
  }

  return false;
}

/**
 * Recursively compare two syntax nodes for structural equivalence
 *
 * @param node1 First node to compare
 * @param node2 Second node to compare
 * @param depth Current recursion depth
 * @returns Comparison result with mismatch details
 */
function compareNodes(
  node1: Parser.SyntaxNode,
  node2: Parser.SyntaxNode,
  depth: number = 0
): { equivalent: boolean; reason?: string; maxDepth: number } {
  const maxDepth = Math.max(depth, 0);

  // Different node types = not equivalent
  // Exception: value-only types match if both are value-only
  if (node1.type !== node2.type) {
    // Both are value-only types - check if they're in the same category
    const node1IsValueOnly = VALUE_ONLY_TYPES.has(node1.type);
    const node2IsValueOnly = VALUE_ONLY_TYPES.has(node2.type);

    if (!node1IsValueOnly || !node2IsValueOnly) {
      return {
        equivalent: false,
        reason: `Node type mismatch at depth ${depth}: ${node1.type} vs ${node2.type}`,
        maxDepth
      };
    }
  }

  // Different total child counts = not equivalent
  // We compare ALL children (named + unnamed) to catch operator/keyword differences
  if (node1.childCount !== node2.childCount) {
    return {
      equivalent: false,
      reason: `Child count mismatch at depth ${depth}: ${node1.childCount} vs ${node2.childCount} children (node type: ${node1.type})`,
      maxDepth
    };
  }

  // If this is a value-only node (identifier or literal), structure matches
  // Don't compare actual text content
  if (VALUE_ONLY_TYPES.has(node1.type) && VALUE_ONLY_TYPES.has(node2.type)) {
    return { equivalent: true, maxDepth: depth };
  }

  // Recursively compare ALL children (named and unnamed)
  // Unnamed nodes include operators (+, -, etc.) and keywords (const, let, etc.)
  // which ARE structurally significant
  let deepestDepth = depth;
  for (let i = 0; i < node1.childCount; i++) {
    const child1 = node1.child(i);
    const child2 = node2.child(i);

    if (!child1 || !child2) {
      return {
        equivalent: false,
        reason: `Missing child at index ${i}, depth ${depth}`,
        maxDepth: deepestDepth
      };
    }

    const childResult = compareNodes(child1, child2, depth + 1);
    deepestDepth = Math.max(deepestDepth, childResult.maxDepth);

    if (!childResult.equivalent) {
      return {
        equivalent: false,
        reason: childResult.reason,
        maxDepth: deepestDepth
      };
    }
  }

  return { equivalent: true, maxDepth: deepestDepth };
}

/**
 * Compare two code snippets for structural equivalence using AST comparison
 *
 * Two code snippets are considered equivalent if:
 * - They parse without errors
 * - Their AST node types match
 * - Their child node counts match
 * - Child nodes recursively match
 *
 * Ignored differences:
 * - Whitespace and formatting
 * - Variable/function/property names
 * - Literal values (numbers, strings, booleans)
 * - Comments (not in AST)
 *
 * @param code1 First code snippet
 * @param code2 Second code snippet
 * @param language Programming language for parsing
 * @returns Comparison result with equivalence status and details
 */
export function areASTsEquivalent(
  code1: string,
  code2: string,
  language: Language
): ASTComparisonResult {
  // Check for unsupported language
  if (language === 'unknown') {
    return {
      equivalent: false,
      reason: 'Unsupported language: unknown'
    };
  }

  // Get parser for language
  const parser = getParser(language);
  if (!parser) {
    return {
      equivalent: false,
      reason: `Unsupported language: ${language}`
    };
  }

  // Parse both code snippets
  const tree1 = parser.parse(code1);
  const tree2 = parser.parse(code2);

  // Check for parse errors in first code
  if (hasParseErrors(tree1)) {
    return {
      equivalent: false,
      reason: 'Parse error in code1'
    };
  }

  // Check for parse errors in second code
  if (hasParseErrors(tree2)) {
    return {
      equivalent: false,
      reason: 'Parse error in code2'
    };
  }

  // Compare AST structures
  const result = compareNodes(tree1.rootNode, tree2.rootNode);

  return {
    equivalent: result.equivalent,
    reason: result.reason,
    comparisonDepth: result.maxDepth
  };
}
