import { Finding, SARIFReport, SARIFResult, SARIFRule } from '../types';

export function buildSarif(findings: Finding[]): SARIFReport {
  const rules: SARIFRule[] = findings.map((f, idx) => ({
    id: `RULE-${idx + 1}`,
    shortDescription: { text: f.title },
    fullDescription: { text: f.message },
    defaultConfiguration: { level: severityToLevel(f.severity) },
  }));

  const results: SARIFResult[] = findings.map((f, idx) => ({
    ruleId: `RULE-${idx + 1}`,
    level: severityToLevel(f.severity),
    message: { text: f.message },
    locations: [
      {
        physicalLocation: {
          artifactLocation: { uri: f.file },
          region: { startLine: f.line },
        },
      },
    ],
  }));

  return {
    version: '2.1.0',
    $schema: 'http://json.schemastore.org/sarif-2.1.0.json',
    runs: [
      {
        tool: {
          driver: {
            name: 'multi-provider-code-review',
            version: '2.0.0',
            informationUri: 'https://github.com/keithah/multi-provider-code-review',
            rules,
          },
        },
        results,
      },
    ],
  };
}

function severityToLevel(severity: Finding['severity']): 'error' | 'warning' | 'note' {
  if (severity === 'critical') return 'error';
  if (severity === 'major') return 'warning';
  return 'note';
}
