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

    if (review.aiAnalysis) {
      lines.push('\n## AI-Generated Code Detection');
      lines.push(`- Consensus: ${review.aiAnalysis.consensus}`);
      lines.push(
        `- Average likelihood: ${(review.aiAnalysis.averageLikelihood * 100).toFixed(1)}%`
      );
    }

    lines.push('\n---');
    lines.push(
      `Metrics: ${review.metrics.totalFindings} findings • cost $${review.metrics.totalCost.toFixed(4)} • time ${review.metrics.durationSeconds.toFixed(1)}s`
    );

    return lines.join('\n');
  }
}
