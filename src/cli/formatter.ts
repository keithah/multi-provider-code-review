import { Review, Finding } from '../types';

/**
 * ANSI color codes for terminal output
 */
const colors = {
  reset: '\x1b[0m',
  bold: '\x1b[1m',
  dim: '\x1b[2m',

  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  green: '\x1b[32m',
  gray: '\x1b[90m',
  cyan: '\x1b[36m',

  bgRed: '\x1b[41m',
  bgYellow: '\x1b[43m',
  bgBlue: '\x1b[44m',
};

/**
 * Check if terminal supports colors
 * Respects NO_COLOR environment variable (https://no-color.org/)
 */
function supportsColor(): boolean {
  if (process.env.NO_COLOR !== undefined) {
    return false;
  }
  return process.stdout.isTTY && process.env.TERM !== 'dumb';
}

/**
 * Apply color if terminal supports it
 */
function colorize(text: string, color: string): string {
  return supportsColor() ? `${color}${text}${colors.reset}` : text;
}

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
    lines.push(colorize('═'.repeat(80), colors.cyan));
    lines.push(colorize('  Multi-Provider Code Review', colors.bold + colors.cyan));
    lines.push(colorize('═'.repeat(80), colors.cyan));
    lines.push('');

    // Summary stats
    lines.push(this.formatStats(review));
    lines.push('');

    // Findings by severity
    if (review.findings.length > 0) {
      lines.push(this.formatFindings(review.findings));
    } else {
      lines.push(colorize('✓ No issues found!', colors.green + colors.bold));
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

    lines.push(colorize('Summary:', colors.bold));
    lines.push(`  ${this.getSeverityIcon('critical')} Critical: ${colorize(String(metrics.critical), metrics.critical > 0 ? colors.red + colors.bold : colors.gray)}`);
    lines.push(`  ${this.getSeverityIcon('major')} Major:    ${colorize(String(metrics.major), metrics.major > 0 ? colors.yellow + colors.bold : colors.gray)}`);
    lines.push(`  ${this.getSeverityIcon('minor')} Minor:    ${colorize(String(metrics.minor), metrics.minor > 0 ? colors.blue : colors.gray)}`);
    lines.push(`  ${colorize('Total:', colors.dim)}    ${colorize(String(metrics.totalFindings), colors.bold)}`);

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
      lines.push(colorize('Critical Issues:', colors.red + colors.bold));
      lines.push('');
      for (const finding of critical) {
        lines.push(this.formatFinding(finding, 'critical'));
        lines.push('');
      }
    }

    // Major findings
    if (major.length > 0) {
      lines.push(colorize('Major Issues:', colors.yellow + colors.bold));
      lines.push('');
      for (const finding of major) {
        lines.push(this.formatFinding(finding, 'major'));
        lines.push('');
      }
    }

    // Minor findings
    if (minor.length > 0) {
      lines.push(colorize('Minor Issues:', colors.blue + colors.bold));
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
    const color = this.getSeverityColor(severity);

    // Title with location
    const location = colorize(`${finding.file}:${finding.line}`, colors.cyan);
    lines.push(`  ${icon} ${colorize(finding.title, color + colors.bold)} ${colorize('at', colors.dim)} ${location}`);

    // Message (indented)
    const messageLines = finding.message.split('\n');
    for (const line of messageLines) {
      lines.push(`     ${colorize(line, colors.dim)}`);
    }

    // Suggestion (if present)
    if (finding.suggestion) {
      lines.push(`     ${colorize('💡 Suggestion:', colors.green)} ${finding.suggestion}`);
    }

    return lines.join('\n');
  }

  /**
   * Format performance metrics
   */
  private formatMetrics(metrics: Review['metrics']): string {
    if (!metrics) return '';

    const lines: string[] = [];

    lines.push(colorize('Performance:', colors.bold));
    lines.push(`  Duration:  ${colorize(`${metrics.durationSeconds.toFixed(2)}s`, colors.cyan)}`);
    lines.push(`  Cost:      ${colorize(`$${metrics.totalCost.toFixed(4)}`, colors.cyan)}`);
    lines.push(`  Providers: ${colorize(`${metrics.providersSuccess}/${metrics.providersUsed}`, colors.cyan)} successful`);

    if (metrics.providersFailed > 0) {
      lines.push(`  ${colorize('⚠', colors.yellow)} ${metrics.providersFailed} provider(s) failed`);
    }

    return lines.join('\n');
  }

  /**
   * Get icon for severity level
   */
  private getSeverityIcon(severity: string): string {
    switch (severity) {
      case 'critical':
        return colorize('✖', colors.red);
      case 'major':
        return colorize('⚠', colors.yellow);
      case 'minor':
        return colorize('ℹ', colors.blue);
      default:
        return '•';
    }
  }

  /**
   * Get color for severity level
   */
  private getSeverityColor(severity: string): string {
    switch (severity) {
      case 'critical':
        return colors.red;
      case 'major':
        return colors.yellow;
      case 'minor':
        return colors.blue;
      default:
        return colors.reset;
    }
  }

  /**
   * Format a simple message (for errors, info)
   */
  formatMessage(message: string, type: 'error' | 'warning' | 'info' | 'success' = 'info'): string {
    const icon = this.getMessageIcon(type);
    const color = this.getMessageColor(type);
    return `${icon} ${colorize(message, color)}`;
  }

  /**
   * Get icon for message type
   */
  private getMessageIcon(type: string): string {
    switch (type) {
      case 'error':
        return colorize('✖', colors.red);
      case 'warning':
        return colorize('⚠', colors.yellow);
      case 'success':
        return colorize('✓', colors.green);
      case 'info':
        return colorize('ℹ', colors.blue);
      default:
        return '•';
    }
  }

  /**
   * Get color for message type
   */
  private getMessageColor(type: string): string {
    switch (type) {
      case 'error':
        return colors.red;
      case 'warning':
        return colors.yellow;
      case 'success':
        return colors.green;
      case 'info':
        return colors.blue;
      default:
        return colors.reset;
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

    // Success
    return 0;
  }
}
