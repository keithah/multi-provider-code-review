import { QuietModeFilter } from '../../../src/learning/quiet-mode';
import { Finding } from '../../../src/types';

describe('QuietModeFilter', () => {
  let filter: QuietModeFilter;

  beforeEach(() => {
    filter = new QuietModeFilter({
      enabled: true,
      minConfidence: 0.7,
      useLearning: false,
    });
  });

  it('should filter findings below confidence threshold', async () => {
    const findings: Finding[] = [
      { file: 'a.ts', line: 1, severity: 'major', title: 'High conf', message: 'Test', confidence: 0.9 },
      { file: 'b.ts', line: 2, severity: 'major', title: 'Low conf', message: 'Test', confidence: 0.3 },
    ];

    const filtered = await filter.filterByConfidence(findings);

    expect(filtered).toHaveLength(1);
    expect(filtered[0].title).toBe('High conf');
  });

  it('should keep all findings when quiet mode is disabled', async () => {
    const disabledFilter = new QuietModeFilter({
      enabled: false,
      minConfidence: 0.7,
      useLearning: false,
    });

    const findings: Finding[] = [
      { file: 'a.ts', line: 1, severity: 'major', title: 'Test', message: 'Test', confidence: 0.3 },
    ];

    const filtered = await disabledFilter.filterByConfidence(findings);

    expect(filtered).toHaveLength(1);
  });
});
