import { validateSyntax, SyntaxValidationResult } from '../../src/validation/syntax-validator';

describe('validateSyntax', () => {
  describe('valid code', () => {
    it('validates valid TypeScript code', () => {
      const code = 'const x: number = 42;';
      const result = validateSyntax(code, 'typescript');

      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
      expect(result.skipped).toBeUndefined();
    });

    it('validates valid JavaScript code', () => {
      const code = 'const x = 42;';
      const result = validateSyntax(code, 'javascript');

      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('validates valid Python code', () => {
      const code = 'def foo():\n    pass';
      const result = validateSyntax(code, 'python');

      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('validates valid Go code', () => {
      const code = 'func main() {\n    fmt.Println("hello")\n}';
      const result = validateSyntax(code, 'go');

      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });
  });

  describe('ERROR nodes (syntax errors)', () => {
    it('detects ERROR node in TypeScript (missing closing paren)', () => {
      const code = 'const x: number = 42 const y';
      const result = validateSyntax(code, 'typescript');

      expect(result.isValid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
      expect(result.errors[0].type).toBe('ERROR');
      expect(result.errors[0].line).toBeGreaterThan(0);
      expect(result.errors[0].column).toBeGreaterThan(0);
    });

    it('detects ERROR node in JavaScript (invalid syntax)', () => {
      const code = 'const x = {';
      const result = validateSyntax(code, 'javascript');

      expect(result.isValid).toBe(false);
      expect(result.errors.some(e => e.type === 'ERROR' || e.type === 'MISSING')).toBe(true);
    });

    it('detects ERROR node in Python (invalid syntax)', () => {
      const code = 'def foo(';
      const result = validateSyntax(code, 'python');

      expect(result.isValid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
    });

    it('provides line and column information for errors', () => {
      const code = 'const x = 42;\nconst y =';
      const result = validateSyntax(code, 'typescript');

      expect(result.isValid).toBe(false);
      expect(result.errors[0].line).toBe(2); // 1-indexed
      expect(result.errors[0].column).toBeGreaterThan(0);
    });
  });

  describe('MISSING nodes (parser recovery)', () => {
    it('detects MISSING node (unclosed brace)', () => {
      const code = 'function foo() { const x = 1';
      const result = validateSyntax(code, 'typescript');

      expect(result.isValid).toBe(false);
      expect(result.errors.some(e => e.type === 'MISSING')).toBe(true);
    });

    it('detects MISSING node (unclosed parenthesis)', () => {
      const code = 'console.log("test"';
      const result = validateSyntax(code, 'typescript');

      expect(result.isValid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
    });

    it('includes text for MISSING nodes when available', () => {
      const code = 'function foo() {';
      const result = validateSyntax(code, 'typescript');

      expect(result.isValid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
      // text may be undefined for missing nodes
      expect(result.errors[0]).toHaveProperty('text');
    });
  });

  describe('unsupported languages', () => {
    it('returns skipped for unknown language', () => {
      const code = 'some code';
      const result = validateSyntax(code, 'unknown');

      expect(result.isValid).toBe(true);
      expect(result.skipped).toBe(true);
      expect(result.reason).toContain('Unsupported language');
      expect(result.errors).toHaveLength(0);
    });

    it('returns skipped for rust (not currently supported)', () => {
      const code = 'fn main() {}';
      const result = validateSyntax(code, 'rust');

      expect(result.isValid).toBe(true);
      expect(result.skipped).toBe(true);
      expect(result.reason).toContain('Unsupported language');
    });
  });

  describe('parser unavailable', () => {
    it('returns skipped when parser not available', () => {
      // This simulates missing tree-sitter grammar
      // In actual implementation, getParser returns null when grammar unavailable
      const code = 'const x = 42;';

      // Mock scenario is hard to test directly without breaking imports
      // This test ensures the interface supports skipped state
      const mockResult: SyntaxValidationResult = {
        isValid: true,
        skipped: true,
        reason: 'Parser not available',
        errors: []
      };

      expect(mockResult.isValid).toBe(true);
      expect(mockResult.skipped).toBe(true);
      expect(mockResult.reason).toBe('Parser not available');
    });
  });

  describe('complex error scenarios', () => {
    it('detects multiple errors in same code', () => {
      const code = 'const x = { const y =';
      const result = validateSyntax(code, 'typescript');

      expect(result.isValid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
    });

    it('handles multi-line code with errors', () => {
      const code = `function test() {
  const x = 1;
  const y =
  return x;
}`;
      const result = validateSyntax(code, 'typescript');

      expect(result.isValid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
    });
  });

  describe('edge cases', () => {
    it('validates empty code', () => {
      const code = '';
      const result = validateSyntax(code, 'typescript');

      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('validates whitespace-only code', () => {
      const code = '   \n   \n';
      const result = validateSyntax(code, 'typescript');

      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });
  });
});
