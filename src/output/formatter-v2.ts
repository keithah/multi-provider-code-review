import { Review, Finding } from '../types';

/**
 * Enhanced Markdown Formatter
 * Inspired by Claude Code Action and CodeRabbit
 * Features:
 * - Emoji section headers
 * - Visual severity indicators
 * - PR summary and release notes
 * - Collapsible sections
 * - Professional formatting
 */
export class MarkdownFormatterV2 {
  format(review: Review): string {
    const lines: string[] = [];

    // Header with branding
    lines.push('# 🤖 Multi-Provider Code Review');
    lines.push('');

    // Quick stats summary
    lines.push(this.formatQuickStats(review));
    lines.push('');

    // PR Summary section
    lines.push('## 📝 Summary');
    lines.push('');
    lines.push(`> ${this.generatePRSummary(review)}`);
    lines.push('');

    // Release notes (if significant changes)
    if (this.hasSignificantChanges(review)) {
      lines.push('## 📋 Release Notes');
      lines.push('');
      lines.push(this.generateReleaseNotes(review));
      lines.push('');
    }

    // Findings by severity with visual indicators
    const hasCritical = review.findings.some(f => f.severity === 'critical');
    const hasMajor = review.findings.some(f => f.severity === 'major');
    const hasMinor = review.findings.some(f => f.severity === 'minor');

    if (review.findings.length > 0) {
      lines.push('## 🔍 Findings');
      lines.push('');

      const critical = review.findings.filter(f => f.severity === 'critical');
      const major = review.findings.filter(f => f.severity === 'major');
      const minor = review.findings.filter(f => f.severity === 'minor');

      if (critical.length > 0) {
        lines.push(this.formatSeveritySection('🔴 Critical', critical, 'critical'));
      }

      if (major.length > 0) {
        lines.push(this.formatSeveritySection('🟡 Major', major, 'major'));
      }

      if (minor.length > 0) {
        lines.push(this.formatSeveritySection('🔵 Minor', minor, 'minor'));
      }
    } else {
      lines.push('## ✅ All Clear!');
      lines.push('');
      lines.push('> No issues found. Great job! 🎉');
      lines.push('');
    }

    // Action items (if any)
    if (review.actionItems && review.actionItems.length > 0) {
      lines.push('## 📌 Action Items');
      lines.push('');
      review.actionItems.forEach(item => {
        lines.push(`- [ ] ${item}`);
      });
      lines.push('');
    }

    // Performance & metrics
    lines.push(this.formatMetrics(review));
    lines.push('');

    // Advanced sections (collapsible)
    lines.push(this.formatAdvancedSections(review));

    // Footer
    lines.push('---');
    lines.push('');
    lines.push('*🤖 Powered by Multi-Provider Code Review* • [Dismiss a finding](https://github.com/your-repo/multi-provider-code-review/blob/main/docs/user-guide.md#dismissing-findings) with 👎');

    return lines.join('\n');
  }

  private formatQuickStats(review: Review): string {
    const { metrics } = review;
    const criticalCount = metrics.critical;
    const majorCount = metrics.major;
    const minorCount = metrics.minor;

    const criticalBadge = criticalCount > 0
      ? `🔴 **${criticalCount} Critical**`
      : `~~${criticalCount} Critical~~`;
    const majorBadge = majorCount > 0
      ? `🟡 **${majorCount} Major**`
      : `~~${majorCount} Major~~`;
    const minorBadge = minorCount > 0
      ? `🔵 ${minorCount} Minor`
      : `~~${minorCount} Minor~~`;

    const costBadge = metrics.totalCost > 0.01
      ? `💰 $${metrics.totalCost.toFixed(4)}`
      : `💚 $${metrics.totalCost.toFixed(4)}`;

    return `${criticalBadge} • ${majorBadge} • ${minorBadge} • ⏱️ ${metrics.durationSeconds.toFixed(1)}s • ${costBadge}`;
  }

