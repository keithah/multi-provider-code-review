#!/usr/bin/env node
/**
 * Analytics CLI
 * Generate analytics dashboard and export metrics
 */

import { MetricsCollector } from '../analytics/metrics-collector';
import { DashboardGenerator } from '../analytics/dashboard-generator';
import { CacheStorage } from '../cache/storage';
import { logger } from '../utils/logger';
import { ConfigLoader } from '../config/loader';
import * as path from 'path';

interface AnalyticsOptions {
  output?: string;
  format?: 'html' | 'csv' | 'json';
  days?: number;
}

async function generateAnalytics(options: AnalyticsOptions = {}): Promise<void> {
  const {
    output = './reports',
    format = 'html',
    days = 30,
  } = options;

  try {
    logger.info('Generating analytics dashboard...');

    const config = ConfigLoader.load();
    const cacheStorage = new CacheStorage();
    const metricsCollector = new MetricsCollector(cacheStorage, config);
    const dashboardGenerator = new DashboardGenerator(metricsCollector);

    // Ensure output directory exists
    const fs = await import('fs/promises');
    await fs.mkdir(output, { recursive: true });

    // Generate output based on format
    if (format === 'html') {
      const outputPath = path.join(output, 'analytics-dashboard.html');
      await dashboardGenerator.saveDashboard(outputPath);
      logger.info(`HTML dashboard generated: ${outputPath}`);
    } else if (format === 'csv') {
      const outputPath = path.join(output, 'analytics-export.csv');
      await dashboardGenerator.saveCSV(outputPath);
      logger.info(`CSV export generated: ${outputPath}`);
    } else if (format === 'json') {
      const fromTimestamp = Date.now() - days * 24 * 60 * 60 * 1000;
      const metrics = await metricsCollector.getMetrics(fromTimestamp);
      const outputPath = path.join(output, 'analytics-metrics.json');

      await fs.writeFile(outputPath, JSON.stringify(metrics, null, 2), 'utf8');
      logger.info(`JSON metrics generated: ${outputPath}`);
    }

    logger.info('Analytics generation complete');
  } catch (error) {
    logger.error('Failed to generate analytics', error as Error);
    process.exit(1);
  }
}

/**
 * Print summary statistics to console
 */
async function printSummary(days: number = 30): Promise<void> {
  try {
    const config = ConfigLoader.load();
    const cacheStorage = new CacheStorage();
    const metricsCollector = new MetricsCollector(cacheStorage, config);

    const fromTimestamp = Date.now() - days * 24 * 60 * 60 * 1000;
    const metrics = await metricsCollector.getMetrics(fromTimestamp);
    const costTrends = await metricsCollector.getCostTrends(days);
    const providerStats = await metricsCollector.getProviderStats();
    const roi = await metricsCollector.calculateROI();

    console.log('\n=== Analytics Summary ===\n');
    console.log(`Total Reviews: ${metrics.length}`);
    console.log(`Total Cost: $${costTrends.reduce((sum, day) => sum + day.cost, 0).toFixed(2)}`);
    console.log(`Average Cost per Review: $${metrics.length > 0 ? (costTrends.reduce((sum, day) => sum + day.cost, 0) / metrics.length).toFixed(4) : '0.0000'}`);
    console.log(`Total Findings: ${metrics.reduce((sum, m) => sum + m.findingsCount, 0)}`);
    console.log(`Cache Hit Rate: ${(metrics.filter(m => m.cacheHit).length / Math.max(metrics.length, 1) * 100).toFixed(1)}%`);
    console.log(`\nROI:`);
    console.log(`  Total Cost: $${roi.totalCost.toFixed(2)}`);
    console.log(`  Estimated Time Saved: ${roi.estimatedTimeSaved.toFixed(0)} minutes (${(roi.estimatedTimeSaved / 60).toFixed(1)} hours)`);
    console.log(`  ROI: ${roi.roi.toFixed(0)}%`);
    console.log(`\nTop Providers:`);
    providerStats.slice(0, 5).forEach((p, i) => {
      console.log(`  ${i + 1}. ${p.provider}: ${p.totalReviews} reviews, ${(p.successRate * 100).toFixed(1)}% success`);
    });
    console.log('');
  } catch (error) {
    logger.error('Failed to print summary', error as Error);
    process.exit(1);
  }
}

/**
 * Safely parse and validate days value
 * Returns a valid positive integer or the default value
 */
function parseDays(value: string | undefined, defaultDays: number = 30): number {
  if (!value) {
    return defaultDays;
  }

  const parsed = parseInt(value, 10);

  // Check for NaN, negative, or zero
  if (isNaN(parsed) || parsed <= 0) {
    logger.warn(`Invalid days value: "${value}". Using default: ${defaultDays}`);
    return defaultDays;
  }

  // Reasonable maximum to prevent excessive data processing
  const MAX_DAYS = 365;
  if (parsed > MAX_DAYS) {
    logger.warn(`Days value ${parsed} exceeds maximum ${MAX_DAYS}. Using maximum.`);
    return MAX_DAYS;
  }

  return parsed;
}

/**
 * CLI entry point
 */
async function main() {
  const args = process.argv.slice(2);
  const command = args[0];

  if (command === 'summary') {
    const days = parseDays(args[1], 30);
    await printSummary(days);
    return;
  }

  if (command === 'generate') {
    const options: AnalyticsOptions = {
      output: './reports',
      format: 'html',
      days: 30,
    };

    for (let i = 1; i < args.length; i++) {
      if (args[i] === '--output' || args[i] === '-o') {
        if (i + 1 >= args.length) {
          logger.error('--output requires a value');
          process.exit(1);
        }
        options.output = args[++i];
      } else if (args[i] === '--format' || args[i] === '-f') {
        if (i + 1 >= args.length) {
          logger.error('--format requires a value');
          process.exit(1);
        }
        const format = args[++i];
        if (format !== 'html' && format !== 'csv' && format !== 'json') {
          logger.error(`Invalid format "${format}". Must be one of: html, csv, json`);
          process.exit(1);
        }
        options.format = format as 'html' | 'csv' | 'json';
      } else if (args[i] === '--days' || args[i] === '-d') {
        if (i + 1 >= args.length) {
          logger.error('--days requires a value');
          process.exit(1);
        }
        options.days = parseDays(args[++i], 30);
      }
    }

    await generateAnalytics(options);
    return;
  }

  // Default: show help
  console.log(`
Analytics CLI

Usage:
  analytics summary [days]              Show summary statistics
  analytics generate [options]          Generate analytics dashboard

Options:
  -o, --output <dir>                    Output directory (default: ./reports)
  -f, --format <html|csv|json>          Output format (default: html)
  -d, --days <number>                   Days of data to include (default: 30)

Examples:
  analytics summary                     Show last 30 days summary
  analytics summary 7                   Show last 7 days summary
  analytics generate                    Generate HTML dashboard
  analytics generate -f csv             Generate CSV export
  analytics generate -f json -d 7       Generate JSON for last 7 days
`);
}

if (require.main === module) {
  main().catch(error => {
    console.error('Fatal error:', error);
    process.exit(1);
  });
}

export { generateAnalytics, printSummary };
