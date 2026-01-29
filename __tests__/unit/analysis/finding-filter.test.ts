import { FindingFilter } from '../../../src/analysis/finding-filter';
import { Finding } from '../../../src/types';

describe('FindingFilter', () => {
  let filter: FindingFilter;

  beforeEach(() => {
    filter = new FindingFilter();
  });

  describe('filter', () => {
    test('keeps valid findings unchanged', () => {
      const findings: Finding[] = [
        {
          file: 'src/index.ts',
          line: 10,
          severity: 'critical',
          title: 'SQL Injection vulnerability',
          message: 'User input is directly concatenated into SQL query',
        },
      ];

      const { findings: filtered, stats } = filter.filter(findings, '');

      expect(filtered).toEqual(findings);
      expect(stats.kept).toBe(1);
      expect(stats.filtered).toBe(0);
      expect(stats.downgraded).toBe(0);
    });

    test('filters documentation formatting issues', () => {
      const findings: Finding[] = [
        {
          file: 'README.md',
          line: 5,
          severity: 'major',
          title: 'Markdown formatting issue',
          message: 'Code block should specify language',
        },
      ];

      const { findings: filtered, stats } = filter.filter(findings, '');

      expect(filtered).toHaveLength(0);
      expect(stats.filtered).toBe(1);
      expect(stats.reasons['documentation formatting']).toBe(1);
    });

    test('downgrades critical documentation issues', () => {
      const findings: Finding[] = [
        {
          file: 'docs/guide.md',
          line: 10,
          severity: 'critical',
          title: 'Security issue in docs',
          message: 'API key exposed in documentation',
        },
      ];

      const { findings: filtered, stats } = filter.filter(findings, '');

      expect(filtered).toHaveLength(1);
      expect(filtered[0].severity).toBe('minor');
      expect(stats.downgraded).toBe(1);
    });

    test('filters test intentional inconsistencies', () => {
      const findings: Finding[] = [
        {
          file: 'src/utils.test.ts',
          line: 20,
          severity: 'critical',
          title: 'Test data inconsistency',
          message: 'Test has inconsistent mock data',
        },
      ];

      const { findings: filtered, stats } = filter.filter(findings, '');

      expect(filtered).toHaveLength(0);
      expect(stats.filtered).toBe(1);
      expect(stats.reasons['intentional test pattern']).toBe(1);
    });

    test('downgrades lint issues from critical to minor', () => {
      const findings: Finding[] = [
        {
          file: 'src/app.ts',
          line: 15,
          severity: 'critical',
          title: 'Unused variable',
          message: 'Variable "foo" is declared but never used',
        },
      ];

      const { findings: filtered, stats } = filter.filter(findings, '');

      expect(filtered).toHaveLength(1);
      expect(filtered[0].severity).toBe('minor');
      expect(stats.downgraded).toBe(1);
    });

    test('downgrades style issues from major to minor', () => {
      const findings: Finding[] = [
        {
          file: 'src/utils.ts',
          line: 8,
          severity: 'major',
          title: 'Prefer const over let',
          message: 'Use const instead of let for immutable values',
        },
      ];

      const { findings: filtered, stats } = filter.filter(findings, '');

      expect(filtered).toHaveLength(1);
      expect(filtered[0].severity).toBe('minor');
      expect(stats.downgraded).toBe(1);
    });

    test('filters "missing method" false positives', () => {
      const diff = `
        class Foo {
          serialize(): string {
            return JSON.stringify(this);
          }
        }
      `;

      const findings: Finding[] = [
        {
          file: 'src/foo.ts',
          line: 10,
          severity: 'critical',
          title: 'Missing serialize method',
          message: 'Class lacks serialize method for data persistence',
        },
      ];

      const { findings: filtered, stats } = filter.filter(findings, diff);

      expect(filtered).toHaveLength(0);
      expect(stats.filtered).toBe(1);
      expect(stats.reasons['method exists in code']).toBe(1);
    });

    test('downgrades suggestions from critical', () => {
      const findings: Finding[] = [
        {
          file: 'src/api.ts',
          line: 25,
          severity: 'critical',
          title: 'Consider adding caching',
          message: 'This endpoint could benefit from caching',
        },
      ];

      const { findings: filtered, stats } = filter.filter(findings, '');

      expect(filtered).toHaveLength(1);
      expect(filtered[0].severity).toBe('minor');
      expect(stats.downgraded).toBe(1);
    });

    test('filters line number issues (blank lines)', () => {
      const diff = `
        function foo() {
          console.log('test');

        }
      `;

      const findings: Finding[] = [
        {
          file: 'src/test.ts',
          line: 4, // Blank line
          severity: 'major',
          title: 'Logic error',
          message: 'Invalid operation detected',
        },
      ];

      const { findings: filtered, stats } = filter.filter(findings, diff);

      expect(filtered).toHaveLength(0);
      expect(stats.filtered).toBe(1);
      expect(stats.reasons['invalid line number']).toBe(1);
    });

    test('filters line number issues (closing braces)', () => {
      const diff = `
        function bar() {
          return true;
        }
      `;

      const findings: Finding[] = [
        {
          file: 'src/test.ts',
          line: 4, // Closing brace
          severity: 'critical',
          title: 'Security issue',
          message: 'Unsafe operation',
        },
      ];

      const { findings: filtered, stats } = filter.filter(findings, diff);

      expect(filtered).toHaveLength(0);
      expect(stats.filtered).toBe(1);
    });

    test('handles multiple findings with mixed actions', () => {
      const diff = `
        function process(data: string) {
          if (typeof data !== 'string') return null;
          return data.toUpperCase();
        }
      `;

      const findings: Finding[] = [
        {
          file: 'src/app.ts',
          line: 10,
          severity: 'critical',
          title: 'SQL Injection',
          message: 'Direct SQL concatenation detected',
        },
        {
          file: 'README.md',
          line: 5,
          severity: 'major',
          title: 'Markdown formatting',
          message: 'Code block needs language',
        },
        {
          file: 'src/utils.ts',
          line: 20,
          severity: 'critical',
          title: 'Unused variable foo',
          message: 'Variable declared but never used',
        },
        {
          file: 'src/test.test.ts',
          line: 15,
          severity: 'major',
          title: 'Test mock inconsistency',
          message: 'Mock data intentionally mismatched',
        },
      ];

      const { findings: filtered, stats } = filter.filter(findings, diff);

      // Should keep SQL injection (real issue)
      // Should filter markdown formatting
      // Should downgrade unused variable to minor
      // Should filter test inconsistency
      expect(filtered).toHaveLength(2);
      expect(stats.kept).toBe(2);
      expect(stats.filtered).toBe(2);
      expect(stats.downgraded).toBe(1);
    });

    test('logs filter statistics when changes are made', () => {
      const findings: Finding[] = [
        {
          file: 'README.md',
          line: 5,
          severity: 'major',
          title: 'Formatting',
          message: 'Markdown spacing issue',
        },
      ];

      const { stats } = filter.filter(findings, '');

      expect(stats.total).toBe(1);
      expect(stats.filtered).toBe(1);
      expect(stats.kept).toBe(0);
      expect(Object.keys(stats.reasons).length).toBeGreaterThan(0);
    });

    test('handles empty findings array', () => {
      const { findings, stats } = filter.filter([], '');

      expect(findings).toHaveLength(0);
      expect(stats.total).toBe(0);
      expect(stats.filtered).toBe(0);
      expect(stats.kept).toBe(0);
    });

    test('preserves finding properties when downgrading', () => {
      const findings: Finding[] = [
        {
          file: 'src/app.ts',
          line: 10,
          severity: 'critical',
          title: 'Lint: unused import',
          message: 'Import React is unused',
          suggestion: 'Remove the unused import',
        },
      ];

      const { findings: filtered } = filter.filter(findings, '');

      expect(filtered[0]).toMatchObject({
        file: 'src/app.ts',
        line: 10,
        severity: 'minor', // Changed
        title: 'Lint: unused import',
        message: 'Import React is unused',
        suggestion: 'Remove the unused import',
      });
    });
  });

  describe('file type detection', () => {
    test('identifies markdown files', () => {
      const findings: Finding[] = [
        { file: 'README.md', line: 1, severity: 'major', title: 'Heading', message: 'Issue' },
        { file: 'docs/guide.MD', line: 1, severity: 'major', title: 'Heading', message: 'Issue' },
        { file: 'CHANGELOG.txt', line: 1, severity: 'major', title: 'Heading', message: 'Issue' },
      ];

      const { findings: filtered } = filter.filter(
        findings.map(f => ({ ...f, title: 'Markdown formatting', message: 'Code block issue' })),
        ''
      );

      // All should be filtered as documentation formatting
      expect(filtered).toHaveLength(0);
    });

    test('identifies test files', () => {
      const findings: Finding[] = [
        { file: 'src/app.test.ts', line: 1, severity: 'major', title: 'Test', message: 'Inconsistent mock' },
        { file: 'src/utils.spec.js', line: 1, severity: 'major', title: 'Test', message: 'Inconsistent mock' },
        { file: 'src/__tests__/foo.ts', line: 1, severity: 'major', title: 'Test', message: 'Inconsistent mock' },
      ];

      const { findings: filtered } = filter.filter(
        findings.map(f => ({ ...f, message: 'Test intentional inconsistent data' })),
        ''
      );

      // All should be filtered as intentional test patterns
      expect(filtered).toHaveLength(0);
    });
  });

  describe('real-world scenarios', () => {
    test('handles PR #8 false positive: missing validation', () => {
      const diff = `
        export function encodeURIComponentSafe(value: string): string {
          if (typeof value !== 'string') {
            return 'invalid';
          }
          return encodeURIComponent(value);
        }
      `;

      const findings: Finding[] = [
        {
          file: 'src/utils.ts',
          line: 2, // Line with function declaration
          severity: 'critical',
          title: 'Missing input validation',
          message: 'Function lacks null/undefined validation',
        },
      ];

      // Should NOT filter this - it's a judgment call
      // But if it mentioned "missing type check" it would be caught by pattern detection
      const { findings: filtered } = filter.filter(findings, diff);

      // This specific case isn't filtered by FindingFilter, but would be prevented
      // by ValidationDetector in the prompt context
      expect(filtered).toHaveLength(1);
    });

    test('handles PR #8 false positive: unused parameter', () => {
      const diff = `
        async healthCheck(_timeoutMs: number = 5000): Promise<boolean> {
          return await this.resolveBinary();
        }
      `;

      const findings: Finding[] = [
        {
          file: 'src/provider.ts',
          line: 2,
          severity: 'major',
          title: 'Unused parameter',
          message: 'Timeout parameter _timeoutMs is unused',
        },
      ];

      const { findings: filtered, stats } = filter.filter(findings, diff);

      // Should downgrade to minor (it's a lint issue)
      expect(filtered).toHaveLength(1);
      expect(filtered[0].severity).toBe('minor');
      expect(stats.downgraded).toBe(1);
    });

    test('handles test data inconsistency false positive', () => {
      const diff = `
        it('returns error code for critical findings', () => {
          const review = {
            findings: [], // Intentionally empty for testing
            metrics: { critical: 1 },
          };
          expect(getExitCode(review)).toBe(2);
        });
      `;

      const findings: Finding[] = [
        {
          file: 'src/formatter.test.ts',
          line: 3,
          severity: 'critical',
          title: 'Test data inconsistency',
          message: 'metrics.critical = 1 but findings array is empty',
        },
      ];

      const { findings: filtered, stats } = filter.filter(findings, diff);

      // Should filter as intentional test pattern
      expect(filtered).toHaveLength(0);
      expect(stats.filtered).toBe(1);
      expect(stats.reasons['intentional test pattern']).toBe(1);
    });
  });
});
