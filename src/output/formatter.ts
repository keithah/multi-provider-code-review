import { Review } from '../types';

export class MarkdownFormatter {
  format(review: Review): string {
    const lines: string[] = [];
    lines.push('## Multi Provider Review Summary');
    lines.push('');
    lines.push(review.summary);

    if (review.impactAnalysis) {
      lines.push('\n### Impact');
      lines.push(`- Level: ${review.impactAnalysis.impactLevel} • ${review.impactAnalysis.summary}`);
    }

    const critical = review.findings.filter(f => f.severity === 'critical');
    const major = review.findings.filter(f => f.severity === 'major');
    const minor = review.findings.filter(f => f.severity === 'minor');

    this.printSeveritySection(lines, 'Critical', critical);
    this.printSeveritySection(lines, 'Major', major);
    this.printSeveritySection(lines, 'Minor', minor);

    const uniqueActions = Array.from(new Set(review.actionItems || []));
    if (uniqueActions.length > 0) {
      lines.push('\n<details><summary>Action Items</summary>');
      lines.push('');
      uniqueActions.forEach(item => lines.push(`- ${item}`));
      lines.push('</details>');
    }

    if (review.testHints && review.testHints.length > 0) {
      lines.push('\n<details><summary>Test Coverage</summary>');
      lines.push('');
      lines.push(`- ${review.testHints.length} areas need tests`);
      lines.push('');
      review.testHints.forEach(hint =>
        lines.push(`  - ${hint.file} → add ${hint.suggestedTestFile} (${hint.testPattern})`)
      );
      lines.push('</details>');
    }

    if (review.mermaidDiagram && review.mermaidDiagram.trim()) {
      lines.push('\n<details><summary>Impact graph</summary>');
      lines.push('```mermaid');
      lines.push(review.mermaidDiagram);
      lines.push('```');
      lines.push('</details>');
    }

    lines.push('\n---');
    lines.push('<details><summary>Run details (usage, cost, providers, status)</summary>');
    lines.push('');
    lines.push(
      `- Duration: ${review.metrics.durationSeconds.toFixed(1)}s • Cost: $${review.metrics.totalCost.toFixed(4)} • Tokens: ${review.metrics.totalTokens}`
    );
    lines.push(`- Providers used: ${review.metrics.providersUsed} (success ${review.metrics.providersSuccess}, failed ${review.metrics.providersFailed})`);
    if (review.runDetails) {
      review.runDetails.providers.forEach(p => {
        lines.push(
          `  - ${p.name}: ${p.status} (${p.durationSeconds.toFixed(1)}s${p.cost !== undefined ? `, $${p.cost.toFixed(4)}` : ''}${p.tokens ? `, tokens ${p.tokens}` : ''}${p.errorMessage ? `, error: ${p.errorMessage}` : ''})`
        );
      });

      const timeouts = review.runDetails.providers.filter(p => p.errorMessage?.includes('timed out'));
      if (timeouts.length > 0) {
        lines.push('');
        lines.push(`*Note: ${timeouts.length} provider(s) timed out. This is expected for large PRs and does not affect the quality of results from successful providers.*`);
      }
    }
    lines.push('</details>');

    if (review.aiAnalysis) {
      lines.push('\n<details><summary>AI Generated Code Likelihood</summary>');
      lines.push('');
      lines.push(
        `- Overall: ${(review.aiAnalysis.averageLikelihood * 100).toFixed(1)}% (${review.aiAnalysis.consensus})`
      );
      lines.push('</details>');
    }

    if (review.providerResults && review.providerResults.length > 0) {
      lines.push('\n<details><summary>Raw provider outputs</summary>');
      lines.push('');
      for (const result of review.providerResults) {
        lines.push(`<details><summary>${result.name} [${result.status}] (${result.durationSeconds.toFixed(1)}s)</summary>`);
        lines.push('');
        if (result.result?.content) {
          lines.push('```');
          lines.push(result.result.content.trim());
          lines.push('```');
        } else {
          lines.push('_no content_');
        }
        lines.push('</details>');
        lines.push('');
      }
      lines.push('</details>');
    }

    return lines.join('\n');
  }

  private printSeveritySection(lines: string[], title: string, findings: Review['findings']): void {
    if (findings.length === 0) return;
    lines.push(`\n### ${title}`);
    findings.forEach(f => {
      lines.push(`- ${f.file}:${f.line} — ${f.title}`);
      lines.push(`  ${f.message}`);
      if (f.suggestion) {
        lines.push(`  Suggestion: ${f.suggestion}`);
      }
      if (f.evidence) {
        lines.push(
          `  Evidence: ${f.evidence.badge} (${Math.round(f.evidence.confidence * 100)}%)${f.evidence.reasoning ? ` — ${f.evidence.reasoning}` : ''}`
        );
      }
    });
  }
}
