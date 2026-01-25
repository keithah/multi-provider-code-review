/**
 * Shared regex validation utility
 * Protects against ReDoS attacks and invalid patterns
 */

/**
 * Validate regex pattern for safety against ReDoS attacks
 *
 * @param pattern - The regex pattern to validate
 * @returns true if pattern is safe, false otherwise
 */
export function isValidRegexPattern(pattern: string): boolean {
  // Check for empty or non-string patterns
  if (!pattern || typeof pattern !== 'string') {
    return false;
  }

  // Limit pattern length to prevent complexity attacks
  if (pattern.length > 500) {
    return false;
  }

  // Check for suspicious patterns that could cause ReDoS
  const suspiciousPatterns = [
    // Quantifier-based attacks
    /(\*\*){3,}/, // Multiple consecutive **
    /(\+\+){3,}/, // Multiple consecutive ++
    /(\*){10,}/, // Too many consecutive *
    /(\+){10,}/, // Too many consecutive +
    /(.)\1{20,}/, // Excessive character repetition
    /(\.\*){5,}/, // Too many .* patterns
    /(\.\+){5,}/, // Too many .+ patterns

    // Nested quantifiers (catastrophic backtracking)
    /\([^)]*[+*]\)[+*]/, // (a+)+ or (a*)* patterns
    /\([^)]*[+*]\)\{/, // (a+){n,m} patterns
    /\[[^\]]*\][+*]\{/, // [a-z]+{n,m} patterns

    // Alternation with overlap (ReDoS vectors)
    /\([^|]*\|[^)]*\)[+*]/, // (a|ab)+ patterns
    /\{[^}]{100,}\}/, // Very long brace expansions

    // Excessive nesting and complexity
    /(\(.*){5,}/, // Too many nested groups
    /(\[.*){10,}/, // Too many character classes
    /(\||\/){20,}/, // Excessive alternation

    // Dangerous lookahead/lookbehind combos
    /\(\?[=!<].*\)\+/, // Quantified lookarounds
    /\(\?[=!<].*\)\*/, // Quantified lookarounds
  ];

  for (const suspicious of suspiciousPatterns) {
    if (suspicious.test(pattern)) {
      return false;
    }
  }

  // Try to compile the pattern
  try {
    new RegExp(pattern);
    return true;
  } catch {
    return false;
  }
}
