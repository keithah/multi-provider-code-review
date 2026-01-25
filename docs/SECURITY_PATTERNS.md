# Security Patterns & Regex Safety

This document explains how Multi-Provider Code Review safely handles user-provided patterns and protects against regex-related attacks.

## Table of Contents

- [Threat Model](#threat-model)
- [Defense Mechanisms](#defense-mechanisms)
- [Safe Pattern Handling](#safe-pattern-handling)
- [Performance Safeguards](#performance-safeguards)
- [Testing Strategy](#testing-strategy)

---

## Threat Model

### Attack Vectors

1. **ReDoS (Regular Expression Denial of Service)**
   - Malicious regex patterns with catastrophic backtracking
   - Nested quantifiers: `(a+)+`, `(a*)*`
   - Overlapping alternations: `(a|ab)+`

2. **Pattern Injection**
   - Control characters in patterns
   - Excessive pattern complexity
   - Very long patterns causing memory exhaustion

3. **Path Traversal via Patterns**
   - Patterns attempting to match parent directories
   - Absolute path patterns

### Assets to Protect

- **CPU time** - Prevent ReDoS attacks
- **Memory** - Limit pattern complexity
- **Data integrity** - Ensure patterns match intended files only

---

## Defense Mechanisms

### 1. PathMatcher Security

#### Multi-Layer Validation

```typescript
// src/analysis/path-matcher.ts

/**
 * SECURITY: Pattern validation happens at construction time
 * All patterns are validated BEFORE being used for matching
 */
private validatePatterns(): void {
  for (const pathPattern of this.config.patterns) {
    this.validateSinglePattern(pathPattern.pattern);
  }
}
```

**Three validation layers:**

1. **Length Check** - Prevents memory exhaustion
   ```typescript
   private checkPatternLength(pattern: string): void {
     const MAX_LENGTH = 500;
     if (pattern.length > MAX_LENGTH) {
       throw new Error(`Pattern too long (${pattern.length} chars, max ${MAX_LENGTH})`);
     }
   }
   ```

2. **Complexity Check** - Prevents ReDoS
   ```typescript
   private checkPatternComplexity(pattern: string): void {
     const wildcardCount = (pattern.match(/\*/g) || []).length;
     const braceCount = (pattern.match(/\{/g) || []).length;
     const complexityScore = wildcardCount * 2 + braceCount * 3;
     const MAX_COMPLEXITY = 50;

     if (complexityScore > MAX_COMPLEXITY) {
       throw new Error(`Pattern too complex (score ${complexityScore})`);
     }
   }
   ```

   **Scoring rationale:**
   - `*` wildcard: 2 points (can cause backtracking)
   - `{a,b,c}` brace expansion: 3 points (multiplicative complexity)
   - Max score 50 allows ~25 wildcards or ~16 braces
   - Real patterns rarely exceed this limit

3. **Control Character Check** - Prevents injection
   ```typescript
   private checkControlCharacters(pattern: string): void {
     for (let i = 0; i < pattern.length; i++) {
       if (pattern.charCodeAt(i) <= 0x1F) {
         throw new Error(`Pattern contains control characters`);
       }
     }
   }
   ```

   **Why reject control characters:**
   - 0x00-0x1F includes: null, tab, newline, carriage return
   - These can break pattern matching assumptions
   - Not needed for legitimate glob patterns

#### Battle-Tested Library

Instead of custom regex conversion, we use **minimatch**:

```typescript
import { minimatch } from 'minimatch';

// Security options enabled
return minimatch(filePath, pattern, {
  dot: true,           // Match dotfiles
  matchBase: false,    // Don't match basenames only
  nocase: false,       // Case-sensitive matching
  nonegate: true,      // SECURITY: Disable negation patterns
  nocomment: true,     // SECURITY: Disable comment patterns
});
```

**Why minimatch:**
- Battle-tested (used by npm, 500M+ downloads/month)
- ReDoS-resistant implementation
- Handles edge cases we might miss
- Actively maintained security updates

#### Result Caching

```typescript
// Cache: `${filePath}:${pattern}` -> boolean
private readonly matchCache = new Map<string, boolean>();

private matchesPattern(filePath: string, pattern: string): boolean {
  const cacheKey = `${filePath}:${pattern}`;
  const cached = this.matchCache.get(cacheKey);
  if (cached !== undefined) {
    return cached;
  }

  const result = minimatch(filePath, pattern, options);
  this.matchCache.set(cacheKey, result);
  return result;
}
```

**Performance benefits:**
- O(1) lookups after first match
- Prevents redundant minimatch calls
- Typical PR: 10-50 files × 5-20 patterns = 50-1000 saved calls

---

### 2. TrivialDetector Security

#### Safe Custom Pattern Handling

```typescript
// src/analysis/trivial-detector.ts

/**
 * SECURITY: Custom patterns are validated before use
 * Invalid patterns fallback to literal string matching
 */
private matchesCustomPattern(filename: string): boolean {
  return this.config.customTrivialPatterns.some(pattern => {
    try {
      // Validate pattern to prevent regex injection and ReDoS
      if (!isValidRegexPattern(pattern)) {
        logger.warn(`Invalid trivial pattern "${pattern}": treating as literal string`);
        return filename.includes(pattern);
      }

      const regex = new RegExp(pattern);
      return regex.test(filename);
    } catch (error) {
      // Invalid regex, treat as literal string match
      logger.warn(`Failed to compile regex pattern "${pattern}": ${error.message}`);
      return filename.includes(pattern);
    }
  });
}
```

**Safety measures:**
1. **Pre-validation** - Check pattern safety before compiling
2. **Graceful degradation** - Fall back to literal matching on error
3. **Error logging** - Warn about problematic patterns
4. **Try-catch wrapper** - Catch regex compilation errors

#### Regex Validator

```typescript
// src/utils/regex-validator.ts

export function isValidRegexPattern(pattern: string): boolean {
  // Length limit
  if (pattern.length > 500) return false;

  // Detect ReDoS patterns
  const suspiciousPatterns = [
    /(\*\*){3,}/,        // Multiple consecutive **
    /(\+\+){3,}/,        // Multiple consecutive ++
    /(\*){10,}/,         // Too many consecutive *
    /\([^)]*[+*]\)[+*]/, // Nested quantifiers: (a+)+
    /\([^|]*\|[^)]*\)[+*]/, // Overlapping alternation: (a|ab)+
    // ... 15+ total patterns
  ];

  for (const suspicious of suspiciousPatterns) {
    if (suspicious.test(pattern)) return false;
  }

  // Try to compile
  try {
    new RegExp(pattern);
    return true;
  } catch {
    return false;
  }
}
```

**Detection strategies:**
- Pattern-based detection (catches common ReDoS forms)
- Quantifier nesting detection
- Alternation overlap detection
- Lookaround quantification detection
- Compilation test as final check

---

## Safe Pattern Handling

### Built-in Patterns (Pre-Audited)

All built-in patterns are safe by design:

```typescript
// Documentation files - simple regex
private readonly DOCUMENTATION_PATTERNS = [
  /\.md$/i,          // Simple suffix match
  /^docs?\//i,       // Simple prefix match
  /README/i,         // Literal substring
  /CHANGELOG/i,      // Literal substring
];

// Test fixtures - simple patterns
private readonly TEST_FIXTURE_PATTERNS = [
  /__fixtures__\//,  // Literal with escaped /
  /__snapshots__\//, // Literal with escaped /
  /\.snap$/,         // Simple suffix
];
```

**No user input in built-in patterns** - These are hardcoded and reviewed.

### User Patterns (Validated)

User patterns go through validation:

```typescript
// PathMatcher - uses minimatch (safe)
const matcher = new PathMatcher({
  patterns: [
    { pattern: 'src/auth/**', intensity: 'thorough' }, // Validated
  ],
});

// TrivialDetector - uses isValidRegexPattern
const detector = new TrivialDetector({
  customTrivialPatterns: [
    '.*\\.generated\\.ts$' // Validated before use
  ],
});
```

---

## Performance Safeguards

### Time Complexity

| Operation | Complexity | Note |
|-----------|-----------|------|
| Pattern validation | O(p×n) | p=patterns, n=avg length, one-time cost |
| Path matching (cached) | O(1) | After first match |
| Path matching (uncached) | O(n) | n=pattern length, minimatch is linear |
| Trivial detection | O(f) | f=files, simple checks |
| Formatting analysis | O(l) | l=changed lines, linear scan |

### Space Complexity

| Component | Space | Limit |
|-----------|-------|-------|
| Pattern cache | O(f×p) | f=files, p=patterns, ~1KB per 100 entries |
| Pattern storage | O(p) | Max 500 chars × patterns |
| Validation state | O(1) | Constant |

### Memory Limits

```typescript
// Maximum pattern length: 500 chars
// Maximum complexity score: 50
// Typical pattern: "src/**/*.ts" (15 chars, score 4)
// Worst case allowed: 25 wildcards or 16 braces
```

**Example calculations:**
- 100 files × 20 patterns = 2000 cache entries
- 2000 × 50 bytes = 100KB cache size
- Very reasonable for typical PRs

---

## Testing Strategy

### Unit Tests (439 total, 77 for these modules)

**PathMatcher (30 tests):**
- ✅ Pattern validation edge cases
- ✅ Boundary conditions (length=500, score=50)
- ✅ Control character rejection
- ✅ Cache behavior
- ✅ Empty inputs
- ✅ No matches scenario

**TrivialDetector (47 tests):**
- ✅ All skip flag combinations
- ✅ Custom pattern validation
- ✅ Formatting detection accuracy
- ✅ Mixed trivial/non-trivial files
- ✅ Built-in pattern coverage

### Property-Based Tests

Consider adding:

```typescript
// Future: Property-based testing with fast-check
it('should handle arbitrary safe patterns', () => {
  fc.assert(
    fc.property(
      fc.string().filter(s => s.length < 500 && !/[^\x20-\x7E]/.test(s)),
      (pattern) => {
        // Should not crash or hang
        const result = isValidRegexPattern(pattern);
        expect(typeof result).toBe('boolean');
      }
    )
  );
});
```

### Fuzzing Tests

Consider adding:

```typescript
// Future: Regex fuzzing
it('should reject known ReDoS patterns', () => {
  const redosPatterns = [
    '(a+)+b',
    '(a*)*b',
    '(a|ab)+c',
    '(a|a)*b',
    // ... from ReDoS databases
  ];

  redosPatterns.forEach(pattern => {
    expect(isValidRegexPattern(pattern)).toBe(false);
  });
});
```

---

## Best Practices

### For Developers

1. **Never bypass validation** - Always validate user patterns
2. **Use minimatch for globs** - Don't write custom glob-to-regex
3. **Cache aggressively** - Prevent redundant expensive operations
4. **Log validation failures** - Help users debug their patterns
5. **Fail safely** - Graceful degradation on error

### For Users

1. **Keep patterns simple** - "src/**/*.ts" is better than complex patterns
2. **Test patterns** - Verify they match expected files
3. **Avoid nested quantifiers** - "(a+)+" will be rejected
4. **Use built-in categories** - More efficient than custom patterns

### For Reviewers

1. **Check for new pattern sources** - Any new user input?
2. **Verify validation calls** - Are all patterns validated?
3. **Test edge cases** - Empty, very long, control characters
4. **Performance test** - Large PRs with many patterns

---

## Incident Response

If a ReDoS vulnerability is found:

1. **Immediate mitigation:**
   ```typescript
   // Add to suspiciousPatterns in regex-validator.ts
   /new-redos-pattern-here/,
   ```

2. **Update validation** - Tighten complexity limits if needed

3. **Add regression test:**
   ```typescript
   it('should reject CVE-XXXX pattern', () => {
     expect(isValidRegexPattern('vulnerable-pattern')).toBe(false);
   });
   ```

4. **Document in changelog** - Security fix note

---

## References

- [OWASP ReDoS](https://owasp.org/www-community/attacks/Regular_expression_Denial_of_Service_-_ReDoS)
- [minimatch security](https://github.com/isaacs/minimatch/security)
- [Regex complexity analysis](https://www.regular-expressions.info/catastrophic.html)

---

**Last Updated:** 2026-01-25 (v0.2.1)
