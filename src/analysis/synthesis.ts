import { Finding, InlineComment, PRContext, Review, ReviewConfig, ReviewMetrics, TestCoverageHint, AIAnalysis, ProviderResult, RunDetails, ImpactAnalysis } from '../types';

export class SynthesisEngine {
  constructor(private readonly config: ReviewConfig) {}

  synthesize(
    findings: Finding[],
    pr: PRContext,
    testHints?: TestCoverageHint[],
    aiAnalysis?: AIAnalysis,
    providerResults?: ProviderResult[],
    runDetails?: RunDetails,
    impactAnalysis?: ImpactAnalysis,
    mermaidDiagram?: string
  ): Review {
    const metrics = this.buildMetrics(findings);
    const summary = this.buildSummary(pr, findings, metrics, testHints, aiAnalysis, providerResults, impactAnalysis);
    const inlineComments = this.buildInlineComments(findings);
    const actionItems = this.buildActionItems(findings, testHints);

    return {
      summary,
      findings,
      inlineComments,
      actionItems,
      testHints,
      aiAnalysis,
      metrics,
      providerResults,
      runDetails,
      impactAnalysis,
      mermaidDiagram,
    };
  }

  private buildMetrics(findings: Finding[]): ReviewMetrics {
    const critical = findings.filter(f => f.severity === 'critical').length;
    const major = findings.filter(f => f.severity === 'major').length;
    const minor = findings.filter(f => f.severity === 'minor').length;

    return {
      totalFindings: findings.length,
      critical,
      major,
      minor,
      providersUsed: 0,
      providersSuccess: 0,
      providersFailed: 0,
      totalTokens: 0,
      totalCost: 0,
      durationSeconds: 0,
    };
  }

  private buildSummary(
    pr: PRContext,
    findings: Finding[],
    metrics: ReviewMetrics,
    testHints?: TestCoverageHint[],
    aiAnalysis?: AIAnalysis,
    providerResults?: ProviderResult[],
    impactAnalysis?: ImpactAnalysis
  ): string {
    const totalProviders = providerResults?.length ?? 0;
    const successes = providerResults?.filter(p => p.status === 'success').length ?? 0;
    const failures = totalProviders - successes;

    const impactText = impactAnalysis ? ` • Impact: ${impactAnalysis.impactLevel}` : '';
    const aiText = aiAnalysis
      ? ` • AI-likelihood: ${(aiAnalysis.averageLikelihood * 100).toFixed(1)}%`
      : '';

    return [
      `Review for PR #${pr.number}: ${pr.title}`,
      `Files: ${pr.files.length} (+${pr.additions}/-${pr.deletions}) • Providers: ${successes}/${totalProviders} succeeded${failures > 0 ? `, ${failures} failed` : ''} • Findings: ${metrics.totalFindings} (C${metrics.critical}/M${metrics.major}/m${metrics.minor})${impactText}${aiText}`,
    ].join('\n');
  }

  private buildInlineComments(findings: Finding[]): InlineComment[] {
    const severityOrder: Record<'critical' | 'major' | 'minor', number> = {
      critical: 3,
      major: 2,
      minor: 1,
    };

    const sorted = findings
      .filter(f => severityOrder[f.severity] >= severityOrder[this.config.inlineMinSeverity])
      .slice(0, this.config.inlineMaxComments);

    return sorted.map(f => ({
      path: f.file,
      line: f.line,
      side: 'RIGHT',
      body: this.commentBody(f),
    }));
  }

  private commentBody(finding: Finding): string {
    const parts = [`**${finding.title}**`, finding.message];
    if (finding.suggestion) {
      parts.push('', `Suggestion: ${finding.suggestion}`);
    }
    if (finding.providers && finding.providers.length > 1) {
      parts.push('', `Providers: ${finding.providers.join(', ')}`);
    }
    return parts.join('\n');
  }

  private buildActionItems(findings: Finding[], hints?: TestCoverageHint[]): string[] {
    const items = findings
      .filter(f => f.severity !== 'minor')
      .slice(0, 5)
      .map(f => `${f.file}:${f.line} — ${f.title}`);

    return Array.from(new Set(items));
  }
}
