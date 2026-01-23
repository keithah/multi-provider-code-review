import { buildSarif } from '../../../src/output/sarif';
import { Finding } from '../../../src/types';

describe('buildSarif', () => {
  it('generates valid SARIF 2.1.0 format', () => {
    const findings: Finding[] = [
      {
        file: 'src/test.ts',
        line: 10,
        severity: 'critical',
        title: 'Security Issue',
        message: 'SQL injection vulnerability',
      },
    ];

    const sarif = buildSarif(findings);

    expect(sarif.version).toBe('2.1.0');
    expect(sarif.$schema).toBe('http://json.schemastore.org/sarif-2.1.0.json');
    expect(sarif.runs).toHaveLength(1);
  });

  it('includes tool metadata', () => {
    const findings: Finding[] = [];
    const sarif = buildSarif(findings);

    expect(sarif.runs[0].tool.driver.name).toBe('multi-provider-code-review');
    expect(sarif.runs[0].tool.driver.version).toBe('2.0.0');
    expect(sarif.runs[0].tool.driver.informationUri).toContain('github.com');
  });

  it('converts critical severity to error level', () => {
    const findings: Finding[] = [
      {
        file: 'src/test.ts',
        line: 10,
        severity: 'critical',
        title: 'Critical Issue',
        message: 'This is critical',
      },
    ];

    const sarif = buildSarif(findings);
    const result = sarif.runs[0].results[0];

    expect(result.level).toBe('error');
  });

  it('converts major severity to warning level', () => {
    const findings: Finding[] = [
      {
        file: 'src/test.ts',
        line: 10,
        severity: 'major',
        title: 'Major Issue',
        message: 'This is major',
      },
    ];

    const sarif = buildSarif(findings);
    const result = sarif.runs[0].results[0];

    expect(result.level).toBe('warning');
  });

  it('converts minor severity to note level', () => {
    const findings: Finding[] = [
      {
        file: 'src/test.ts',
        line: 10,
        severity: 'minor',
        title: 'Minor Issue',
        message: 'This is minor',
      },
    ];

    const sarif = buildSarif(findings);
    const result = sarif.runs[0].results[0];

    expect(result.level).toBe('note');
  });

  it('creates rule for each finding', () => {
    const findings: Finding[] = [
      {
        file: 'src/a.ts',
        line: 10,
        severity: 'major',
        title: 'Issue A',
        message: 'Message A',
      },
      {
        file: 'src/b.ts',
        line: 20,
        severity: 'minor',
        title: 'Issue B',
        message: 'Message B',
      },
    ];

    const sarif = buildSarif(findings);
    const rules = sarif.runs[0].tool.driver.rules;

    expect(rules).toHaveLength(2);
    expect(rules[0].id).toBe('RULE-1');
    expect(rules[0].shortDescription.text).toBe('Issue A');
    expect(rules[0].fullDescription.text).toBe('Message A');
    expect(rules[1].id).toBe('RULE-2');
    expect(rules[1].shortDescription.text).toBe('Issue B');
  });

  it('creates result for each finding with location', () => {
    const findings: Finding[] = [
      {
        file: 'src/utils.ts',
        line: 42,
        severity: 'major',
        title: 'Memory Leak',
        message: 'Potential memory leak detected',
      },
    ];

    const sarif = buildSarif(findings);
    const result = sarif.runs[0].results[0];

    expect(result.ruleId).toBe('RULE-1');
    expect(result.message.text).toBe('Potential memory leak detected');
    expect(result.locations).toHaveLength(1);
    expect(result.locations[0].physicalLocation.artifactLocation.uri).toBe('src/utils.ts');
    expect(result.locations[0].physicalLocation.region.startLine).toBe(42);
  });

  it('handles empty findings array', () => {
    const findings: Finding[] = [];
    const sarif = buildSarif(findings);

    expect(sarif.runs[0].tool.driver.rules).toEqual([]);
    expect(sarif.runs[0].results).toEqual([]);
  });

  it('handles multiple findings with mixed severities', () => {
    const findings: Finding[] = [
      {
        file: 'src/a.ts',
        line: 1,
        severity: 'critical',
        title: 'A',
        message: 'Critical issue',
      },
      {
        file: 'src/b.ts',
        line: 2,
        severity: 'major',
        title: 'B',
        message: 'Major issue',
      },
      {
        file: 'src/c.ts',
        line: 3,
        severity: 'minor',
        title: 'C',
        message: 'Minor issue',
      },
    ];

    const sarif = buildSarif(findings);

    expect(sarif.runs[0].results).toHaveLength(3);
    expect(sarif.runs[0].results[0].level).toBe('error');
    expect(sarif.runs[0].results[1].level).toBe('warning');
    expect(sarif.runs[0].results[2].level).toBe('note');
  });

  it('sets default configuration level in rules', () => {
    const findings: Finding[] = [
      {
        file: 'src/test.ts',
        line: 10,
        severity: 'critical',
        title: 'Issue',
        message: 'Message',
      },
    ];

    const sarif = buildSarif(findings);
    const rule = sarif.runs[0].tool.driver.rules[0];

    expect(rule.defaultConfiguration).toBeDefined();
    expect(rule.defaultConfiguration.level).toBe('error');
  });

  it('produces serializable SARIF output', () => {
    const findings: Finding[] = [
      {
        file: 'src/test.ts',
        line: 10,
        severity: 'major',
        title: 'Test',
        message: 'Test message',
      },
    ];

    const sarif = buildSarif(findings);

    // Should be able to stringify without errors
    expect(() => JSON.stringify(sarif)).not.toThrow();

    // Should be able to parse back
    const json = JSON.stringify(sarif);
    const parsed = JSON.parse(json);
    expect(parsed.version).toBe('2.1.0');
  });
});
