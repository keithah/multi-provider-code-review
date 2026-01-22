import { EvidenceScorer } from '../../src/analysis/evidence';
import { Finding } from '../../src/types';

describe('EvidenceScorer', () => {
  const baseFinding: Finding = {
    file: 'src/index.ts',
    line: 10,
    severity: 'major',
    title: 'Test',
    message: 'Test message',
    providers: ['p1', 'p2'],
  };

  it('scores high confidence with multiple signals', () => {
    const scorer = new EvidenceScorer();

    const result = scorer.score(baseFinding, 3, true, true, true);

    expect(result.confidence).toBeGreaterThanOrEqual(0.8);
    expect(result.badge).toContain('High Confidence');
    expect(result.reasoning).toContain('provider agreement');
  });

  it('degrades confidence when signals are missing', () => {
    const scorer = new EvidenceScorer();

    const result = scorer.score(baseFinding, 3, false, false, false);

    expect(result.confidence).toBeLessThan(0.7);
    expect(result.badge).toContain('Low');
  });
});
