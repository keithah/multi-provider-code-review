import { Review, Finding } from '../types';
import { colors } from './colors';

/**
 * Terminal formatter for CLI output
 */
export class TerminalFormatter {
  /**
   * Format review results for terminal
   */
  format(review: Review): string {
    const lines: string[] = [];

    // Header
    lines.push('');
    lines.push(colors.cyan('═'.repeat(80)));
    lines.push(colors.bold(colors.cyan('  Multi-Provider Code Review')));
    lines.push(colors.cyan('═'.repeat(80)));
    lines.push('');

    // Summary stats
    lines.push(this.formatStats(review));
    lines.push('');

    // Findings by severity
    if (review.findings.length > 0) {
      lines.push(this.formatFindings(review.findings));
    } else {
      lines.push(colors.success('✓ No issues found!'));
      lines.push('');
    }

    // Performance metrics
    if (review.metrics) {
      lines.push(this.formatMetrics(review.metrics));
      lines.push('');
    }

    return lines.join('\n');
  }

  /**
   * Format summary statistics
   */
  private formatStats(review: Review): string {
    const lines: string[] = [];
    const { metrics } = review;

    if (!metrics) return '';

    lines.push(colors.bold('Summary:'));

    const criticalCount = metrics.critical > 0
      ? colors.bold(colors.red(String(metrics.critical)))
      : colors.gray(String(metrics.critical));
    const majorCount = metrics.major > 0
      ? colors.bold(colors.yellow(String(metrics.major)))
      : colors.gray(String(metrics.major));
    const minorCount = metrics.minor > 0
      ? colors.blue(String(metrics.minor))
      : colors.gray(String(metrics.minor));

    lines.push(`  ${this.getSeverityIcon('critical')} Critical: ${criticalCount}`);
    lines.push(`  ${this.getSeverityIcon('major')} Major:    ${majorCount}`);
    lines.push(`  ${this.getSeverityIcon('minor')} Minor:    ${minorCount}`);
    lines.push(`  ${colors.dim('Total:')}    ${colors.bold(String(metrics.totalFindings))}`);

    return lines.join('\n');
  }

  /**
   * Format findings grouped by severity
   */
  private formatFindings(findings: Finding[]): string {
    const lines: string[] = [];

    // Group by severity
    const critical = findings.filter(f => f.severity === 'critical');
    const major = findings.filter(f => f.severity === 'major');
    const minor = findings.filter(f => f.severity === 'minor');

    // Critical findings
    if (critical.length > 0) {
      lines.push(colors.critical('Critical Issues:'));
      lines.push('');
      for (const finding of critical) {
        lines.push(this.formatFinding(finding, 'critical'));
        lines.push('');
      }
    }

    // Major findings
    if (major.length > 0) {
      lines.push(colors.major('Major Issues:'));
      lines.push('');
      for (const finding of major) {
        lines.push(this.formatFinding(finding, 'major'));
        lines.push('');
      }
    }

    // Minor findings
    if (minor.length > 0) {
      lines.push(colors.bold(colors.blue('Minor Issues:')));
      lines.push('');
      for (const finding of minor) {
        lines.push(this.formatFinding(finding, 'minor'));
        lines.push('');
      }
    }

    return lines.join('\n');
  }

  /**
   * Format a single finding
   */
  private formatFinding(finding: Finding, severity: string): string {
    const lines: string[] = [];
    const icon = this.getSeverityIcon(severity);

    // Title with location
    const location = colors.cyan(`${finding.file}:${finding.line}`);
    const title = this.formatSeverityText(finding.title, severity);
    lines.push(`  ${icon} ${title} ${colors.dim('at')} ${location}`);

    // Message (indented)
    const messageLines = finding.message.split('\n');
    for (const line of messageLines) {
      lines.push(`     ${colors.dim(line)}`);
    }

    // Suggestion (if present)
    if (finding.suggestion) {
      lines.push(`     ${colors.green('💡 Suggestion:')} ${finding.suggestion}`);
    }

    return lines.join('\n');
  }

  /**
   * Format performance metrics
   */
  private formatMetrics(metrics: Review['metrics']): string {
    if (!metrics) return '';

    const lines: string[] = [];

    lines.push(colors.bold('Performance:'));
    lines.push(`  Duration:  ${colors.cyan(`${metrics.durationSeconds.toFixed(2)}s`)}`);
    lines.push(`  Cost:      ${colors.cyan(`$${metrics.totalCost.toFixed(4)}`)}`);
    lines.push(`  Providers: ${colors.cyan(`${metrics.providersSuccess}/${metrics.providersUsed}`)} successful`);

    if (metrics.providersFailed > 0) {
      lines.push(`  ${colors.warn('⚠')} ${metrics.providersFailed} provider(s) failed`);
    }

    return lines.join('\n');
  }

  /**
   * Get icon for severity level
   */
  private getSeverityIcon(severity: string): string {
    switch (severity) {
      case 'critical':
        return colors.red('✖');
      case 'major':
        return colors.yellow('⚠');
      case 'minor':
        return colors.blue('ℹ');
      default:
        return '•';
    }
  }

  /**
   * Format text with severity-appropriate styling
   */
  private formatSeverityText(text: string, severity: string): string {
    switch (severity) {
      case 'critical':
        return colors.bold(colors.red(text));
      case 'major':
        return colors.bold(colors.yellow(text));
      case 'minor':
        return colors.bold(colors.blue(text));
      default:
        return text;
    }
  }

  /**
   * Format a simple message (for errors, info)
   */
  formatMessage(message: string, type: 'error' | 'warning' | 'info' | 'success' = 'info'): string {
    const icon = this.getMessageIcon(type);
    const coloredMessage = this.colorMessage(message, type);
    return `${icon} ${coloredMessage}`;
  }

  /**
   * Get icon for message type
   */
  private getMessageIcon(type: string): string {
    switch (type) {
      case 'error':
        return colors.error('✖');
      case 'warning':
        return colors.warn('⚠');
      case 'success':
        return colors.success('✓');
      case 'info':
        return colors.info('ℹ');
      default:
        return '•';
    }
  }

  /**
   * Apply color to message based on type
   */
  private colorMessage(message: string, type: string): string {
    switch (type) {
      case 'error':
        return colors.error(message);
      case 'warning':
        return colors.warn(message);
      case 'success':
        return colors.success(message);
      case 'info':
        return colors.info(message);
      default:
        return message;
    }
  }

  /**
   * Get exit code based on findings
   */
  getExitCode(review: Review): number {
    if (!review.metrics) return 0;

    // Exit with error if critical issues found
    if (review.metrics.critical > 0) return 2;

    // Exit with warning if major issues found
    if (review.metrics.major > 0) return 1;

    // Exit with warning if there are action items requiring changes
    if (review.actionItems && review.actionItems.length > 0) return 1;

    // Success
    return 0;
  }
}
