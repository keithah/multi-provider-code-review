import { Finding, Severity } from '../types';

export interface ConsensusOptions {
  minAgreement: number;
  minSeverity: Severity;
  maxComments: number;
}

const SEVERITY_ORDER: Record<Severity, number> = {
  critical: 3,
  major: 2,
  minor: 1,
};

export class ConsensusEngine {
  constructor(private readonly options: ConsensusOptions) {}

  filter(findings: Finding[]): Finding[] {
    const grouped = new Map<string, Finding>();

    for (const finding of findings) {
      if (!this.meetsSeverity(finding.severity)) {
        continue;
      }

      const key = `${finding.file}:${finding.line}:${finding.title}`;
      const existing = grouped.get(key);

      const providers = new Set<string>();
      if (finding.providers) finding.providers.forEach(p => providers.add(p));
      if (finding.provider) providers.add(finding.provider);
      if (providers.size === 0) providers.add('static');

      if (!existing) {
        grouped.set(key, {
          ...finding,
          providers: Array.from(providers),
          confidence: (finding.confidence ?? 0) || 1,
        });
        continue;
      }

      grouped.set(key, {
        ...existing,
        providers: Array.from(new Set([...(existing.providers || []), ...providers])),
        confidence: Math.min(1, (existing.confidence ?? 0) + (finding.confidence ?? 0.5)),
      });
    }

    const filtered = Array.from(grouped.values()).filter(f => this.meetsAgreement(f.providers || []));
    filtered.sort((a, b) => SEVERITY_ORDER[b.severity] - SEVERITY_ORDER[a.severity]);
    return filtered;
  }

  private meetsSeverity(severity: Severity): boolean {
    return SEVERITY_ORDER[severity] >= SEVERITY_ORDER[this.options.minSeverity];
  }

  private meetsAgreement(providers: string[]): boolean {
    if (providers.includes('static')) return true;
    const count = providers.length;
    if (count >= this.options.minAgreement) return true;
    // Do not drop single-provider findings even when minAgreement > 1.
    return count === 1;
  }
}
