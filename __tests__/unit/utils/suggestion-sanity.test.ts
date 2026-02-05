/**
 * Tests for suggestion sanity validation utilities.
 *
 * This module tests the basic quality checks for LLM-generated suggestions
 * to catch obvious red flags before they enter the pipeline.
 */

import {
  validateSuggestionSanity,
  SuggestionSanityResult,
} from '../../../src/utils/suggestion-sanity';

describe('validateSuggestionSanity', () => {
  describe('null and undefined handling', () => {
    it('should reject undefined input', () => {
      const result = validateSuggestionSanity(undefined);
      expect(result.isValid).toBe(false);
      expect(result.reason).toBe('No suggestion provided');
      expect(result.suggestion).toBeUndefined();
    });

    it('should reject null input', () => {
      const result = validateSuggestionSanity(null);
      expect(result.isValid).toBe(false);
      expect(result.reason).toBe('No suggestion provided');
      expect(result.suggestion).toBeUndefined();
    });
  });

  describe('empty and whitespace handling', () => {
    it('should reject empty string', () => {
      const result = validateSuggestionSanity('');
      expect(result.isValid).toBe(false);
      expect(result.reason).toBe('Empty suggestion');
      expect(result.suggestion).toBeUndefined();
    });

    it('should reject whitespace-only string (spaces)', () => {
      const result = validateSuggestionSanity('   ');
      expect(result.isValid).toBe(false);
      expect(result.reason).toBe('Empty suggestion');
      expect(result.suggestion).toBeUndefined();
    });

    it('should reject whitespace-only string (tabs)', () => {
      const result = validateSuggestionSanity('\t\t\t');
      expect(result.isValid).toBe(false);
      expect(result.reason).toBe('Empty suggestion');
      expect(result.suggestion).toBeUndefined();
    });

    it('should reject whitespace-only string (mixed)', () => {
      const result = validateSuggestionSanity(' \t \n ');
      expect(result.isValid).toBe(false);
      expect(result.reason).toBe('Empty suggestion');
      expect(result.suggestion).toBeUndefined();
    });
  });

  describe('line count validation', () => {
    it('should reject suggestions with more than 50 lines', () => {
      const longSuggestion = Array(51)
        .fill('const x = 1;')
        .join('\n');
      const result = validateSuggestionSanity(longSuggestion);
      expect(result.isValid).toBe(false);
      expect(result.reason).toBe('Suggestion too long (>50 lines)');
      expect(result.suggestion).toBeUndefined();
    });

    it('should accept suggestions with exactly 50 lines', () => {
      const fiftyLines = Array(50)
        .fill('const x = 1;')
        .join('\n');
      const result = validateSuggestionSanity(fiftyLines);
      expect(result.isValid).toBe(true);
      expect(result.reason).toBeUndefined();
      expect(result.suggestion).toBeDefined();
    });

    it('should accept suggestions with fewer than 50 lines', () => {
      const shortSuggestion = 'const x = 1;\nconst y = 2;\nconst z = 3;';
      const result = validateSuggestionSanity(shortSuggestion);
      expect(result.isValid).toBe(true);
      expect(result.reason).toBeUndefined();
      expect(result.suggestion).toBeDefined();
    });
  });

  describe('code syntax detection', () => {
    it('should reject plain English without code syntax', () => {
      const result = validateSuggestionSanity('You should consider refactoring this code');
      expect(result.isValid).toBe(false);
      expect(result.reason).toBe('Suggestion lacks code syntax');
      expect(result.suggestion).toBeUndefined();
    });

    it('should reject suggestions with only words', () => {
      const result = validateSuggestionSanity('This is a description of what to do');
      expect(result.isValid).toBe(false);
      expect(result.reason).toBe('Suggestion lacks code syntax');
      expect(result.suggestion).toBeUndefined();
    });

    it('should accept code with curly braces', () => {
      const result = validateSuggestionSanity('if (user) { return user.name; }');
      expect(result.isValid).toBe(true);
      expect(result.suggestion).toBe('if (user) { return user.name; }');
    });

    it('should accept code with parentheses and semicolons', () => {
      const result = validateSuggestionSanity('const x = 1;');
      expect(result.isValid).toBe(true);
      expect(result.suggestion).toBe('const x = 1;');
    });

    it('should accept code with square brackets', () => {
      const result = validateSuggestionSanity('const arr = [1, 2, 3];');
      expect(result.isValid).toBe(true);
      expect(result.suggestion).toBe('const arr = [1, 2, 3];');
    });

    it('should accept code with equals sign', () => {
      const result = validateSuggestionSanity('x = 42');
      expect(result.isValid).toBe(true);
      expect(result.suggestion).toBe('x = 42');
    });

    it('should accept code with arrow function syntax', () => {
      const result = validateSuggestionSanity('const fn = () => 1');
      expect(result.isValid).toBe(true);
      expect(result.suggestion).toBe('const fn = () => 1');
    });

    it('should accept code with angle brackets (generics)', () => {
      const result = validateSuggestionSanity('Array<string>');
      expect(result.isValid).toBe(true);
      expect(result.suggestion).toBe('Array<string>');
    });

    it('should accept code with colons (type annotations, object literals)', () => {
      const result = validateSuggestionSanity('const obj: Record<string, number>');
      expect(result.isValid).toBe(true);
      expect(result.suggestion).toBe('const obj: Record<string, number>');
    });

    it('should accept code with double colons (C++, Rust)', () => {
      const result = validateSuggestionSanity('std::vector<int>');
      expect(result.isValid).toBe(true);
      expect(result.suggestion).toBe('std::vector<int>');
    });
  });

  describe('trimming behavior', () => {
    it('should trim leading whitespace', () => {
      const result = validateSuggestionSanity('  const x = 1;');
      expect(result.isValid).toBe(true);
      expect(result.suggestion).toBe('const x = 1;');
    });

    it('should trim trailing whitespace', () => {
      const result = validateSuggestionSanity('const x = 1;  ');
      expect(result.isValid).toBe(true);
      expect(result.suggestion).toBe('const x = 1;');
    });

    it('should trim both leading and trailing whitespace', () => {
      const result = validateSuggestionSanity('  const x = 1;  ');
      expect(result.isValid).toBe(true);
      expect(result.suggestion).toBe('const x = 1;');
    });

    it('should preserve internal whitespace and newlines', () => {
      const code = 'if (user) {\n  return user.name;\n}';
      const result = validateSuggestionSanity('  ' + code + '  ');
      expect(result.isValid).toBe(true);
      expect(result.suggestion).toBe(code);
    });
  });

  describe('multi-line code handling', () => {
    it('should accept valid multi-line code', () => {
      const code = 'if (user) {\n  return user.name;\n}';
      const result = validateSuggestionSanity(code);
      expect(result.isValid).toBe(true);
      expect(result.suggestion).toBe(code);
    });

    it('should accept function with multiple statements', () => {
      const code = 'function test() {\n  const x = 1;\n  return x + 2;\n}';
      const result = validateSuggestionSanity(code);
      expect(result.isValid).toBe(true);
      expect(result.suggestion).toBe(code);
    });

    it('should accept class definition', () => {
      const code = 'class User {\n  constructor(name: string) {\n    this.name = name;\n  }\n}';
      const result = validateSuggestionSanity(code);
      expect(result.isValid).toBe(true);
      expect(result.suggestion).toBe(code);
    });
  });

  describe('edge cases', () => {
    it('should accept minimal valid code', () => {
      const result = validateSuggestionSanity('x=1');
      expect(result.isValid).toBe(true);
      expect(result.suggestion).toBe('x=1');
    });

    it('should accept code with special characters', () => {
      const result = validateSuggestionSanity('const str = "hello, world!";');
      expect(result.isValid).toBe(true);
      expect(result.suggestion).toBe('const str = "hello, world!";');
    });

    it('should accept code with numbers only if it has syntax', () => {
      const result = validateSuggestionSanity('arr[0]');
      expect(result.isValid).toBe(true);
      expect(result.suggestion).toBe('arr[0]');
    });

    it('should reject pure numbers without syntax', () => {
      const result = validateSuggestionSanity('42');
      expect(result.isValid).toBe(false);
      expect(result.reason).toBe('Suggestion lacks code syntax');
    });
  });

  describe('return structure', () => {
    it('should return isValid true with suggestion for valid input', () => {
      const result = validateSuggestionSanity('const x = 1;');
      expect(result).toMatchObject({
        isValid: true,
        suggestion: 'const x = 1;',
      });
      expect(result.reason).toBeUndefined();
    });

    it('should return isValid false with reason for invalid input', () => {
      const result = validateSuggestionSanity(null);
      expect(result).toMatchObject({
        isValid: false,
        reason: 'No suggestion provided',
      });
      expect(result.suggestion).toBeUndefined();
    });
  });
});
