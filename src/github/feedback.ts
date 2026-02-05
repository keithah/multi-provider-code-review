import { InlineComment } from '../types';
import { GitHubClient } from './client';
import { logger } from '../utils/logger';
import { ProviderWeightTracker } from '../learning/provider-weights';

export class FeedbackFilter {
  constructor(
    private readonly client: GitHubClient,
    private readonly providerWeightTracker?: ProviderWeightTracker
  ) {}

  async loadSuppressed(prNumber: number): Promise<Set<string>> {
    const { octokit, owner, repo } = this.client;
    const suppressed = new Set<string>();

    try {
      const comments = await octokit.paginate(octokit.rest.pulls.listReviewComments, {
        owner,
        repo,
        pull_number: prNumber,
        per_page: 100,
      });

      for (const comment of comments) {
        try {
          const reactions = await octokit.rest.reactions.listForPullRequestReviewComment({
            owner,
            repo,
            comment_id: comment.id,
            per_page: 100,
          });
          const hasThumbsDown = reactions.data.some(r => r.content === '-1');
          if (hasThumbsDown) {
            const signature = this.signatureFromComment(comment.path, comment.line, comment.body || '');
            suppressed.add(signature);

            // Record negative feedback if weight tracker available
            if (this.providerWeightTracker) {
              const providerMatch = comment.body?.match(/\*\*Provider:\*\* `([^`]+)`/);
              const provider = providerMatch?.[1];
              if (provider) {
                await this.providerWeightTracker.recordFeedback(provider, '👎');
              }
            }
          }
        } catch (error) {
          logger.warn(`Failed to load reactions for comment ${comment.id}`, error as Error);
        }
      }
    } catch (error) {
      logger.warn('Failed to load review comments for feedback filter', error as Error);
    }

    return suppressed;
  }

  shouldPost(comment: InlineComment, suppressed: Set<string>): boolean {
    const signature = this.signatureFromComment(comment.path, comment.line, comment.body);
    return !suppressed.has(signature);
  }

  private signatureFromComment(path: string | undefined, line: number | null | undefined, body: string): string {
    const titleMatch = body.match(/\*\*(.+?)\*\*/);
    const title = titleMatch ? titleMatch[1] : (body.split('\n')[0] || 'unknown');
    return `${(path || 'unknown').toLowerCase()}:${line ?? 0}:${title.toLowerCase()}`;
  }
}
