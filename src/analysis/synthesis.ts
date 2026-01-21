import { Finding, InlineComment, PRContext, Review, ReviewConfig, ReviewMetrics, TestCoverageHint, AIAnalysis } from '../types';

export class SynthesisEngine {
  constructor(private readonly config: ReviewConfig) {}

  synthesize(
    findings: Finding[],
    pr: PRContext,
    testHints?: TestCoverageHint[],
    aiAnalysis?: AIAnalysis
  ): Review {
    const metrics = this.buildMetrics(findings);
    const summary = this.buildSummary(pr, findings, metrics, testHints, aiAnalysis);
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
    aiAnalysis?: AIAnalysis
  ): string {
    const lines: string[] = [];
    lines.push(`## Review Summary for PR #${pr.number}`);
    lines.push(`- Title: ${pr.title}`);
    lines.push(`- Author: ${pr.author}`);
    lines.push(`- Files changed: ${pr.files.length}, +${pr.additions}/-${pr.deletions}`);
    lines.push(`- Findings: ${metrics.totalFindings} (critical ${metrics.critical}, major ${metrics.major}, minor ${metrics.minor})`);
    if (aiAnalysis) {
      lines.push(`- AI-generated likelihood: ${(aiAnalysis.averageLikelihood * 100).toFixed(1)}% (${aiAnalysis.consensus})`);
    }

    if (findings.length > 0) {
      lines.push('\n### Key Findings');
      const top = findings.slice(0, 10);
      for (const finding of top) {
        lines.push(`- [${finding.severity.toUpperCase()}] ${finding.file}:${finding.line} — ${finding.title}`);
      }
    } else {
      lines.push('\nNo blocking issues detected.');
    }

    if (testHints && testHints.length > 0) {
      lines.push('\n### Test Coverage Hints');
      for (const hint of testHints) {
        lines.push(`- ${hint.file} → consider adding ${hint.suggestedTestFile} (${hint.testPattern})`);
      }
    }

    return lines.join('\n');
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

    if (hints) {
      for (const hint of hints) {
        items.push(`Add tests: ${hint.suggestedTestFile}`);
      }
    }

    return items;
  }
}
