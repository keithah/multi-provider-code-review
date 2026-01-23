import { TerminalFormatter } from '../../../src/cli/formatter';
import { Review, Finding } from '../../../src/types';

describe('TerminalFormatter', () => {
  let formatter: TerminalFormatter;

  beforeEach(() => {
    formatter = new TerminalFormatter();
    // Disable colors for testing
    process.stdout.isTTY = false;
  });

  describe('format', () => {
    it('formats review with no findings', () => {
      const review: Review = {
        summary: 'All good',
        findings: [],
        inlineComments: [],
        actionItems: [],
        metrics: {
          totalFindings: 0,
          critical: 0,
          major: 0,
          minor: 0,
          providersUsed: 3,
          providersSuccess: 3,
          providersFailed: 0,
          totalTokens: 1000,
          totalCost: 0.01,
          durationSeconds: 5,
        },
      };

      const output = formatter.format(review);

      expect(output).toContain('Multi-Provider Code Review');
      expect(output).toContain('No issues found!');
      expect(output).toContain('Duration:');
      expect(output).toContain('5.00s');
      expect(output).toContain('Cost:');
      expect(output).toContain('$0.0100');
    });

    it('formats review with critical findings', () => {
      const findings: Finding[] = [
        {
          file: 'src/app.ts',
          line: 10,
          severity: 'critical',
          title: 'SQL Injection',
          message: 'Vulnerable to SQL injection',
          suggestion: 'Use parameterized queries',
        },
      ];

      const review: Review = {
        summary: 'Found issues',
        findings,
        inlineComments: [],
        actionItems: [],
        metrics: {
          totalFindings: 1,
          critical: 1,
          major: 0,
          minor: 0,
          providersUsed: 3,
          providersSuccess: 3,
          providersFailed: 0,
          totalTokens: 1000,
          totalCost: 0.01,
          durationSeconds: 5,
        },
      };

      const output = formatter.format(review);

      expect(output).toContain('Critical Issues:');
      expect(output).toContain('SQL Injection');
      expect(output).toContain('src/app.ts:10');
      expect(output).toContain('Vulnerable to SQL injection');
      expect(output).toContain('Use parameterized queries');
    });

    it('formats review with mixed severity findings', () => {
      const findings: Finding[] = [
        {
          file: 'src/app.ts',
          line: 10,
          severity: 'critical',
          title: 'SQL Injection',
          message: 'Critical issue',
        },
        {
          file: 'src/util.ts',
          line: 20,
          severity: 'major',
          title: 'Error Handling',
          message: 'Major issue',
        },
        {
          file: 'src/helper.ts',
          line: 30,
          severity: 'minor',
          title: 'Code Style',
          message: 'Minor issue',
        },
      ];

      const review: Review = {
        summary: 'Mixed issues',
        findings,
        inlineComments: [],
        actionItems: [],
        metrics: {
          totalFindings: 3,
          critical: 1,
          major: 1,
          minor: 1,
          providersUsed: 3,
          providersSuccess: 3,
          providersFailed: 0,
          totalTokens: 1000,
          totalCost: 0.01,
          durationSeconds: 5,
        },
      };

      const output = formatter.format(review);

      expect(output).toContain('Critical Issues:');
      expect(output).toContain('Major Issues:');
      expect(output).toContain('Minor Issues:');
      expect(output).toContain('SQL Injection');
      expect(output).toContain('Error Handling');
      expect(output).toContain('Code Style');
    });
  });

  describe('formatMessage', () => {
    it('formats error message', () => {
      const msg = formatter.formatMessage('Error occurred', 'error');
      expect(msg).toContain('Error occurred');
    });

    it('formats warning message', () => {
      const msg = formatter.formatMessage('Warning message', 'warning');
      expect(msg).toContain('Warning message');
    });

    it('formats success message', () => {
      const msg = formatter.formatMessage('Success', 'success');
      expect(msg).toContain('Success');
    });

    it('formats info message', () => {
      const msg = formatter.formatMessage('Info', 'info');
      expect(msg).toContain('Info');
    });
  });

  describe('getExitCode', () => {
    it('returns 0 for no findings', () => {
      const review: Review = {
        summary: 'All good',
        findings: [],
        inlineComments: [],
        actionItems: [],
        metrics: {
          totalFindings: 0,
          critical: 0,
          major: 0,
          minor: 0,
          providersUsed: 3,
          providersSuccess: 3,
          providersFailed: 0,
          totalTokens: 1000,
          totalCost: 0.01,
          durationSeconds: 5,
        },
      };

      expect(formatter.getExitCode(review)).toBe(0);
    });

    it('returns 0 for only minor findings', () => {
      const review: Review = {
        summary: 'Minor issues',
        findings: [
          {
            file: 'test.ts',
            line: 1,
            severity: 'minor',
            title: 'Style',
            message: 'Minor',
          },
        ],
        inlineComments: [],
        actionItems: [],
        metrics: {
          totalFindings: 1,
          critical: 0,
          major: 0,
          minor: 1,
          providersUsed: 3,
          providersSuccess: 3,
          providersFailed: 0,
          totalTokens: 1000,
          totalCost: 0.01,
          durationSeconds: 5,
        },
      };

      expect(formatter.getExitCode(review)).toBe(0);
    });

    it('returns 1 for major findings', () => {
      const review: Review = {
        summary: 'Major issues',
        findings: [],
        inlineComments: [],
        actionItems: [],
        metrics: {
          totalFindings: 1,
          critical: 0,
          major: 1,
          minor: 0,
          providersUsed: 3,
          providersSuccess: 3,
          providersFailed: 0,
          totalTokens: 1000,
          totalCost: 0.01,
          durationSeconds: 5,
        },
      };

      expect(formatter.getExitCode(review)).toBe(1);
    });

    it('returns 2 for critical findings', () => {
      const review: Review = {
        summary: 'Critical issues',
        findings: [],
        inlineComments: [],
        actionItems: [],
        metrics: {
          totalFindings: 1,
          critical: 1,
          major: 0,
          minor: 0,
          providersUsed: 3,
          providersSuccess: 3,
          providersFailed: 0,
          totalTokens: 1000,
          totalCost: 0.01,
          durationSeconds: 5,
        },
      };

      expect(formatter.getExitCode(review)).toBe(2);
    });
  });
});
