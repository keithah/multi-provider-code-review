import { buildJson } from '../../../src/output/json';
import { Review } from '../../../src/types';

describe('buildJson', () => {
  it('converts review to JSON string', () => {
    const review: Review = {
      summary: 'Test review',
      findings: [
        {
          file: 'src/test.ts',
          line: 10,
          severity: 'major',
          title: 'Issue',
          message: 'Test issue',
        },
      ],
      inlineComments: [],
      actionItems: ['Fix issue'],
      metrics: {
        totalFindings: 1,
        critical: 0,
        major: 1,
        minor: 0,
        providersUsed: 1,
        providersSuccess: 1,
        providersFailed: 0,
        totalTokens: 100,
        totalCost: 0.001,
        durationSeconds: 1.5,
      },
    };

    const json = buildJson(review);
    const parsed = JSON.parse(json);

    expect(parsed.summary).toBe('Test review');
    expect(parsed.findings).toHaveLength(1);
    expect(parsed.findings[0].file).toBe('src/test.ts');
    expect(parsed.actionItems).toEqual(['Fix issue']);
  });

  it('formats JSON with indentation', () => {
    const review: Review = {
      summary: 'Test',
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
        totalTokens: 0,
        totalCost: 0,
        durationSeconds: 0,
      },
    };

    const json = buildJson(review);

    // Check for indentation (2 spaces)
    expect(json).toContain('  "summary"');
    expect(json).toContain('  "findings"');
  });

  it('preserves all review fields', () => {
    const review: Review = {
      summary: 'Complete review',
      findings: [],
      inlineComments: [],
      actionItems: [],
      metrics: {
        totalFindings: 0,
        critical: 0,
        major: 0,
        minor: 0,
        providersUsed: 2,
        providersSuccess: 2,
        providersFailed: 0,
        totalTokens: 200,
        totalCost: 0.005,
        durationSeconds: 2.5,
      },
      testHints: [
        {
          file: 'src/util.ts',
          suggestedTestFile: '__tests__/util.test.ts',
          testPattern: 'unit',
        },
      ],
      aiAnalysis: {
        averageLikelihood: 0.8,
        consensus: 'likely',
        providerEstimates: {},
      },
      impactAnalysis: {
        file: 'src/app.ts',
        totalAffected: 3,
        callers: [],
        consumers: [],
        derived: [],
        impactLevel: 'medium',
        summary: 'Moderate impact',
      },
      mermaidDiagram: 'graph TD\n  A-->B',
    };

    const json = buildJson(review);
    const parsed = JSON.parse(json);

    expect(parsed.testHints).toBeDefined();
    expect(parsed.aiAnalysis).toBeDefined();
    expect(parsed.impactAnalysis).toBeDefined();
    expect(parsed.mermaidDiagram).toBeDefined();
  });

  it('handles empty review', () => {
    const review: Review = {
      summary: '',
      findings: [],
      inlineComments: [],
      actionItems: [],
      metrics: {
        totalFindings: 0,
        critical: 0,
        major: 0,
        minor: 0,
        providersUsed: 0,
        providersSuccess: 0,
        providersFailed: 0,
        totalTokens: 0,
        totalCost: 0,
        durationSeconds: 0,
      },
    };

    const json = buildJson(review);
    const parsed = JSON.parse(json);

    expect(parsed.summary).toBe('');
    expect(parsed.findings).toEqual([]);
    expect(parsed.actionItems).toEqual([]);
  });

  it('produces valid JSON', () => {
    const review: Review = {
      summary: 'Test with "quotes" and special chars: \n\t',
      findings: [],
      inlineComments: [],
      actionItems: [],
      metrics: {
        totalFindings: 0,
        critical: 0,
        major: 0,
        minor: 0,
        providersUsed: 0,
        providersSuccess: 0,
        providersFailed: 0,
        totalTokens: 0,
        totalCost: 0,
        durationSeconds: 0,
      },
    };

    const json = buildJson(review);

    // Should not throw
    expect(() => JSON.parse(json)).not.toThrow();
  });
});
