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

      const { findings: filtered, stats: _stats } = filter.filter(findings, '');

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

      const { findings: filtered, stats: _stats } = filter.filter(findings, '');

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

      const { findings: filtered, stats: _stats } = filter.filter(findings, '');

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

      const { findings: filtered, stats: _stats } = filter.filter(findings, '');

      expect(filtered).toHaveLength(0);
      expect(stats.filtered).toBe(1);
      expect(stats.reasons['test code quality (not production issue)']).toBe(1);
    });

    test('filters lint issues completely', () => {
      const findings: Finding[] = [
        {
          file: 'src/app.ts',
          line: 15,
          severity: 'critical',
          title: 'Unused variable',
          message: 'Variable "foo" is declared but never used',
        },
      ];

      const { findings: filtered, stats: _stats } = filter.filter(findings, '');

      // Lint issues are now completely filtered
      expect(filtered).toHaveLength(0);
      expect(stats.filtered).toBe(1);
    });

    test('filters style issues completely', () => {
      const findings: Finding[] = [
        {
          file: 'src/utils.ts',
          line: 8,
          severity: 'major',
          title: 'Prefer const over let',
          message: 'Use const instead of let for immutable values',
        },
      ];

      const { findings: filtered, stats: _stats } = filter.filter(findings, '');

      // Style issues are now completely filtered
      expect(filtered).toHaveLength(0);
      expect(stats.filtered).toBe(1);
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

    test('filters suggestions completely', () => {
      const findings: Finding[] = [
        {
          file: 'src/api.ts',
          line: 25,
          severity: 'critical',
          title: 'Consider adding caching',
          message: 'This endpoint could benefit from caching',
        },
        {
          file: 'src/utils.ts',
          line: 30,
          severity: 'major',
          title: 'Validation',
          message: 'Ensure that all inputs are validated properly',
        },
        {
          file: 'src/config.ts',
          line: 10,
          severity: 'major',
          title: 'Monitoring',
          message: 'Monitor the performance and adjust as needed',
        },
      ];

      const { findings: filtered, stats: _stats } = filter.filter(findings, '');

      expect(filtered).toHaveLength(0);
      expect(stats.filtered).toBe(3);
      expect(stats.reasons['suggestion/optimization (not a bug)']).toBe(3);
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
      expect(stats.reasons['line number points to blank/brace/comment']).toBe(1);
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
      expect(stats.reasons['line number points to blank/brace/comment']).toBe(1);
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
      // Should filter unused variable (lint/style issue)
      // Should filter test inconsistency
      expect(filtered).toHaveLength(1);
      expect(stats.kept).toBe(1);
      expect(stats.filtered).toBe(3);
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
          file: 'README.md',
          line: 10,
          severity: 'critical',
          title: 'Broken link',
          message: 'Link to external resource is broken',
          suggestion: 'Update the link',
        },
      ];

      const { findings: filtered } = filter.filter(findings, '');

      expect(filtered[0]).toMatchObject({
        file: 'README.md',
        line: 10,
        severity: 'minor', // Documentation issues get downgraded
        title: 'Broken link',
        message: 'Link to external resource is broken',
        suggestion: 'Update the link',
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

      // Now filtered aggressively - "missing validation" is a suggestion, not a bug
      // TypeScript types already enforce validation at the type level
      const { findings: filtered } = filter.filter(findings, diff);

      // This is now filtered by the suggestion filter (contains "missing" + "validation")
      expect(filtered).toHaveLength(0);
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

      // Should filter completely (it's a lint issue)
      expect(filtered).toHaveLength(0);
      expect(stats.filtered).toBe(1);
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
      expect(stats.reasons['test code quality (not production issue)']).toBe(1);
    });

    test('filters test code quality issues', () => {
      const findings: Finding[] = [
        {
          file: '__tests__/unit/foo.test.ts',
          line: 10,
          severity: 'major',
          title: 'Missing Edge Case Handling',
          message: 'Test cases don\'t cover edge scenarios',
        },
        {
          file: 'src/utils.spec.ts',
          line: 20,
          severity: 'critical',
          title: 'Missing test coverage',
          message: 'Function is not tested',
        },
      ];

      const { findings: filtered, stats: _stats } = filter.filter(findings, '');

      expect(filtered).toHaveLength(0);
      expect(stats.filtered).toBe(2);
      expect(stats.reasons['test code quality (not production issue)']).toBe(2);
    });

    test('filters all test file issues', () => {
      const findings: Finding[] = [
        {
          file: 'src/app.test.ts',
          line: 15,
          severity: 'critical',
          title: 'Some other issue',
          message: 'Not a specific pattern',
        },
      ];

      const { findings: filtered, stats: _stats } = filter.filter(findings, '');

      // ALL test files are now filtered, no exceptions (except true security issues)
      expect(filtered).toHaveLength(0);
      expect(stats.filtered).toBe(1);
    });

    test('keeps true security issues in test files', () => {
      const findings: Finding[] = [
        {
          file: 'src/auth.test.ts',
          line: 10,
          severity: 'critical',
          title: 'SQL Injection vulnerability',
          message: 'Test directly concatenates SQL',
        },
      ];

      const { findings: filtered, stats: _stats } = filter.filter(findings, '');

      expect(filtered).toHaveLength(1);
      expect(filtered[0].severity).toBe('critical');
      expect(stats.kept).toBe(1);
      expect(stats.downgraded).toBe(0);
    });

    test('filters workflow security false positives', () => {
      const diff = `
        - name: Security check
          run: |
            if [ -n "$OPENROUTER_API_KEY" ]; then
              echo "SECURITY VIOLATION: Fork PR has access to secrets"
              exit 1
            fi
      `;

      const findings: Finding[] = [
        {
          file: '.github/workflows/multi-provider-review.yml',
          line: 97,
          severity: 'critical',
          title: 'Security Risk: Fork PR Secret Exposure',
          message: 'Fork PRs could access secrets',
        },
        {
          file: '.github/workflows/multi-provider-review.yml',
          line: 142,
          severity: 'critical',
          title: 'Fork PR Security Risk',
          message: 'Secrets might be exposed to forks',
        },
      ];

      const { findings: filtered, stats } = filter.filter(findings, diff);

      expect(filtered).toHaveLength(0);
      expect(stats.filtered).toBe(2);
      // Can be either reason string depending on which filter catches it first
      const totalWorkflowFiltered =
        (stats.reasons['workflow security already handled/config issue'] || 0) +
        (stats.reasons['workflow/CI configuration (not application code)'] || 0);
      expect(totalWorkflowFiltered).toBe(2);
    });

    test('deduplicates similar findings', () => {
      const findings: Finding[] = [
        {
          file: 'src/app.ts',
          line: 10,
          severity: 'major',
          title: 'Security Risk: Fork PR Secret Exposure',
          message: 'First occurrence',
        },
        {
          file: 'src/app.ts',
          line: 20,
          severity: 'critical',
          title: 'Security Risk: Fork PR Secret Exposure!',
          message: 'Second occurrence',
        },
        {
          file: 'src/app.ts',
          line: 30,
          severity: 'major',
          title: 'Security Risk Fork PR Secret Exposure',
          message: 'Third occurrence',
        },
      ];

      const { findings: filtered, stats: _stats } = filter.filter(findings, '');

      // Should keep only one (the most severe)
      expect(filtered).toHaveLength(1);
      expect(filtered[0].severity).toBe('critical');
      expect(stats.filtered).toBe(2);
      expect(stats.reasons['duplicate finding']).toBe(2);
    });

    test('filters jest.setup.ts issues', () => {
      const findings: Finding[] = [
        {
          file: 'jest.setup.ts',
          line: 101,
          severity: 'major',
          title: 'Unsafe exit code override',
          message: 'afterAll resets process.exitCode',
        },
      ];

      const { findings: filtered, stats: _stats } = filter.filter(findings, '');

      // jest.setup.ts is test infrastructure - should be completely filtered
      expect(filtered).toHaveLength(0);
      expect(stats.filtered).toBe(1);
    });

    test('filters workflow configuration issues', () => {
      const findings: Finding[] = [
        {
          file: '.github/workflows/ci.yml',
          line: 46,
          severity: 'major',
          title: 'CI test flags',
          message: 'detectOpenHandles and testTimeout may cause flakiness',
        },
        {
          file: '.github/workflows/deploy.yml',
          line: 10,
          severity: 'critical',
          title: 'Timeout configuration',
          message: 'Workflow timeout is too long',
        },
      ];

      const { findings: filtered, stats: _stats } = filter.filter(findings, '');

      // Should filter both
      expect(filtered).toHaveLength(0);
      expect(stats.filtered).toBe(2);
      expect(stats.reasons['workflow/CI configuration (not application code)']).toBe(2);
    });

    test('filters general workflow security config warnings', () => {
      const findings: Finding[] = [
        {
          file: '.github/workflows/review.yml',
          line: 97,
          severity: 'critical',
          title: 'Security Risk: Fork PR Secret Exposure',
          message: 'Workflow assumes repository setting is disabled',
        },
        {
          file: '.github/workflows/review.yml',
          line: 40,
          severity: 'critical',
          title: 'Fork PR security',
          message: 'Disable "Send secrets to workflows from pull requests" in repository settings',
        },
      ];

      const { findings: filtered, stats: _stats } = filter.filter(findings, '');

      // Should filter both as general config warnings
      expect(filtered).toHaveLength(0);
      expect(stats.filtered).toBe(2);
    });

    test('semantic deduplication groups similar fork PR findings', () => {
      const findings: Finding[] = [
        {
          file: '.github/workflows/review.yml',
          line: 40,
          severity: 'critical',
          title: 'Security vulnerability in fork PR handling',
          message: 'Fork PRs could access secrets',
        },
        {
          file: '.github/workflows/review.yml',
          line: 97,
          severity: 'critical',
          title: 'Security Risk: Fork PR Secret Exposure',
          message: 'Secrets might be exposed',
        },
        {
          file: '.github/workflows/review.yml',
          line: 142,
          severity: 'major',
          title: 'Fork PR secret exposure risk and gate logic',
          message: 'Security risk in fork PR handling',
        },
      ];

      const { findings: filtered, stats: _stats } = filter.filter(findings, '');

      // All should be filtered as workflow config, and if any survive, deduped to 1
      expect(filtered.length).toBeLessThanOrEqual(1);
      expect(stats.filtered).toBeGreaterThanOrEqual(2);
    });

    test('downgrades code quality issues from critical', () => {
      const findings: Finding[] = [
        {
          file: 'src/utils.ts',
          line: 10,
          severity: 'critical',
          title: 'Missing input validation',
          message: 'Function lacks parameter validation',
        },
        {
          file: 'src/api.ts',
          line: 20,
          severity: 'critical',
          title: 'Hard-coded configuration',
          message: 'API URL is hard-coded',
        },
      ];

      const { findings: filtered, stats: _stats } = filter.filter(findings, '');

      // Both are filtered completely:
      // "Missing input validation" - filtered as suggestion
      // "Hard-coded configuration" - filtered as code quality issue
      expect(filtered).toHaveLength(0);
      expect(stats.filtered).toBe(2);
    });

    test('filters findings about files added without visible tests', () => {
      const findings: Finding[] = [
        {
          file: 'src/analysis/context/validation-detector.ts',
          line: 1,
          severity: 'major',
          title: 'ValidationDetector added without visible tests',
          message: 'New file lacks accompanying tests in diff',
        },
      ];

      const { findings: filtered, stats: _stats } = filter.filter(findings, '');

      expect(filtered).toHaveLength(0);
      expect(stats.filtered).toBe(1);
      // Reason key may vary (either 'complaint about file added in diff' or other filters)
      expect(Object.keys(stats.reasons).length).toBeGreaterThan(0);
    });

    test('filters findings with line 0 or negative line numbers', () => {
      const findings: Finding[] = [
        {
          file: 'src/app.ts',
          line: 0,
          severity: 'critical',
          title: 'Invalid finding',
          message: 'Finding with line 0',
        },
        {
          file: 'src/utils.ts',
          line: -1,
          severity: 'major',
          title: 'Invalid finding',
          message: 'Finding with negative line',
        },
      ];

      const { findings: filtered, stats: _stats } = filter.filter(findings, '');

      expect(filtered).toHaveLength(0);
      expect(stats.filtered).toBe(2);
      expect(stats.reasons['invalid/suspicious line number']).toBe(2);
    });

    test('filters or downgrades suspicious line:1 findings on config/workflow/test files', () => {
      const findings: Finding[] = [
        {
          file: '.github/workflows/ci.yml',
          line: 1,
          severity: 'critical',
          title: 'Security issue',
          message: 'Workflow has security problem',
        },
        {
          file: 'package.json',
          line: 1,
          severity: 'major',
          title: 'Missing field',
          message: 'JSON file lacks field',
        },
        {
          file: 'src/app.test.ts',
          line: 1,
          severity: 'critical',
          title: 'Test issue',
          message: 'Test file has problem',
        },
      ];

      const { findings: filtered, stats: _stats } = filter.filter(findings, '');

      // Workflow and test files will be downgraded to minor (not filtered by line:1 alone)
      // JSON file should be filtered by line:1
      expect(filtered.length).toBeLessThanOrEqual(2);
      expect(stats.filtered).toBeGreaterThanOrEqual(1);
      // All remaining should be minor severity
      expect(filtered.every(f => f.severity === 'minor')).toBe(true);
    });

    test('keeps valid line:1 findings on source files', () => {
      const diff = `diff --git a/src/index.ts b/src/index.ts
@@ -1,3 +1,4 @@
+const query = "SELECT * FROM users WHERE id = " + userId; // SQL injection here
 import { foo } from './foo';
 import { bar } from './bar';`;

      const findings: Finding[] = [
        {
          file: 'src/index.ts',
          line: 1,
          severity: 'critical',
          title: 'SQL Injection',
          message: 'Direct SQL concatenation on first import line',
        },
      ];

      const { findings: filtered } = filter.filter(findings, diff);

      // Should keep security issue on source file line 1
      expect(filtered).toHaveLength(1);
      expect(filtered[0].line).toBe(1);
    });

    test('filters generic findings with line:1 that mention "entire file" or "class lacks"', () => {
      const findings: Finding[] = [
        {
          file: 'src/utils.ts',
          line: 1,
          severity: 'major',
          title: 'Class lacks validation',
          message: 'The entire file needs error handling',
        },
      ];

      const { findings: filtered, stats: _stats } = filter.filter(findings, '');

      expect(filtered).toHaveLength(0);
      expect(stats.filtered).toBe(1);
      // Could be filtered as "invalid line number" or "code quality" (lacks validation)
      expect(Object.keys(stats.reasons).length).toBeGreaterThan(0);
    });

    test('filters subjective code structure opinions', () => {
      const findings: Finding[] = [
        {
          file: 'src/utils.ts',
          line: 10,
          severity: 'major',
          title: 'Complexity and Readability',
          message: 'The method is complex and difficult to read. Consider breaking it down.',
        },
        {
          file: 'src/app.ts',
          line: 20,
          severity: 'major',
          title: 'Code structure',
          message: 'Should be split into smaller functions and use constants for magic strings',
        },
      ];

      const { findings: filtered, stats: _stats } = filter.filter(findings, '');

      expect(filtered).toHaveLength(0);
      expect(stats.filtered).toBe(2);
      // These findings contain "Consider" and "Should be", so they match suggestion filter first
      expect(stats.reasons['suggestion/optimization (not a bug)']).toBe(2);
    });

    test('downgrades code quality issues from critical/major to minor', () => {
      const findings: Finding[] = [
        {
          file: 'src/filter.ts',
          line: 1,
          severity: 'critical',
          title: 'Missing input validation for finding properties',
          message: 'Class assumes all findings have required properties',
        },
        {
          file: 'src/filter.ts',
          line: 123,
          severity: 'critical',
          title: 'Inconsistent Error Handling',
          message: 'Error handling is inconsistent throughout the class',
        },
        {
          file: 'src/graph.ts',
          line: 56,
          severity: 'major',
          title: 'Performance Issue',
          message: 'Potential performance issue due to array filtering',
        },
      ];

      const { findings: filtered, stats: _stats } = filter.filter(findings, '');

      // All three are now filtered as suggestions:
      // - "Missing validation" - missing + validation
      // - "Inconsistent Error Handling" - inconsistent
      // - "Potential performance" - potential + performance
      expect(filtered).toHaveLength(0);
      expect(stats.filtered).toBe(3);
    });

    test('filters additional workflow configuration issues', () => {
      const findings: Finding[] = [
        {
          file: '.github/workflows/ci.yml',
          line: 15,
          severity: 'major',
          title: 'Concurrency Issue',
          message: 'The concurrency group name is not properly formatted',
        },
        {
          file: '.github/workflows/deploy.yml',
          line: 132,
          severity: 'major',
          title: 'Incorrect fork PR detection logic',
          message: 'Conditional logic will fail for push events',
        },
      ];

      const { findings: filtered, stats: _stats } = filter.filter(findings, '');

      expect(filtered).toHaveLength(0);
      expect(stats.filtered).toBe(2);
      expect(stats.reasons['workflow/CI configuration (not application code)']).toBe(2);
    });

    test('filters or downgrades insecure pattern validation complaints', () => {
      const findings: Finding[] = [
        {
          file: 'src/analysis/path-matcher.ts',
          line: 1,
          severity: 'major',
          title: 'Insecure pattern validation',
          message: 'PathMatcher class does not properly validate patterns',
        },
        {
          file: '__tests__/unit/analysis/path-matcher.test.ts',
          line: 1,
          severity: 'major',
          title: 'Insecure pattern validation',
          message: 'PathMatcher class does not properly validate patterns',
        },
      ];

      const { findings: filtered, stats: _stats } = filter.filter(findings, '');

      // Test file is completely filtered (new behavior)
      // Source file "does not properly validate" matches code quality patterns, also filtered
      expect(filtered).toHaveLength(0);
      expect(stats.filtered).toBe(2);
    });

    test('filters all fork PR security false positives', () => {
      const findings: Finding[] = [
        {
          file: '.github/workflows/ci.yml',
          line: 4,
          severity: 'critical',
          title: 'Fork PR Security Risk',
          message: 'Workflow relies on repository setting being disabled',
        },
        {
          file: '.github/workflows/ci.yml',
          line: 38,
          severity: 'critical',
          title: 'Security gating: Fork PRs may access secrets',
          message: 'Complex logic may not cover all cases',
        },
      ];

      const { findings: filtered, stats: _stats } = filter.filter(findings, '');

      expect(filtered).toHaveLength(0);
      expect(stats.filtered).toBe(2);
      expect(stats.reasons['workflow/CI configuration (not application code)']).toBe(2);
    });

    test('filters or downgrades path normalization suggestions', () => {
      const findings: Finding[] = [
        {
          file: 'src/analysis/trivial-detector.ts',
          line: 175,
          severity: 'critical',
          title: 'Path Normalization Consistency',
          message: 'Should be applied consistently throughout the class',
        },
      ];

      const { findings: filtered, stats: _stats } = filter.filter(findings, '');

      // Can be filtered as suggestion ("should be") or downgraded as code quality
      expect(filtered.length).toBeLessThanOrEqual(1);
      if (filtered.length === 1) {
        expect(filtered[0].severity).toBe('minor');
      }
    });

    test('filters implementation detail suggestions with monitor/adjust', () => {
      const findings: Finding[] = [
        {
          file: 'src/github/client.ts',
          line: 30,
          severity: 'major',
          title: 'Rate Limit Handling',
          message: 'Monitor rate limit status and adjust backoff strategy',
        },
        {
          file: 'src/core/batch-orchestrator.ts',
          line: 108,
          severity: 'major',
          title: 'Token-Aware Batching',
          message: 'Monitor performance and adjust target tokens',
        },
        {
          file: 'src/providers/openrouter-models.ts',
          line: 34,
          severity: 'major',
          title: 'Model Ranking and Selection',
          message: 'Monitor model selection and adjust algorithm',
        },
      ];

      const { findings: filtered, stats: _stats } = filter.filter(findings, '');

      // All should be filtered as suggestions (they say "Monitor" and "adjust")
      expect(filtered).toHaveLength(0);
      expect(stats.filtered).toBe(3);
      expect(stats.reasons['suggestion/optimization (not a bug)']).toBe(3);
    });

    test('filters test isolation findings', () => {
      const findings: Finding[] = [
        {
          file: '__tests__/unit/cache/graph-cache.test.ts',
          line: 10,
          severity: 'major',
          title: 'Test isolation: shared mocks across tests',
          message: 'Tests reuse mocked storage without resets',
        },
        {
          file: '__tests__/unit/analysis/finding-filter.test.ts',
          line: 73,
          severity: 'major',
          title: 'Hard-coded/stat-key brittleness in test expectations',
          message: 'Tests rely on specific string keys',
        },
      ];

      const { findings: filtered, stats: _stats } = filter.filter(findings, '');

      expect(filtered).toHaveLength(0);
      expect(stats.filtered).toBe(2);
      expect(stats.reasons['test code quality (not production issue)']).toBe(2);
    });
  });
});
