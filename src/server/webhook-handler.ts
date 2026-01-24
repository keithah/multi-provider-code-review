/**
 * GitHub Webhook Handler
 * Receives and processes GitHub webhook events for automated code reviews
 */

import { createHmac } from 'crypto';
import { logger } from '../utils/logger';
import { ReviewOrchestrator } from '../core/orchestrator';

export interface WebhookPayload {
  action: string;
  number: number;
  pull_request?: {
    number: number;
    title: string;
    body: string | null;
    user: { login: string };
    draft: boolean;
    labels: Array<{ name: string }>;
    base: { sha: string };
    head: { sha: string };
  };
}

export interface WebhookConfig {
  secret: string;
  autoReviewOnOpen?: boolean;
  autoReviewOnSync?: boolean;
  autoReviewOnReopen?: boolean;
  rateLimitPerMinute?: number; // Max reviews per minute (default: 10)
  rateLimitPerPR?: number; // Max reviews per PR per hour (default: 5)
}

interface RateLimitEntry {
  count: number;
  resetTime: number;
}

export class WebhookHandler {
  private static readonly MIN_SECRET_LENGTH = 32;
  private readonly globalRateLimit = new Map<string, RateLimitEntry>();
  private readonly prRateLimit = new Map<number, RateLimitEntry>();

  constructor(
    private readonly config: WebhookConfig,
    private readonly orchestrator: ReviewOrchestrator
  ) {
    this.validateConfig();
    // Clean up old rate limit entries every 5 minutes
    setInterval(() => this.cleanupRateLimits(), 5 * 60 * 1000);
  }

  /**
   * Validate configuration on initialization
   */
  private validateConfig(): void {
    if (this.config.secret.length < WebhookHandler.MIN_SECRET_LENGTH) {
      throw new Error(
        `Webhook secret must be at least ${WebhookHandler.MIN_SECRET_LENGTH} characters. ` +
        `Current length: ${this.config.secret.length}. ` +
        `Generate a secure secret with: openssl rand -hex 32`
      );
    }
  }

  /**
   * Verify webhook signature using HMAC-SHA256
   */
  verifySignature(payload: string, signature: string): boolean {
    if (!signature || !signature.startsWith('sha256=')) {
      logger.warn('Invalid signature format');
      return false;
    }

    const expected = signature.substring(7);
    const hmac = createHmac('sha256', this.config.secret);
    hmac.update(payload, 'utf8');
    const calculated = hmac.digest('hex');

    // Use timing-safe comparison to prevent timing attacks
    if (calculated.length !== expected.length) {
      return false;
    }

    let mismatch = 0;
    for (let i = 0; i < calculated.length; i++) {
      mismatch |= calculated.charCodeAt(i) ^ expected.charCodeAt(i);
    }

    return mismatch === 0;
  }

  /**
   * Handle incoming webhook event
   */
  async handleEvent(event: string, payload: WebhookPayload): Promise<boolean> {
    logger.info(`Received webhook event: ${event} (action: ${payload.action})`);

    // Only process pull_request events
    if (event !== 'pull_request') {
      logger.debug(`Ignoring non-PR event: ${event}`);
      return false;
    }

    // Determine if we should trigger a review based on action
    const shouldReview = this.shouldTriggerReview(payload.action);
    if (!shouldReview) {
      logger.info(`Action ${payload.action} does not trigger review`);
      return false;
    }

    // Extract PR context from payload
    if (!payload.pull_request) {
      logger.error('Missing pull_request in payload');
      return false;
    }

    // Check rate limits before processing
    if (!this.checkRateLimits(payload.pull_request.number)) {
      logger.warn(`Rate limit exceeded for PR #${payload.pull_request.number}`);
      return false;
    }

    try {
      // Trigger review using orchestrator
      const review = await this.orchestrator.execute(payload.pull_request.number);

      if (!review) {
        logger.info(`Review skipped for PR #${payload.pull_request.number}`);
        return false;
      }

      logger.info(
        `Review completed for PR #${payload.pull_request.number}: ` +
        `${review.findings.length} findings, cost $${review.metrics.totalCost.toFixed(4)}`
      );
      return true;
    } catch (error) {
      logger.error(
        `Failed to process webhook for PR #${payload.pull_request.number}`,
        error as Error
      );
      // Don't throw - return false to keep server running
      return false;
    }
  }

