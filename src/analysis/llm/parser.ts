import { Finding, ProviderResult } from '../../types';

export function extractFindings(results: ProviderResult[]): Finding[] {
  const findings: Finding[] = [];

  for (const result of results) {
    if (result.status !== 'success' || !result.result?.findings) continue;
    for (const finding of result.result.findings) {
      findings.push({
        ...finding,
        provider: result.name,
        providers: finding.providers || [result.name],
      });
    }
  }

  return findings;
}
