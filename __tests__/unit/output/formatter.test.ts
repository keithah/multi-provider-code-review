import { MarkdownFormatter } from '../../../src/output/formatter';
import { Review, Finding } from '../../../src/types';

describe('MarkdownFormatter', () => {
  let formatter: MarkdownFormatter;

  beforeEach(() => {
    formatter = new MarkdownFormatter();
  });

  const createMinimalReview = (): Review => ({
    summary: 'Test summary',
    findings: [],
    inlineComments: [],
    actionItems: [],
    metrics: {
      totalFindings: 0,
      critical: 0,
      major: 0,
      minor: 0,
      providersUsed: 1,
      providersSuccess: 1,
      providersFailed: 0,
      totalTokens: 100,
      totalCost: 0.001,
      durationSeconds: 1.5,
    },
  });

  const createFinding = (severity: 'critical' | 'major' | 'minor', overrides?: Partial<Finding>): Finding => ({
    file: 'src/test.ts',
    line: 10,
    severity,
    title: `${severity} issue`,
    message: `This is a ${severity} issue`,
    ...overrides,
  });

  describe('Basic Formatting', () => {
    it('formats minimal review with no findings', () => {
      const review = createMinimalReview();
      const output = formatter.format(review);

      expect(output).toContain('## Multi Provider Review Summary');
      expect(output).toContain('Test summary');
      expect(output).toContain('Duration: 1.5s');
      expect(output).toContain('Cost: $0.0010');
      expect(output).toContain('Tokens: 100');
    });

    it('formats review with critical findings', () => {
      const review = createMinimalReview();
      review.findings = [createFinding('critical')];
      review.metrics.critical = 1;
      review.metrics.totalFindings = 1;

      const output = formatter.format(review);

      expect(output).toContain('### Critical');
      expect(output).toContain('src/test.ts:10');
      expect(output).toContain('critical issue');
      expect(output).toContain('This is a critical issue');
    });

    it('formats review with major findings', () => {
      const review = createMinimalReview();
      review.findings = [createFinding('major')];
      review.metrics.major = 1;
      review.metrics.totalFindings = 1;

      const output = formatter.format(review);

      expect(output).toContain('### Major');
      expect(output).toContain('major issue');
    });

    it('formats review with minor findings', () => {
      const review = createMinimalReview();
      review.findings = [createFinding('minor')];
      review.metrics.minor = 1;
      review.metrics.totalFindings = 1;

      const output = formatter.format(review);

      expect(output).toContain('### Minor');
      expect(output).toContain('minor issue');
    });

    it('formats review with mixed severity findings', () => {
      const review = createMinimalReview();
      review.findings = [
        createFinding('critical'),
        createFinding('major'),
        createFinding('minor'),
      ];
      review.metrics.critical = 1;
      review.metrics.major = 1;
      review.metrics.minor = 1;
      review.metrics.totalFindings = 3;

      const output = formatter.format(review);

      expect(output).toContain('### Critical');
      expect(output).toContain('### Major');
      expect(output).toContain('### Minor');
    });
  });

  describe('Finding Details', () => {
    it('includes suggestion when present', () => {
      const review = createMinimalReview();
      review.findings = [
        createFinding('major', { suggestion: 'Use const instead of let' }),
      ];

      const output = formatter.format(review);

      expect(output).toContain('Suggestion: Use const instead of let');
    });

    it('includes evidence when present', () => {
      const review = createMinimalReview();
      review.findings = [
        createFinding('major', {
          evidence: {
            badge: 'High Confidence',
            confidence: 0.95,
            reasoning: 'Multiple providers agree',
          },
        }),
      ];

      const output = formatter.format(review);

      expect(output).toContain('Evidence: High Confidence (95%)');
      expect(output).toContain('Multiple providers agree');
    });

    it('handles evidence with empty reasoning', () => {
      const review = createMinimalReview();
      review.findings = [
        createFinding('major', {
          evidence: {
            badge: 'Medium Confidence',
            confidence: 0.7,
            reasoning: '',
          },
        }),
      ];

      const output = formatter.format(review);

      expect(output).toContain('Evidence: Medium Confidence (70%)');
      // Check that the evidence line doesn't have reasoning
      const evidenceLine = output.split('\n').find(line => line.includes('Evidence:'));
      expect(evidenceLine).not.toContain(' — ');
    });
  });

  describe('Action Items', () => {
    it('includes action items in collapsible section', () => {
      const review = createMinimalReview();
      review.actionItems = ['Fix security issue', 'Update dependencies'];

      const output = formatter.format(review);

      expect(output).toContain('<details><summary>Action Items</summary>');
      expect(output).toContain('- Fix security issue');
      expect(output).toContain('- Update dependencies');
      expect(output).toContain('</details>');
    });

    it('deduplicates action items', () => {
      const review = createMinimalReview();
      review.actionItems = ['Fix bug', 'Fix bug', 'Add tests'];

      const output = formatter.format(review);

      const matches = output.match(/- Fix bug/g);
      expect(matches).toHaveLength(1);
      expect(output).toContain('- Add tests');
    });

    it('omits action items section when empty', () => {
      const review = createMinimalReview();
      review.actionItems = [];

      const output = formatter.format(review);

      expect(output).not.toContain('Action Items');
    });
  });

  describe('Test Hints', () => {
    it('includes test hints in collapsible section', () => {
      const review = createMinimalReview();
      review.testHints = [
        {
          file: 'src/utils.ts',
          suggestedTestFile: '__tests__/utils.test.ts',
          testPattern: 'unit',
        },
      ];

      const output = formatter.format(review);

      expect(output).toContain('<details><summary>Test Coverage</summary>');
      expect(output).toContain('1 areas need tests');
      expect(output).toContain('src/utils.ts → add __tests__/utils.test.ts (unit)');
    });

    it('counts multiple test hints', () => {
      const review = createMinimalReview();
      review.testHints = [
        { file: 'src/a.ts', suggestedTestFile: '__tests__/a.test.ts', testPattern: 'unit' },
        { file: 'src/b.ts', suggestedTestFile: '__tests__/b.test.ts', testPattern: 'unit' },
      ];

      const output = formatter.format(review);

      expect(output).toContain('2 areas need tests');
    });

    it('omits test hints section when empty', () => {
      const review = createMinimalReview();
      review.testHints = [];

      const output = formatter.format(review);

      expect(output).not.toContain('Test Coverage');
    });
  });

  describe('Impact Analysis', () => {
    it('includes impact analysis when present', () => {
      const review = createMinimalReview();
      review.impactAnalysis = {
        file: 'src/auth.ts',
        totalAffected: 5,
        callers: [],
        consumers: [],
        derived: [],
        impactLevel: 'high',
        summary: 'Changes affect critical authentication flow',
      };

      const output = formatter.format(review);

      expect(output).toContain('### Impact');
      expect(output).toContain('Level: high');
      expect(output).toContain('Changes affect critical authentication flow');
    });
  });

  describe('Mermaid Diagram', () => {
    it('includes mermaid diagram in collapsible section', () => {
      const review = createMinimalReview();
      review.mermaidDiagram = 'graph TD\n  A-->B';

      const output = formatter.format(review);

      expect(output).toContain('<details><summary>Impact graph</summary>');
      expect(output).toContain('```mermaid');
      expect(output).toContain('graph TD\n  A-->B');
      expect(output).toContain('```');
    });

    it('omits mermaid section when empty', () => {
      const review = createMinimalReview();
      review.mermaidDiagram = '';

      const output = formatter.format(review);

      expect(output).not.toContain('Impact graph');
    });

    it('omits mermaid section when whitespace only', () => {
      const review = createMinimalReview();
      review.mermaidDiagram = '   \n  ';

      const output = formatter.format(review);

      expect(output).not.toContain('Impact graph');
    });
  });

  describe('Run Details', () => {
    it('includes provider run details', () => {
      const review = createMinimalReview();
      review.runDetails = {
        providers: [
          {
            name: 'provider-1',
            status: 'success',
            durationSeconds: 1.2,
            cost: 0.001,
            tokens: 50,
          },
        ],
        totalCost: 0.001,
        totalTokens: 50,
        durationSeconds: 1.5,
        cacheHit: false,
        synthesisModel: 'test-model',
        providerPoolSize: 1,
      };

      const output = formatter.format(review);

      expect(output).toContain('provider-1: success (1.2s, $0.0010, tokens 50)');
    });

    it('includes provider error messages', () => {
      const review = createMinimalReview();
      review.runDetails = {
        providers: [
          {
            name: 'provider-1',
            status: 'error',
            durationSeconds: 0.5,
            errorMessage: 'Rate limited',
          },
        ],
        totalCost: 0,
        totalTokens: 0,
        durationSeconds: 0.5,
        cacheHit: false,
        synthesisModel: 'test-model',
        providerPoolSize: 1,
      };

      const output = formatter.format(review);

      expect(output).toContain('provider-1: error (0.5s, error: Rate limited)');
    });

    it('shows timeout warning when providers timed out', () => {
      const review = createMinimalReview();
      review.runDetails = {
        providers: [
          {
            name: 'slow-provider',
            status: 'error',
            durationSeconds: 30,
            errorMessage: 'timed out after 30s',
          },
        ],
        totalCost: 0,
        totalTokens: 0,
        durationSeconds: 30,
        cacheHit: false,
        synthesisModel: 'test-model',
        providerPoolSize: 1,
      };

      const output = formatter.format(review);

      expect(output).toContain('1 provider(s) timed out');
      expect(output).toContain('This is expected for large PRs');
    });
  });

  describe('AI Analysis', () => {
    it('includes AI analysis when present', () => {
      const review = createMinimalReview();
      review.aiAnalysis = {
        averageLikelihood: 0.75,
        consensus: 'likely',
        providerEstimates: {},
      };

      const output = formatter.format(review);

      expect(output).toContain('<details><summary>AI Generated Code Likelihood</summary>');
      expect(output).toContain('Overall: 75.0% (likely)');
    });
  });

  describe('Provider Results', () => {
    it('includes raw provider outputs', () => {
      const review = createMinimalReview();
      review.providerResults = [
        {
          name: 'provider-1',
          status: 'success',
          result: {
            content: '{"findings": []}',
            durationSeconds: 1.0,
          },
          durationSeconds: 1.0,
        },
      ];

      const output = formatter.format(review);

      expect(output).toContain('<details><summary>Raw provider outputs</summary>');
      expect(output).toContain('provider-1 [success] (1.0s)');
      expect(output).toContain('{"findings": []}');
    });

    it('handles provider results without content', () => {
      const review = createMinimalReview();
      review.providerResults = [
        {
          name: 'provider-1',
          status: 'error',
          error: new Error('Failed'),
          durationSeconds: 0.5,
        },
      ];

      const output = formatter.format(review);

      expect(output).toContain('_no content_');
    });
  });
});
