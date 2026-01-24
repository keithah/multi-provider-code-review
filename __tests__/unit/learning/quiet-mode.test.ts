import { QuietModeFilter } from '../../../src/learning/quiet-mode';
import { Finding } from '../../../src/types';

describe('QuietModeFilter', () => {
  let filter: QuietModeFilter;

  beforeEach(() => {
    filter = new QuietModeFilter(0.7);
  });

  it('should filter findings below confidence threshold', () => {
    const findings: Finding[] = [
      { file: 'a.ts', line: 1, severity: 'major', title: 'High conf', message: 'Test', evidence: { confidence: 0.9, reasoning: '', badge: '' } },
      { file: 'b.ts', line: 2, severity: 'major', title: 'Low conf', message: 'Test', evidence: { confidence: 0.3, reasoning: '', badge: '' } },
    ];

    const filtered = filter.filterByConfidence(findings, 0.7);

    expect(filtered).toHaveLength(1);
    expect(filtered[0].title).toBe('High conf');
  });

  it('should keep all findings when confidence threshold is zero', () => {
    const findings: Finding[] = [
      { file: 'a.ts', line: 1, severity: 'major', title: 'Test', message: 'Test' },
    ];

    const filtered = filter.filterByConfidence(findings, 0);

    expect(filtered).toHaveLength(1);
  });
});
