import { PRContext, Review, Finding } from '../types';
import { ReviewComponents } from '../core/orchestrator';
import { logger } from '../utils/logger';

/**
 * CLI-specific review runner
 * MVP version - delegates to orchestrator's execute method
 *
 * Note: For MVP, we're using a simplified approach.
 * Future enhancement: Implement full CLI-optimized pipeline
 *
 * TODO: Complete CLI review pipeline implementation
 *   - Connect to LLM providers
 *   - Run security scanner
 *   - Run AST analysis
 *   - Apply consensus filtering
 *   - Generate synthesis
 *   See src/core/orchestrator.ts:execute() for full pipeline
 */
export class CLIReviewer {
  constructor(private components: ReviewComponents) {}

  /**
   * Run review on local changes
   *
   * For MVP: Returns empty review structure
   * TODO: Implement full review pipeline (see orchestrator.ts for reference)
   */
  async review(pr: PRContext): Promise<Review> {
    logger.info('Starting CLI review', {
      files: pr.files.length,
      additions: pr.additions,
      deletions: pr.deletions,
    });

    // TODO: Replace with actual review pipeline
    // Current status: MVP skeleton for CLI infrastructure
    // Next step: Wire up components from ReviewComponents
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
