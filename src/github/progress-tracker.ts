import { Octokit } from '@octokit/rest';
import { logger } from '../utils/logger';

export type ProgressStatus = 'pending' | 'in_progress' | 'completed' | 'failed';

export interface ProgressItem {
  id: string;
  label: string;
  status: ProgressStatus;
  details?: string;
  startTime?: number;
  endTime?: number;
}

export interface ProgressTrackerConfig {
  owner: string;
  repo: string;
  prNumber: number;
  updateStrategy: 'milestone' | 'debounced' | 'realtime';
}

/**
 * Tracks and displays review progress in a live-updating PR comment
 *
 * Inspired by Claude Code Action's progress tracking approach:
 * - Single comment that updates throughout review
 * - Checkboxes show completion status
 * - Duration and cost metadata attached
 *
 * Update strategy: milestone-based (only major events to minimize API calls)
 */
export class ProgressTracker {
  private commentId: number | null = null;
  private items: Map<string, ProgressItem> = new Map();
  private startTime: number = Date.now();
  private totalCost: number = 0;
  private overrideBody?: string;

  constructor(
    private octokit: Octokit,
    private config: ProgressTrackerConfig
  ) {}

  /**
   * Initialize progress tracking by creating the initial comment
   */
  async initialize(): Promise<void> {
    if (!this.octokit?.rest?.issues?.createComment) {
      logger.warn('Progress tracker unavailable: octokit.rest.issues.createComment is missing');
      return;
    }
    try {
      const body = this.formatProgressComment();
      const comment = await this.octokit.rest.issues.createComment({
        owner: this.config.owner,
        repo: this.config.repo,
        issue_number: this.config.prNumber,
        body,
      });

      this.commentId = comment.data.id;
      logger.info('Progress tracker initialized', { commentId: this.commentId });
    } catch (error) {
      logger.error('Failed to initialize progress tracker', error as Error);
      // Continue without progress tracking rather than failing the review
    }
  }

  /**
   * Add a new progress item to track
   */
  addItem(id: string, label: string): void {
    this.items.set(id, {
      id,
      label,
      status: 'pending',
      startTime: Date.now(),
    });

    logger.debug(`Progress item added: ${id}`, { label });
  }

  /**
   * Update progress for a specific item
   * Only updates comment on milestone events (completed/failed)
   */
  async updateProgress(
    itemId: string,
    status: ProgressStatus,
    details?: string
  ): Promise<void> {
    const item = this.items.get(itemId);
    if (!item) {
      logger.warn(`Progress item not found: ${itemId}`);
      return;
    }

    item.status = status;
    item.details = details;

    if (status === 'completed' || status === 'failed') {
      item.endTime = Date.now();

      // Milestone-based update: only update comment on completion/failure
      await this.updateComment();
    }

    logger.debug(`Progress updated: ${itemId}`, { status, details });
  }

  /**
   * Set total cost for metadata display
   */
  setTotalCost(cost: number): void {
    this.totalCost = cost;
  }

  /**
   * Finalize progress tracking with summary
   */
  async finalize(success: boolean): Promise<void> {
    const duration = Date.now() - this.startTime;

    // Update all pending items to final status
    this.items.forEach((item) => {
      if (item.status === 'pending' || item.status === 'in_progress') {
        item.status = success ? 'completed' : 'failed';
        item.endTime = Date.now();
      }
    });

    if (!this.overrideBody) {
      await this.updateComment();
    }

    logger.info('Progress tracker finalized', {
      success,
      duration,
      totalCost: this.totalCost,
    });
  }

  /**
   * Format progress comment with checkboxes, status emojis, and metadata
   */
  private formatProgressComment(): string {
    const lines: string[] = [];

    // Header
    lines.push('## 🤖 Multi-Provider Code Review Progress\n');

    // Progress items with checkboxes
    const sortedItems = Array.from(this.items.values()).sort(
      (a, b) => (a.startTime || 0) - (b.startTime || 0)
    );

    for (const item of sortedItems) {
      const checkbox = item.status === 'completed' ? '[x]' : '[ ]';
      const emoji = this.getStatusEmoji(item.status);
      const duration = this.getDurationString(item);

      lines.push(`${checkbox} ${emoji} ${item.label}${duration}`);

      if (item.details) {
        lines.push(`   └─ ${item.details}`);
      }
    }

    // Metadata footer
    lines.push('\n---');

    const totalDuration = Date.now() - this.startTime;
    const durationStr = this.formatDuration(totalDuration);

    lines.push(`**Duration**: ${durationStr}`);

    if (this.totalCost > 0) {
      lines.push(`**Cost**: $${this.totalCost.toFixed(4)}`);
    }

    lines.push(`**Last updated**: ${new Date().toISOString()}`);
    lines.push('<!-- multi-provider-progress-tracker -->');

    return lines.join('\n');
  }

  /**
   * Update the progress comment (GitHub API call)
   */
  private async updateComment(): Promise<void> {
    if (!this.commentId) {
      logger.warn('Cannot update progress: comment not initialized');
      return;
    }
    if (!this.octokit?.rest?.issues?.updateComment) {
      logger.warn('Cannot update progress: octokit.rest.issues.updateComment is missing');
      return;
    }

    try {
      const body = this.overrideBody ?? this.formatProgressComment();

      await this.octokit.rest.issues.updateComment({
        owner: this.config.owner,
        repo: this.config.repo,
        comment_id: this.commentId,
        body,
      });

      logger.debug('Progress comment updated', { commentId: this.commentId });
    } catch (error) {
      logger.error('Failed to update progress comment', error as Error);
      // Don't throw - progress tracking failure shouldn't stop the review
    }
  }

  /**
   * Replace the progress comment with a final body (e.g., combined progress + review)
   */
  async replaceWith(body: string): Promise<void> {
    if (!this.commentId) {
      logger.warn('Cannot replace progress: comment not initialized');
      return;
    }
    if (!this.octokit?.rest?.issues?.updateComment) {
      logger.warn('Cannot replace progress: octokit.rest.issues.updateComment is missing');
      return;
    }
    this.overrideBody = body;
    await this.octokit.rest.issues.updateComment({
      owner: this.config.owner,
      repo: this.config.repo,
      comment_id: this.commentId,
      body,
    });
  }

  /**
   * Get status emoji for visual feedback
   */
  private getStatusEmoji(status: ProgressStatus): string {
    switch (status) {
      case 'completed':
        return '✅';
      case 'failed':
        return '❌';
      case 'in_progress':
        return '🔄';
      case 'pending':
        return '⏳';
      default:
        return '⬜';
    }
  }

  /**
   * Get duration string for an item
   */
  private getDurationString(item: ProgressItem): string {
    if (!item.endTime || !item.startTime) {
      return '';
    }

    const duration = item.endTime - item.startTime;
    return ` (${this.formatDuration(duration)})`;
  }

  /**
   * Format duration in human-readable format
   */
  private formatDuration(ms: number): string {
    if (ms < 1000) {
      return `${ms}ms`;
    } else if (ms < 60000) {
      return `${(ms / 1000).toFixed(1)}s`;
    } else {
      const minutes = Math.floor(ms / 60000);
      const seconds = Math.floor((ms % 60000) / 1000);
      return `${minutes}m ${seconds}s`;
    }
  }
}
