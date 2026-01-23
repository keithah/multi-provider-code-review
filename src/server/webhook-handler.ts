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
}

export class WebhookHandler {
  constructor(
    private readonly config: WebhookConfig,
    private readonly orchestrator: ReviewOrchestrator
  ) {}

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
      throw error;
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
   * Parse and validate webhook payload
   */
  static parsePayload(body: string): WebhookPayload {
    try {
      const payload = JSON.parse(body);

      // Basic validation
      if (typeof payload.action !== 'string') {
        throw new Error('Missing or invalid action');
      }

      return payload as WebhookPayload;
    } catch (error) {
      logger.error('Failed to parse webhook payload', error as Error);
      throw new Error('Invalid webhook payload');
    }
  }
}
