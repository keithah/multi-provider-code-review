import { ConsensusEngine } from '../../src/analysis/consensus';
import { Finding } from '../../src/types';

describe('ConsensusEngine', () => {
  it('requires minimum agreement and severity', () => {
    const engine = new ConsensusEngine({
      minAgreement: 2,
      minSeverity: 'major',
      maxComments: 10,
    });

    const findings: Finding[] = [
      {
        file: 'file.ts',
        line: 10,
        severity: 'major',
        title: 'Issue A',
        message: 'Found by two providers',
        providers: ['p1', 'p2'],
      },
      {
        file: 'file.ts',
        line: 20,
        severity: 'minor',
        title: 'Issue B',
        message: 'Minor issue',
        providers: ['p1', 'p2', 'p3'],
      },
      {
        file: 'file.ts',
        line: 30,
        severity: 'major',
        title: 'Issue C',
        message: 'Only one provider',
        providers: ['p1'],
      },
    ];

    const result = engine.filter(findings);

    expect(result.map(f => f.title)).toEqual(expect.arrayContaining(['Issue A', 'Issue C']));
  });

  it('allows static findings even when agreement threshold is higher', () => {
    const engine = new ConsensusEngine({
      minAgreement: 2,
      minSeverity: 'minor',
      maxComments: 10,
    });

    const findings: Finding[] = [
      {
        file: 'a.ts',
        line: 5,
        severity: 'minor',
        title: 'Static issue',
        message: 'From AST/security',
        provider: 'ast',
      },
    ];

    const result = engine.filter(findings);
    expect(result).toHaveLength(1);
  });
});
