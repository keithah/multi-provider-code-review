import { extractFindings } from '../../../../src/analysis/llm/parser';
import { ProviderResult } from '../../../../src/types';

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
