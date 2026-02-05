import { Finding, Severity } from '../types';
import { areASTsEquivalent } from '../validation/ast-comparator';
import { detectLanguage } from './ast/parsers';

export interface ConsensusOptions {
  minAgreement: number;
  minSeverity: Severity;
  maxComments: number;
}

export interface SuggestionConsensus {
  hasSuggestionConsensus: boolean;
  agreementCount: number;
  suggestions: string[];
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

  /**
   * Check if multiple providers' suggestions are AST-equivalent.
   * Used for critical severity findings where consensus is required.
   */
  checkSuggestionConsensus(
    suggestions: Array<{ provider: string; suggestion: string; file: string }>,
    minAgreement: number = 2
  ): SuggestionConsensus {
    if (suggestions.length < minAgreement) {
      return { hasSuggestionConsensus: false, agreementCount: 0, suggestions: [] };
    }

    const language = detectLanguage(suggestions[0].file);
    if (language === 'unknown') {
      // Can't compare ASTs for unknown language, fall back to string comparison
      return this.checkStringConsensus(suggestions, minAgreement);
    }

    // Group by AST equivalence
    const groups: string[][] = [];
    for (const s of suggestions) {
      let added = false;
      for (const group of groups) {
        const result = areASTsEquivalent(group[0], s.suggestion, language);
        if (result.equivalent) {
          group.push(s.suggestion);
          added = true;
          break;
        }
      }
      if (!added) {
        groups.push([s.suggestion]);
      }
    }

    // Find largest group
    const largestGroup = groups.reduce((a, b) => a.length > b.length ? a : b, []);

    return {
      hasSuggestionConsensus: largestGroup.length >= minAgreement,
      agreementCount: largestGroup.length,
      suggestions: largestGroup
    };
  }

  private checkStringConsensus(
    suggestions: Array<{ provider: string; suggestion: string }>,
    minAgreement: number
  ): SuggestionConsensus {
    // Fallback: exact string match (normalized whitespace)
    const normalized = suggestions.map(s => ({ ...s, normalized: s.suggestion.trim().replace(/\s+/g, ' ') }));
    const counts = new Map<string, string[]>();
    for (const s of normalized) {
      const arr = counts.get(s.normalized) || [];
      arr.push(s.suggestion);
      counts.set(s.normalized, arr);
    }
    const largest = Array.from(counts.values()).reduce((a, b) => a.length > b.length ? a : b, []);
    return {
      hasSuggestionConsensus: largest.length >= minAgreement,
      agreementCount: largest.length,
      suggestions: largest
    };
  }
}
