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

  describe('checkSuggestionConsensus', () => {
    it('should detect AST-equivalent suggestions', () => {
      const engine = new ConsensusEngine({ minAgreement: 2, minSeverity: 'minor', maxComments: 50 });
      const suggestions = [
        { provider: 'claude', suggestion: 'x + 1', file: 'test.ts' },
        { provider: 'gemini', suggestion: 'x+1', file: 'test.ts' },  // Same AST, different whitespace
      ];
      const result = engine.checkSuggestionConsensus(suggestions, 2);
      expect(result.hasSuggestionConsensus).toBe(true);
      expect(result.agreementCount).toBe(2);
    });

    it('should detect non-equivalent suggestions', () => {
      const engine = new ConsensusEngine({ minAgreement: 2, minSeverity: 'minor', maxComments: 50 });
      const suggestions = [
        { provider: 'claude', suggestion: 'x + 1', file: 'test.ts' },
        { provider: 'gemini', suggestion: 'x - 1', file: 'test.ts' },  // Different AST
      ];
      const result = engine.checkSuggestionConsensus(suggestions, 2);
      expect(result.hasSuggestionConsensus).toBe(false);
      expect(result.agreementCount).toBe(1);
    });

    it('should fall back to string comparison for unknown language', () => {
      const engine = new ConsensusEngine({ minAgreement: 2, minSeverity: 'minor', maxComments: 50 });
      const suggestions = [
        { provider: 'claude', suggestion: 'foo bar', file: 'test.xyz' },
        { provider: 'gemini', suggestion: 'foo bar', file: 'test.xyz' },
      ];
      const result = engine.checkSuggestionConsensus(suggestions, 2);
      expect(result.hasSuggestionConsensus).toBe(true);
    });

    it('should require minimum agreement count', () => {
      const engine = new ConsensusEngine({ minAgreement: 2, minSeverity: 'minor', maxComments: 50 });
      const suggestions = [
        { provider: 'claude', suggestion: 'x + 1', file: 'test.ts' },
      ];
      const result = engine.checkSuggestionConsensus(suggestions, 2);
      expect(result.hasSuggestionConsensus).toBe(false);
    });
  });

  describe('filter with hasConsensus', () => {
    it('should set hasConsensus when providers agree on suggestion', () => {
      const engine = new ConsensusEngine({ minAgreement: 2, minSeverity: 'minor', maxComments: 50 });
      const findings: Finding[] = [
        { file: 'test.ts', line: 10, title: 'Issue', message: 'Fix it', severity: 'minor', provider: 'claude', suggestion: 'x + 1' },
        { file: 'test.ts', line: 10, title: 'Issue', message: 'Fix it', severity: 'minor', provider: 'gemini', suggestion: 'x+1' },
      ];
      const result = engine.filter(findings);
      expect(result.length).toBe(1);
      expect(result[0].hasConsensus).toBe(true);
    });

    it('should not set hasConsensus when providers disagree', () => {
      const engine = new ConsensusEngine({ minAgreement: 2, minSeverity: 'minor', maxComments: 50 });
      const findings: Finding[] = [
        { file: 'test.ts', line: 10, title: 'Issue', message: 'Fix it', severity: 'minor', provider: 'claude', suggestion: 'x + 1' },
        { file: 'test.ts', line: 10, title: 'Issue', message: 'Fix it', severity: 'minor', provider: 'gemini', suggestion: 'x - 1' },
      ];
      const result = engine.filter(findings);
      expect(result.length).toBe(1);
      expect(result[0].hasConsensus).toBe(false);
    });

    it('should not set hasConsensus for single-provider findings', () => {
      const engine = new ConsensusEngine({ minAgreement: 2, minSeverity: 'minor', maxComments: 50 });
      const findings: Finding[] = [
        { file: 'test.ts', line: 10, title: 'Issue', message: 'Fix it', severity: 'minor', provider: 'claude', suggestion: 'x + 1' },
      ];
      const result = engine.filter(findings);
      expect(result.length).toBe(1);
      expect(result[0].hasConsensus).toBeUndefined();
    });
  });
});
