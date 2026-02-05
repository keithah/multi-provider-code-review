import { extractFindings } from '../../../../src/analysis/llm/parser';
import { ProviderResult } from '../../../../src/types';
import { MarkdownFormatter } from '../../../../src/output/formatter';

describe('extractFindings', () => {
  const createProviderResult = (findings: any[]): ProviderResult => ({
    name: 'test-provider',
    status: 'success',
    result: { content: '', findings },
    durationSeconds: 1,
  });

  it('extracts valid suggestion from finding', () => {
    const results = [createProviderResult([{
      file: 'test.ts',
      line: 10,
      severity: 'major',
      title: 'Bug',
      message: 'Issue',
      suggestion: 'const x = 1;',
    }])];

    const findings = extractFindings(results);

    expect(findings).toHaveLength(1);
    expect(findings[0].suggestion).toBe('const x = 1;');
  });

  it('filters out invalid suggestion (no code syntax)', () => {
    const results = [createProviderResult([{
      file: 'test.ts',
      line: 10,
      severity: 'major',
      title: 'Bug',
      message: 'Issue',
      suggestion: 'You should fix this issue',
    }])];

    const findings = extractFindings(results);

    expect(findings).toHaveLength(1);
    expect(findings[0].suggestion).toBeUndefined();
  });

  it('preserves finding without suggestion', () => {
    const results = [createProviderResult([{
      file: 'test.ts',
      line: 10,
      severity: 'major',
      title: 'Bug',
      message: 'Issue',
    }])];

    const findings = extractFindings(results);

    expect(findings).toHaveLength(1);
    expect(findings[0].suggestion).toBeUndefined();
    expect(findings[0].file).toBe('test.ts');
  });

  it('trims valid suggestion', () => {
    const results = [createProviderResult([{
      file: 'test.ts',
      line: 10,
      severity: 'major',
      title: 'Bug',
      message: 'Issue',
      suggestion: '  const x = 1;  ',
    }])];

    const findings = extractFindings(results);

    expect(findings[0].suggestion).toBe('const x = 1;');
  });

  it('handles empty suggestion string', () => {
    const results = [createProviderResult([{
      file: 'test.ts',
      line: 10,
      severity: 'major',
      title: 'Bug',
      message: 'Issue',
      suggestion: '',
    }])];

    const findings = extractFindings(results);

    expect(findings[0].suggestion).toBeUndefined();
  });
});

describe('Graceful degradation integration', () => {
  it('formatter handles finding with undefined suggestion (does not crash, posts finding)', () => {
    // Simulate a finding that passed through parser with invalid/no suggestion
    const findingWithoutSuggestion = {
      file: 'test.ts',
      line: 10,
      severity: 'major' as const,
      title: 'Potential null reference',
      message: 'Variable may be null here',
      suggestion: undefined, // Invalid/missing suggestion filtered out
      provider: 'test-provider',
      providers: ['test-provider'],
    };

    const review = {
      summary: 'Test review',
      findings: [findingWithoutSuggestion],
      inlineComments: [],
      actionItems: [],
      metrics: {
        totalFindings: 1,
        critical: 0,
        major: 1,
        minor: 0,
        durationSeconds: 1,
        totalCost: 0,
        totalTokens: 0,
        providersUsed: 1,
        providersSuccess: 1,
        providersFailed: 0,
      },
    };

    const formatter = new MarkdownFormatter();
    const output = formatter.format(review);

    // Finding should still be in output (graceful degradation: finding posted without suggestion)
    expect(output).toContain('test.ts:10');
    expect(output).toContain('Potential null reference');
    expect(output).toContain('Variable may be null here');
    // Should NOT contain suggestion block
    expect(output).not.toContain('```suggestion');
    expect(output).not.toContain('Suggested fix:');
  });

  it('formatter handles finding with valid suggestion', () => {
    const findingWithSuggestion = {
      file: 'test.ts',
      line: 10,
      severity: 'major' as const,
      title: 'Use const',
      message: 'Prefer const over let',
      suggestion: 'const x = 1;',
      provider: 'test-provider',
      providers: ['test-provider'],
    };

    const review = {
      summary: 'Test review',
      findings: [findingWithSuggestion],
      inlineComments: [],
      actionItems: [],
      metrics: {
        totalFindings: 1,
        critical: 0,
        major: 1,
        minor: 0,
        durationSeconds: 1,
        totalCost: 0,
        totalTokens: 0,
        providersUsed: 1,
        providersSuccess: 1,
        providersFailed: 0,
      },
    };

    const formatter = new MarkdownFormatter();
    const output = formatter.format(review);

    // Finding should have suggestion block
    expect(output).toContain('test.ts:10');
    expect(output).toContain('Use const');
    expect(output).toContain('```suggestion');
    expect(output).toContain('const x = 1;');
  });
});