  private generatePRSummary(review: Review): string {
    const { metrics, findings } = review;

    if (findings.length === 0) {
      return 'This PR looks great! No issues detected by the automated review.';
    }

    const parts: string[] = [];

    if (metrics.critical > 0) {
      parts.push(`**${metrics.critical} critical issue${metrics.critical > 1 ? 's' : ''}** require immediate attention`);
    }

    if (metrics.major > 0) {
      parts.push(`${metrics.major} major issue${metrics.major > 1 ? 's' : ''} should be addressed`);
    }

    if (metrics.minor > 0) {
      parts.push(`${metrics.minor} minor improvement${metrics.minor > 1 ? 's' : ''} suggested`);
    }

    const summary = parts.join(', ');

    // Add context about review scope
    const filesReviewed = new Set(findings.map(f => f.file)).size;
    const context = `Found across ${filesReviewed} file${filesReviewed > 1 ? 's' : ''}.`;

    return `${summary}. ${context}`;
  }

  private hasSignificantChanges(review: Review): boolean {
    // Generate release notes if there are critical or major findings
    return review.metrics.critical > 0 || review.metrics.major > 0;
  }

  private generateReleaseNotes(review: Review): string {
    const lines: string[] = [];
    const significant = review.findings.filter(
      f => f.severity === 'critical' || f.severity === 'major'
    );

    if (significant.length === 0) return '';

    // Group by category
    const byCategory = new Map<string, Finding[]>();
    significant.forEach(f => {
      const category = f.category || 'General';
      if (!byCategory.has(category)) {
        byCategory.set(category, []);
      }
      byCategory.get(category)!.push(f);
    });

    byCategory.forEach((findings, category) => {
      lines.push(`**${category}:**`);
      findings.forEach(f => {
        const emoji = f.severity === 'critical' ? '🔴' : '🟡';
        lines.push(`- ${emoji} ${f.title}`);
      });
      lines.push('');
    });

    return lines.join('\n');
  }

  private formatSeveritySection(
    header: string,
    findings: Finding[],
    severity: 'critical' | 'major' | 'minor'
  ): string {
    const lines: string[] = [];

    lines.push(`### ${header} (${findings.length})`);
    lines.push('');

    findings.forEach((finding, index) => {
      lines.push(this.formatFinding(finding, severity, index + 1));
      if (index < findings.length - 1) {
        lines.push('');
      }
    });

    lines.push('');

    return lines.join('\n');
  }

  private formatFinding(
    finding: Finding,
    severity: 'critical' | 'major' | 'minor',
    index: number
  ): string {
    const lines: string[] = [];

    // Finding header with collapsible details
    const emoji = severity === 'critical' ? '🔴' : severity === 'major' ? '🟡' : '🔵';
    const location = `\`${finding.file}:${finding.line}\``;

    lines.push(`#### ${emoji} ${finding.title}`);
    lines.push(`📍 ${location}${finding.category ? ` • 🏷️ ${finding.category}` : ''}`);
    lines.push('');

    // Message
    lines.push(finding.message);
    lines.push('');

    // Suggestion (if present)
    if (finding.suggestion) {
      lines.push('**💡 Suggested Fix:**');
      lines.push('```');
      lines.push(finding.suggestion);
      lines.push('```');
      lines.push('');
    }

    // Evidence (if present)
    if (finding.evidence) {
      const confidence = Math.round(finding.evidence.confidence * 100);
      const confidenceEmoji = confidence >= 80 ? '🟢' : confidence >= 50 ? '🟡' : '🟠';

      lines.push(`**🔍 Evidence:** ${finding.evidence.badge} ${confidenceEmoji} ${confidence}% confidence`);
      if (finding.evidence.reasoning) {
        lines.push(`<details><summary>View reasoning</summary>`);
        lines.push('');
        lines.push(finding.evidence.reasoning);
        lines.push('</details>');
      }
      lines.push('');
    }

    // Provider consensus (if multiple providers)
    if (finding.providers && finding.providers.length > 1) {
      const providerList = finding.providers.join(', ');
      lines.push(`<sub>Detected by: ${providerList}</sub>`);
      lines.push('');
    }

    return lines.join('\n');
  }

