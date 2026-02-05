import { areASTsEquivalent, ASTComparisonResult } from '../../src/validation/ast-comparator';
import { Language } from '../../src/analysis/ast/parsers';

describe('AST Comparator', () => {
  describe('areASTsEquivalent', () => {
    describe('whitespace equivalence', () => {
      it('should treat code with different whitespace as equivalent', () => {
        const code1 = 'x + 1';
        const code2 = 'x+1';

        const result = areASTsEquivalent(code1, code2, 'typescript');

        expect(result.equivalent).toBe(true);
      });

      it('should treat code with different indentation as equivalent', () => {
        const code1 = `function foo() {
  return x + 1;
}`;
        const code2 = `function foo() {
    return x + 1;
}`;

        const result = areASTsEquivalent(code1, code2, 'typescript');

        expect(result.equivalent).toBe(true);
      });

      it('should treat code with different newlines as equivalent', () => {
        const code1 = 'const x = 1;\nconst y = 2;';
        const code2 = 'const x = 1; const y = 2;';

        const result = areASTsEquivalent(code1, code2, 'typescript');

        expect(result.equivalent).toBe(true);
      });
    });

    describe('variable name equivalence', () => {
      it('should treat code with different variable names as equivalent', () => {
        const code1 = 'const x = 1;';
        const code2 = 'const y = 1;';

        const result = areASTsEquivalent(code1, code2, 'typescript');

        expect(result.equivalent).toBe(true);
      });

      it('should treat code with different function names as equivalent', () => {
        const code1 = 'function foo() { return 1; }';
        const code2 = 'function bar() { return 1; }';

        const result = areASTsEquivalent(code1, code2, 'typescript');

        expect(result.equivalent).toBe(true);
      });

      it('should treat code with different property names as equivalent', () => {
        const code1 = 'obj.foo';
        const code2 = 'obj.bar';

        const result = areASTsEquivalent(code1, code2, 'typescript');

        expect(result.equivalent).toBe(true);
      });
    });

    describe('literal value equivalence', () => {
      it('should treat code with different number literals as equivalent', () => {
        const code1 = 'const x = 1;';
        const code2 = 'const x = 2;';

        const result = areASTsEquivalent(code1, code2, 'typescript');

        expect(result.equivalent).toBe(true);
      });

      it('should treat code with different string literals as equivalent', () => {
        const code1 = 'const x = "hello";';
        const code2 = 'const x = "world";';

        const result = areASTsEquivalent(code1, code2, 'typescript');

        expect(result.equivalent).toBe(true);
      });

      it('should treat code with different boolean literals as equivalent', () => {
        const code1 = 'const x = true;';
        const code2 = 'const x = false;';

        const result = areASTsEquivalent(code1, code2, 'typescript');

        expect(result.equivalent).toBe(true);
      });
    });

    describe('structural differences', () => {
      it('should detect different operators as non-equivalent', () => {
        const code1 = 'x + 1';
        const code2 = 'x - 1';

        const result = areASTsEquivalent(code1, code2, 'typescript');

        expect(result.equivalent).toBe(false);
        expect(result.reason).toMatch(/node type mismatch/i);
      });

      it('should detect different child counts as non-equivalent', () => {
        const code1 = 'foo(a)';
        const code2 = 'foo(a, b)';

        const result = areASTsEquivalent(code1, code2, 'typescript');

        expect(result.equivalent).toBe(false);
        expect(result.reason).toMatch(/child count mismatch/i);
      });

      it('should detect different node types as non-equivalent', () => {
        const code1 = 'const x = 1;';
        const code2 = 'let x = 1;';

        const result = areASTsEquivalent(code1, code2, 'typescript');

        expect(result.equivalent).toBe(false);
        expect(result.reason).toMatch(/node type mismatch/i);
      });

      it('should detect different control flow as non-equivalent', () => {
        const code1 = 'if (x) { return 1; }';
        const code2 = 'while (x) { return 1; }';

        const result = areASTsEquivalent(code1, code2, 'typescript');

        expect(result.equivalent).toBe(false);
        expect(result.reason).toMatch(/node type mismatch/i);
      });
    });

    describe('parse error handling', () => {
      it('should handle parse errors in first code', () => {
        const code1 = 'const x = ';
        const code2 = 'const x = 1;';

        const result = areASTsEquivalent(code1, code2, 'typescript');

        expect(result.equivalent).toBe(false);
        expect(result.reason).toMatch(/parse error in code1/i);
      });

      it('should handle parse errors in second code', () => {
        const code1 = 'const x = 1;';
        const code2 = 'const x = ';

        const result = areASTsEquivalent(code1, code2, 'typescript');

        expect(result.equivalent).toBe(false);
        expect(result.reason).toMatch(/parse error in code2/i);
      });

      it('should handle both codes having parse errors', () => {
        const code1 = 'const x = ';
        const code2 = 'let y = ';

        const result = areASTsEquivalent(code1, code2, 'typescript');

        expect(result.equivalent).toBe(false);
        expect(result.reason).toMatch(/parse error/i);
      });
    });

    describe('unsupported language handling', () => {
      it('should handle unsupported language gracefully', () => {
        const code1 = 'const x = 1;';
        const code2 = 'const y = 1;';

        const result = areASTsEquivalent(code1, code2, 'unknown');

        expect(result.equivalent).toBe(false);
        expect(result.reason).toMatch(/unsupported language/i);
      });
    });

    describe('depth tracking', () => {
      it('should track comparison depth for simple expressions', () => {
        const code1 = 'x + 1';
        const code2 = 'y + 2';

        const result = areASTsEquivalent(code1, code2, 'typescript');

        expect(result.equivalent).toBe(true);
        expect(result.comparisonDepth).toBeGreaterThan(0);
      });

      it('should track comparison depth for nested expressions', () => {
        const code1 = 'function foo() { if (x) { return y + 1; } }';
        const code2 = 'function bar() { if (a) { return b + 2; } }';

        const result = areASTsEquivalent(code1, code2, 'typescript');

        expect(result.equivalent).toBe(true);
        expect(result.comparisonDepth).toBeGreaterThan(3);
      });
    });

    describe('JavaScript support', () => {
      it('should support JavaScript syntax', () => {
        const code1 = 'const x = 1;';
        const code2 = 'const y = 2;';

        const result = areASTsEquivalent(code1, code2, 'javascript');

        expect(result.equivalent).toBe(true);
      });
    });

    describe('Python support', () => {
      it('should support Python syntax', () => {
        const code1 = 'x = 1';
        const code2 = 'y = 2';

        const result = areASTsEquivalent(code1, code2, 'python');

        expect(result.equivalent).toBe(true);
      });

      it('should detect Python structural differences', () => {
        const code1 = 'x + 1';
        const code2 = 'x - 1';

        const result = areASTsEquivalent(code1, code2, 'python');

        expect(result.equivalent).toBe(false);
        expect(result.reason).toMatch(/node type mismatch/i);
      });
    });

    describe('complex equivalence scenarios', () => {
      it('should handle function declarations with different bodies', () => {
        const code1 = 'function foo(x) { return x + 1; }';
        const code2 = 'function bar(y) { return y - 1; }';

        const result = areASTsEquivalent(code1, code2, 'typescript');

        expect(result.equivalent).toBe(false);
        expect(result.reason).toMatch(/node type mismatch/i);
      });

      it('should handle identical structure with all differences ignored', () => {
        const code1 = `
          function add(x, y) {
            const result = x + y;
            return result;
          }
        `;
        const code2 = `
          function sum(a,b){const value=a+b;return value;}
        `;

        const result = areASTsEquivalent(code1, code2, 'typescript');

        expect(result.equivalent).toBe(true);
      });
    });
  });
});
