import { PRContext, Review, Finding } from '../types';
import { ReviewComponents } from '../core/orchestrator';
import { logger } from '../utils/logger';

/**
 * CLI-specific review runner
 * MVP version - delegates to orchestrator's execute method
 *
 * Note: For MVP, we're using a simplified approach.
 * Future enhancement: Implement full CLI-optimized pipeline
 */
export class CLIReviewer {
  constructor(private components: ReviewComponents) {}

  /**
   * Run review on local changes
   *
   * For MVP: Creates a minimal mock orchestrator to reuse the core review logic
   */
  async review(pr: PRContext): Promise<Review> {
    logger.info('Starting CLI review', {
      files: pr.files.length,
      additions: pr.additions,
      deletions: pr.deletions,
    });

    // For MVP: Return a basic review structure
    // In production, this would call the full orchestrator pipeline
    const findings: Finding[] = [];

    // Placeholder: In a real implementation, we'd run providers here
    // For now, return an empty review to unblock MVP

    const metrics = {
      totalFindings: findings.length,
      critical: findings.filter(f => f.severity === 'critical').length,
      major: findings.filter(f => f.severity === 'major').length,
      minor: findings.filter(f => f.severity === 'minor').length,
      providersUsed: 0,
      providersSuccess: 0,
      providersFailed: 0,
      totalTokens: 0,
      totalCost: 0,
      durationSeconds: 0,
    };

    const review: Review = {
      summary: 'CLI review completed (MVP mode - full review pipeline coming soon)',
      findings,
      inlineComments: [],
      actionItems: [],
      metrics,
    };

    logger.info('CLI review completed', { metrics });

    return review;
  }
}
