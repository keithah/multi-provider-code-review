import { EvidenceScore, Finding } from '../types';

export class EvidenceScorer {
  score(
    finding: Finding,
    providerCount: number,
    astConfirmed: boolean,
    graphConfirmed: boolean,
    hasDirectEvidence: boolean
  ): EvidenceScore {
    const agreement = providerCount > 0 ? (finding.providers?.length || 0) / providerCount : 0;

    const confidence =
      (agreement * 0.3) +
      (astConfirmed ? 0.25 : 0) +
      (graphConfirmed ? 0.25 : 0) +
      (hasDirectEvidence ? 0.2 : 0);

    const reasons: string[] = [];
    if (agreement >= 0.5) reasons.push(`${Math.round(agreement * 100)}% provider agreement`);
    if (astConfirmed) reasons.push('confirmed by AST analysis');
    if (graphConfirmed) reasons.push('validated by dependency graph');
    if (hasDirectEvidence) reasons.push('direct evidence in changed code');

    return {
      confidence: Math.min(1, confidence),
      reasoning: reasons.join(', ') || 'limited evidence',
      badge: this.getBadge(confidence),
    };
  }

  private getBadge(confidence: number): string {
    if (confidence >= 0.8) return '🟢 High Confidence';
    if (confidence >= 0.5) return '🟡 Medium Confidence';
    return '🟠 Low Confidence';
  }
}