  /**
   * Determine if action should trigger a review
   */
  private shouldTriggerReview(action: string): boolean {
    const {
      autoReviewOnOpen = true,
      autoReviewOnSync = true,
      autoReviewOnReopen = true,
    } = this.config;

    switch (action) {
      case 'opened':
        return autoReviewOnOpen;
      case 'synchronize':
        return autoReviewOnSync;
      case 'reopened':
        return autoReviewOnReopen;
      case 'ready_for_review':
        return true; // Always review when draft → ready
      default:
        return false;
    }
  }

  /**
   * Check if request is within rate limits
   */
  private checkRateLimits(prNumber: number): boolean {
    const now = Date.now();
    const rateLimitPerMinute = this.config.rateLimitPerMinute || 10;
    const rateLimitPerPR = this.config.rateLimitPerPR || 5;

    // Check global rate limit (per minute)
    const globalKey = 'global';
    const globalEntry = this.globalRateLimit.get(globalKey);

    if (globalEntry && now < globalEntry.resetTime) {
      if (globalEntry.count >= rateLimitPerMinute) {
        return false;
      }
      globalEntry.count++;
    } else {
      this.globalRateLimit.set(globalKey, {
        count: 1,
        resetTime: now + 60 * 1000, // 1 minute
      });
    }

    // Check per-PR rate limit (per hour)
    const prEntry = this.prRateLimit.get(prNumber);

    if (prEntry && now < prEntry.resetTime) {
      if (prEntry.count >= rateLimitPerPR) {
        return false;
      }
      prEntry.count++;
    } else {
      this.prRateLimit.set(prNumber, {
        count: 1,
        resetTime: now + 60 * 60 * 1000, // 1 hour
      });
    }

    return true;
  }

  /**
   * Clean up expired rate limit entries
   */
  private cleanupRateLimits(): void {
    const now = Date.now();

    for (const [key, entry] of this.globalRateLimit.entries()) {
      if (now >= entry.resetTime) {
        this.globalRateLimit.delete(key);
      }
    }

    for (const [pr, entry] of this.prRateLimit.entries()) {
      if (now >= entry.resetTime) {
        this.prRateLimit.delete(pr);
      }
    }
  }

  /**
   * Parse and validate webhook payload
   */
  static parsePayload(body: string): WebhookPayload {
    try {
      const payload = JSON.parse(body);

      // Validate required fields
      if (typeof payload.action !== 'string' || payload.action.trim() === '') {
        throw new Error('Missing or invalid action');
      }

      if (typeof payload.number !== 'number' || payload.number <= 0) {
        throw new Error('Missing or invalid number');
      }

      // Validate pull_request if present
      if (payload.pull_request) {
        const pr = payload.pull_request;

        if (typeof pr.number !== 'number' || pr.number <= 0) {
          throw new Error('Invalid pull_request.number');
        }

        if (typeof pr.title !== 'string') {
          throw new Error('Invalid pull_request.title');
        }

        if (pr.body !== null && typeof pr.body !== 'string') {
          throw new Error('Invalid pull_request.body');
        }

        if (!pr.user || typeof pr.user.login !== 'string') {
          throw new Error('Invalid pull_request.user.login');
        }

        if (typeof pr.draft !== 'boolean') {
          throw new Error('Invalid pull_request.draft');
        }

        if (!Array.isArray(pr.labels)) {
          throw new Error('Invalid pull_request.labels');
        }

        if (!pr.base || typeof pr.base.sha !== 'string') {
          throw new Error('Invalid pull_request.base.sha');
        }

        if (!pr.head || typeof pr.head.sha !== 'string') {
          throw new Error('Invalid pull_request.head.sha');
        }
      }

      return payload as WebhookPayload;
    } catch (error) {
      logger.error('Failed to parse webhook payload', error as Error);
      throw new Error(`Invalid webhook payload: ${(error as Error).message}`);
    }
  }
}
