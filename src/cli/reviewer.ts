import { PRContext, Review } from '../types';
import { ReviewComponents, ReviewOrchestrator } from '../core/orchestrator';
import { logger } from '../utils/logger';

/**
 * CLI-specific review runner
 * Delegates to orchestrator for full review pipeline, but operates on
 * a PRContext object created from local git state rather than GitHub API
 */
export class CLIReviewer {
  private orchestrator: ReviewOrchestrator;

  constructor(components: ReviewComponents) {
    this.orchestrator = new ReviewOrchestrator(components);
  }

  /**
   * Run review on local changes
   * Uses the full review pipeline from orchestrator but skips GitHub-specific operations
   */
  async review(pr: PRContext): Promise<Review> {
    logger.info('Starting CLI review', {
      files: pr.files.length,
      additions: pr.additions,
      deletions: pr.deletions,
    });

    // Run the full review pipeline using orchestrator's internal logic
    // The orchestrator will handle:
    // - Incremental review checks
    // - Provider execution
    // - AST/security/rules analysis
    // - Consensus filtering
    // - Evidence scoring
    // - Impact analysis
    // - Synthesis
    //
    // Since we're in CLI mode with cliMode=true in setup, the commentPoster
    // is configured to skip GitHub API calls

    const review = await this.orchestrator.executeReview(pr);

    logger.info('CLI review completed', {
      findings: review.findings.length,
      critical: review.metrics.critical,
      major: review.metrics.major,
      minor: review.metrics.minor,
    });

    return review;
  }
}
