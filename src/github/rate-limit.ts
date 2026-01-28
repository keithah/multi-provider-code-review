import { logger } from '../utils/logger';

export interface RateLimitStatus {
  limit: number;
  remaining: number;
  reset: number; // Unix timestamp
  used: number;
}

export class GitHubRateLimitTracker {
  private status: RateLimitStatus | null = null;

  /**
   * Update rate limit status from response headers
   */
  updateFromHeaders(headers: Record<string, string | undefined>): void {
    const limit = headers['x-ratelimit-limit'];
    const remaining = headers['x-ratelimit-remaining'];
    const reset = headers['x-ratelimit-reset'];
    const used = headers['x-ratelimit-used'];

    if (limit && remaining && reset) {
      this.status = {
        limit: parseInt(limit, 10),
        remaining: parseInt(remaining, 10),
        reset: parseInt(reset, 10),
        used: used ? parseInt(used, 10) : 0,
      };

      logger.debug(
        `GitHub rate limit: ${this.status.remaining}/${this.status.limit} remaining ` +
        `(resets at ${new Date(this.status.reset * 1000).toISOString()})`
      );

      if (this.status.remaining < 100) {
        logger.warn(
          `GitHub API rate limit low: ${this.status.remaining} requests remaining`
        );
      }

      if (this.status.remaining === 0) {
        const resetTime = new Date(this.status.reset * 1000);
        const waitSeconds = Math.ceil((this.status.reset * 1000 - Date.now()) / 1000);
        logger.error(
          `GitHub API rate limit exceeded. Resets at ${resetTime.toISOString()} ` +
          `(in ${waitSeconds} seconds)`
        );
      }
    }
  }

  /**
   * Get current rate limit status
   */
  getStatus(): RateLimitStatus | null {
    return this.status;
  }

  /**
   * Check if we're approaching rate limit (< 10% remaining)
   */
  isApproachingLimit(): boolean {
    if (!this.status) return false;
    const percentRemaining = (this.status.remaining / this.status.limit) * 100;
    return percentRemaining < 10;
  }

  /**
   * Check if rate limit is exceeded
   */
  isExceeded(): boolean {
    if (!this.status) return false;
    return this.status.remaining === 0;
  }

  /**
   * Calculate wait time until rate limit resets (in milliseconds)
   */
  getWaitTimeMs(): number {
    if (!this.status) return 0;
    const now = Date.now();
    const resetMs = this.status.reset * 1000;
    return Math.max(0, resetMs - now);
  }

  /**
   * Wait for rate limit to reset
   */
  async waitForReset(): Promise<void> {
    if (!this.isExceeded()) return;

    const waitMs = this.getWaitTimeMs();
    if (waitMs === 0) return;

    logger.info(`Waiting ${Math.ceil(waitMs / 1000)} seconds for GitHub rate limit to reset...`);
    await new Promise(resolve => setTimeout(resolve, waitMs + 1000)); // Add 1s buffer
  }
}
