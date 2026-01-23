#!/usr/bin/env node

import { GitReader } from './git-reader';
import { TerminalFormatter } from './formatter';
import { CLIReviewer } from './reviewer';
import { setupComponents } from '../setup';
import { PRContext } from '../types';
import { logger } from '../utils/logger';
import { generateAnalytics, printSummary } from './analytics';

/**
 * CLI interface for multi-provider code review
 */
export class CLI {
  private gitReader: GitReader;
  private formatter: TerminalFormatter;

  constructor() {
    this.gitReader = new GitReader();
    this.formatter = new TerminalFormatter();
  }

  /**
   * Main CLI entry point
   */
  async run(args: string[]): Promise<number> {
    try {
      // Parse command and arguments
      const { command, target, options } = this.parseArgs(args);

      // Check we're in a git repo
      if (!this.gitReader.isGitRepo()) {
        console.error(this.formatter.formatMessage('Not in a git repository', 'error'));
        return 1;
      }

      // Handle commands
      switch (command) {
        case 'review':
          return await this.runReview(target, options);

        case 'analytics':
          return await this.runAnalytics(target, options);

        case 'help':
        case '--help':
        case '-h':
          this.showHelp();
          return 0;

        case 'version':
        case '--version':
        case '-v':
          this.showVersion();
          return 0;

        default:
          console.error(this.formatter.formatMessage(`Unknown command: ${command}`, 'error'));
          this.showHelp();
          return 1;
      }
    } catch (error) {
      console.error(this.formatter.formatMessage(String(error), 'error'));
      return 1;
    }
  }

  /**
   * Run code review
   */
  private async runReview(target?: string, options: Record<string, unknown> = {}): Promise<number> {
    let components: any = null;

    try {
      console.log(this.formatter.formatMessage('Starting code review...', 'info'));
      console.log('');

      // Get changes based on target
      let pr: PRContext;

      if (!target) {
        // No target: review uncommitted changes
        pr = await this.gitReader.getUncommittedChanges();
        console.log(this.formatter.formatMessage('Reviewing uncommitted changes', 'info'));
      } else if (target.includes('..')) {
        // Range: review between commits/branches
        const [base, head] = target.split('..');
        pr = await this.gitReader.getBranchChanges(base, head);
        console.log(this.formatter.formatMessage(`Reviewing changes from ${base} to ${head || 'HEAD'}`, 'info'));
      } else {
        // Single commit
        pr = await this.gitReader.getCommitChanges(target);
        console.log(this.formatter.formatMessage(`Reviewing commit ${target}`, 'info'));
      }

      // Check if there are changes
      if (pr.files.length === 0) {
        console.log(this.formatter.formatMessage('No changes to review', 'success'));
        return 0;
      }

      console.log(this.formatter.formatMessage(`Found ${pr.files.length} changed file(s)`, 'info'));
      console.log('');

      // Setup components (CLI mode)
      components = await setupComponents({
        cliMode: true,
        dryRun: options.dryRun as boolean || false,
      });

      // Create CLI reviewer
      const reviewer = new CLIReviewer(components);

      // Run review
      const review = await reviewer.review(pr);

      // Format and display results
      const output = this.formatter.format(review);
      console.log(output);

      // Return exit code based on severity
      return this.formatter.getExitCode(review);
    } catch (error) {
      logger.error('Review failed', { error: String(error) });
      throw error;
    } finally {
      // Clean up resources to prevent memory leaks
      if (components?.costTracker) {
        components.costTracker.reset();
      }
    }
  }

  /**
   * Run analytics command
   */
  private async runAnalytics(subcommand?: string, options: Record<string, unknown> = {}): Promise<number> {
    try {
      if (subcommand === 'summary' || !subcommand) {
        // Show summary
        const days = typeof options.days === 'number' ? options.days : 30;
        await printSummary(days);
        return 0;
      } else if (subcommand === 'generate') {
        // Generate dashboard
        await generateAnalytics({
          output: (options.output as string) || './reports',
          format: (options.format as 'html' | 'csv' | 'json') || 'html',
          days: (options.days as number) || 30,
        });
        return 0;
      } else {
        console.error(this.formatter.formatMessage(`Unknown analytics subcommand: ${subcommand}`, 'error'));
        this.showAnalyticsHelp();
        return 1;
      }
    } catch (error) {
      logger.error('Analytics command failed', error as Error);
      return 1;
    }
  }

  /**
   * Show analytics help
   */
  private showAnalyticsHelp(): void {
    const help = `
Analytics Commands:

Usage:
  mpr analytics summary [--days=N]           Show summary statistics
  mpr analytics generate [options]           Generate analytics dashboard

Options:
  --output=<dir>                             Output directory (default: ./reports)
  --format=<html|csv|json>                   Output format (default: html)
  --days=<number>                            Days of data to include (default: 30)

Examples:
  mpr analytics summary                      Show last 30 days summary
  mpr analytics summary --days=7             Show last 7 days summary
  mpr analytics generate                     Generate HTML dashboard
  mpr analytics generate --format=csv        Generate CSV export
`;
    console.log(help);
  }

  /**
   * Parse command line arguments
   */
  private parseArgs(args: string[]): {
    command: string;
    target?: string;
    options: Record<string, unknown>;
  } {
    const command = args[0] || 'help';
    let target: string | undefined;
    const options: Record<string, unknown> = {};

    // Parse target and options
    for (let i = 1; i < args.length; i++) {
      const arg = args[i];

      if (arg.startsWith('--')) {
        // Long option
        const [key, value] = arg.substring(2).split('=');
        options[key] = value || true;
      } else if (arg.startsWith('-')) {
        // Short option
        const key = arg.substring(1);
        options[key] = true;
      } else {
        // Target (commit, branch, range)
        target = arg;
      }
    }

    return { command, target, options };
  }

  /**
   * Show help message
   */
  private showHelp(): void {
    const help = `
Multi-Provider Code Review CLI

Usage:
  mpr review [target] [options]    Run code review
  mpr analytics <command> [options] Manage analytics and dashboards
  mpr help                         Show this help
  mpr version                      Show version

Review Targets:
  (none)                          Review uncommitted changes
  HEAD~1                          Review specific commit
  main..feature                   Review branch changes
  abc123..def456                  Review commit range

Review Options:
  --dry-run                       Preview without posting results

Analytics Commands:
  summary [--days=N]              Show summary statistics
  generate [options]              Generate analytics dashboard

Examples:
  mpr review                      Review uncommitted changes
  mpr review HEAD~1               Review last commit
  mpr review main..feature        Review feature branch
  mpr analytics summary           Show analytics summary
  mpr analytics generate          Generate HTML dashboard

Exit Codes:
  0    No issues or only minor issues
  1    Major issues found
  2    Critical issues found
`;

    console.log(help);
  }

  /**
   * Show version
   */
  private showVersion(): void {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const pkg = require('../../package.json');
    console.log(`multi-provider-code-review v${pkg.version}`);
  }
}

/**
 * Main entry point when run from command line
 */
if (require.main === module) {
  const cli = new CLI();
  const args = process.argv.slice(2);

  cli.run(args).then(exitCode => {
    process.exit(exitCode);
  }).catch(error => {
    console.error('Fatal error:', error);
    process.exit(1);
  });
}
