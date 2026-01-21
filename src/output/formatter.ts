import { Review } from '../types';

export class MarkdownFormatter {
  format(review: Review): string {
    const lines: string[] = [];
    lines.push(review.summary);

    if (review.findings.length > 0) {
      lines.push('\n## Findings');
      review.findings.forEach(f => {
        lines.push(`- [${f.severity.toUpperCase()}] ${f.file}:${f.line} — ${f.title}`);
        lines.push(`  ${f.message}`);
        if (f.suggestion) {
          lines.push(`  Suggestion: ${f.suggestion}`);
        }
        if (f.providers && f.providers.length > 0) {
          lines.push(`  Providers: ${f.providers.join(', ')}`);
        }
      });
    }

    if (review.actionItems.length > 0) {
      lines.push('\n## Action Items');
      review.actionItems.forEach(item => lines.push(`- ${item}`));
    }

    if (review.testHints && review.testHints.length > 0) {
      lines.push('\n## Test Coverage');
      review.testHints.forEach(hint =>
        lines.push(`- ${hint.file} → add ${hint.suggestedTestFile} (${hint.testPattern})`)
      );
    }

    lines.push('\n---');
    lines.push('### Run details (usage, cost, providers, status)');
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
    }

    if (review.aiAnalysis) {
      lines.push('\n### AI Generated Code Likelihood');
      lines.push(
        `- Overall: ${(review.aiAnalysis.averageLikelihood * 100).toFixed(1)}% (${review.aiAnalysis.consensus})`
      );
    }

    if (review.providerResults && review.providerResults.length > 0) {
      lines.push('\n### Raw provider outputs');
      for (const result of review.providerResults) {
        lines.push(`- ${result.name} [${result.status}] (${result.durationSeconds.toFixed(1)}s)`);
        if (result.result?.content) {
          const body = this.truncate(result.result.content.trim(), 1200);
          lines.push('```');
          lines.push(body);
          lines.push('```');
        }
      }
    }

    return lines.join('\n');
  }

  private truncate(value: string, max: number): string {
    if (value.length <= max) return value;
    return value.slice(0, max) + '\n... (truncated)';
  }
}
