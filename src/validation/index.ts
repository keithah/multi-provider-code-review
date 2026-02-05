/**
 * Validation module for suggestion quality gates.
 *
 * This module provides:
 * - Syntax validation using tree-sitter
 * - AST comparison for consensus detection
 * - Confidence scoring combining LLM + validation signals
 * - Threshold-based filtering for suggestion posting
 */

export {
  validateSyntax,
  SyntaxValidationResult
} from './syntax-validator';

export {
  areASTsEquivalent,
  ASTComparisonResult
} from './ast-comparator';

export {
  calculateConfidence,
  shouldPostSuggestion,
  ConfidenceSignals,
  QualityConfig
} from './confidence-calculator';