  private formatMetrics(review: Review): string {
    const lines: string[] = [];
    const { metrics, runDetails } = review;

    lines.push('<details>');
    lines.push('<summary>📊 Performance Metrics</summary>');
    lines.push('');
    lines.push('| Metric | Value |');
    lines.push('|--------|-------|');
    lines.push(`| ⏱️ Duration | ${metrics.durationSeconds.toFixed(2)}s |`);
    lines.push(`| 💰 Cost | $${metrics.totalCost.toFixed(4)} |`);
    lines.push(`| 🔢 Tokens | ${metrics.totalTokens.toLocaleString()} |`);
    lines.push(`| 🤖 Providers Used | ${metrics.providersSuccess}/${metrics.providersUsed} |`);

    if (runDetails?.cacheHit) {
      lines.push(`| ⚡ Cache | Hit (6x faster!) |`);
    }

    lines.push('');

    // Provider details
    if (runDetails?.providers && runDetails.providers.length > 0) {
      lines.push('**Provider Performance:**');
      lines.push('');

      runDetails.providers.forEach(p => {
        const statusEmoji = p.status === 'success' ? '✅'
          : p.status === 'timeout' ? '⏱️'
          : p.status === 'rate-limited' ? '⏸️'
          : '❌';

        const costStr = p.cost !== undefined ? `, $${p.cost.toFixed(4)}` : '';
        const tokensStr = p.tokens ? `, ${p.tokens} tokens` : '';

        lines.push(`- ${statusEmoji} **${p.name}** (${p.durationSeconds.toFixed(2)}s${costStr}${tokensStr})`);

        if (p.errorMessage) {
          lines.push(`  <sub>⚠️ ${p.errorMessage}</sub>`);
        }
      });

      lines.push('');
    }

    lines.push('</details>');

    return lines.join('\n');
  }

  private formatAdvancedSections(review: Review): string {
    const lines: string[] = [];

    // AI Analysis
    if (review.aiAnalysis) {
      lines.push('<details>');
      lines.push('<summary>🤖 AI-Generated Code Analysis</summary>');
      lines.push('');
      lines.push(`**Overall Likelihood:** ${(review.aiAnalysis.averageLikelihood * 100).toFixed(1)}%`);
      lines.push('');
      lines.push(`**Consensus:** ${review.aiAnalysis.consensus}`);
      lines.push('');

      if (Object.keys(review.aiAnalysis.providerEstimates).length > 0) {
        lines.push('**Provider Estimates:**');
        Object.entries(review.aiAnalysis.providerEstimates).forEach(([provider, likelihood]) => {
          lines.push(`- ${provider}: ${(likelihood * 100).toFixed(1)}%`);
        });
        lines.push('');
      }

      lines.push('</details>');
      lines.push('');
    }

    // Impact Graph
    if (review.mermaidDiagram && review.mermaidDiagram.trim()) {
      lines.push('<details>');
      lines.push('<summary>📈 Impact Analysis Graph</summary>');
      lines.push('');
      lines.push('```mermaid');
      lines.push(review.mermaidDiagram);
      lines.push('```');
      lines.push('</details>');
      lines.push('');
    }

    // Raw Provider Outputs
    if (review.providerResults && review.providerResults.length > 0) {
      lines.push('<details>');
      lines.push('<summary>🔍 Raw Provider Outputs</summary>');
      lines.push('');

      review.providerResults.forEach(result => {
        const statusEmoji = result.status === 'success' ? '✅'
          : result.status === 'timeout' ? '⏱️'
          : result.status === 'rate-limited' ? '⏸️'
          : '❌';

        lines.push(`<details>`);
        lines.push(`<summary>${statusEmoji} ${result.name} [${result.status}] (${result.durationSeconds.toFixed(2)}s)</summary>`);
        lines.push('');

        if (result.result?.content) {
          lines.push(result.result.content.trim());
        } else if (result.error) {
          lines.push('```');
          lines.push(`Error: ${result.error.message}`);
          lines.push('```');
        } else {
          lines.push('*No content available*');
        }

        lines.push('</details>');
        lines.push('');
      });

      lines.push('</details>');
      lines.push('');
    }

    return lines.join('\n');
  }
}
