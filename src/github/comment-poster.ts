import { InlineComment, FileChange } from '../types';
import { GitHubClient } from './client';
import { logger } from '../utils/logger';
import { mapLinesToPositions } from '../utils/diff';
import { withRetry } from '../utils/retry';

export class CommentPoster {
  private static readonly MAX_COMMENT_SIZE = 60_000;
  private static readonly BOT_COMMENT_MARKER = '<!-- multi-provider-code-review-bot -->';

  constructor(
    private readonly client: GitHubClient,
    private readonly dryRun: boolean = false
  ) {}

  async postSummary(prNumber: number, body: string, updateExisting = true): Promise<void> {
    const chunks = this.chunk(body);

    if (this.dryRun) {
      logger.info(`[DRY RUN] Would post ${chunks.length} summary comment(s) to PR #${prNumber}`);
      for (let i = 0; i < chunks.length; i++) {
        const header = chunks.length > 1 ? `## Review Summary (Part ${i + 1}/${chunks.length})\n\n` : '';
        const content = header + chunks[i];
        logger.info(`[DRY RUN] Summary comment ${i + 1}:\n${content.substring(0, 500)}...`);
      }
      return;
    }

    const { octokit, owner, repo } = this.client;

    // Try to find and update existing comment if incremental review
    if (updateExisting) {
      const existingComment = await this.findBotComment(prNumber);
      if (existingComment) {
        logger.info(`Found existing review comment ${existingComment.id}, updating it`);
        const markedBody = CommentPoster.BOT_COMMENT_MARKER + '\n\n' + chunks[0];
        await withRetry(
          () => octokit.rest.issues.updateComment({
            owner,
            repo,
            comment_id: existingComment.id,
            body: markedBody,
          }),
          { retries: 2, minTimeout: 1000, maxTimeout: 5000 }
        );
        return;
      }
    }

    // Create new comment(s)
    for (let i = 0; i < chunks.length; i++) {
      const header = chunks.length > 1 ? `## Review Summary (Part ${i + 1}/${chunks.length})\n\n` : '';
      const markedBody = CommentPoster.BOT_COMMENT_MARKER + '\n\n' + header + chunks[i];
      await withRetry(
        () => octokit.rest.issues.createComment({ owner, repo, issue_number: prNumber, body: markedBody }),
        { retries: 2, minTimeout: 1000, maxTimeout: 5000 }
      );
      if (i < chunks.length - 1) {
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }
  }

  /**
   * Find the bot's review comment on a PR
   */
  private async findBotComment(prNumber: number): Promise<{ id: number; body: string } | null> {
    const { octokit, owner, repo } = this.client;

    try {
      const comments = await withRetry(
        () => octokit.rest.issues.listComments({ owner, repo, issue_number: prNumber, per_page: 100 }),
        { retries: 2, minTimeout: 1000, maxTimeout: 5000 }
      );

      // Find comment with our marker
      for (const comment of comments.data) {
        if (comment.body?.includes(CommentPoster.BOT_COMMENT_MARKER)) {
          return { id: comment.id, body: comment.body };
        }
      }

      return null;
    } catch (error) {
      logger.warn('Failed to find existing bot comment', error as Error);
      return null;
    }
  }

  async postInline(prNumber: number, comments: InlineComment[], files: FileChange[]): Promise<void> {
    if (comments.length === 0) return;

    // Build a map from file path to line->position mapping
    const positionMaps = new Map<string, Map<number, number>>();
    for (const file of files) {
      positionMaps.set(file.filename, mapLinesToPositions(file.patch));
    }

    // Convert comments to GitHub API format, filtering out those without valid positions
    const apiComments = comments
      .map(c => {
        const posMap = positionMaps.get(c.path);
        const position = posMap?.get(c.line);
        if (!position) {
          logger.warn(`Cannot find diff position for ${c.path}:${c.line}, skipping inline comment`);
          return null;
        }
        return { path: c.path, position, body: c.body };
      })
      .filter((c): c is { path: string; position: number; body: string } => c !== null);

    if (apiComments.length === 0) {
      logger.info('No inline comments with valid diff positions to post');
      return;
    }

    if (this.dryRun) {
      logger.info(`[DRY RUN] Would post ${apiComments.length} inline comment(s) to PR #${prNumber}`);
      for (const comment of apiComments) {
        logger.info(`[DRY RUN] Inline comment at ${comment.path}:${comment.position}:\n${comment.body.substring(0, 200)}...`);
      }
      return;
    }

    const { octokit, owner, repo } = this.client;
    await withRetry(
      () => octokit.rest.pulls.createReview({
        owner,
        repo,
        pull_number: prNumber,
        event: 'COMMENT',
        comments: apiComments,
      }),
      { retries: 2, minTimeout: 1000, maxTimeout: 5000 }
    );
  }

  private chunk(content: string): string[] {
    const paragraphs = content.split('\n\n');
    const chunks: string[] = [];
    let current = '';

    for (const para of paragraphs) {
      if (Buffer.byteLength(current + para, 'utf8') > CommentPoster.MAX_COMMENT_SIZE) {
        if (current) {
          chunks.push(current.trim());
          current = '';
        }
        if (Buffer.byteLength(para, 'utf8') > CommentPoster.MAX_COMMENT_SIZE) {
          const lines = para.split('\n');
          let lineChunk = '';
          for (const line of lines) {
            if (Buffer.byteLength(lineChunk + line + '\n', 'utf8') > CommentPoster.MAX_COMMENT_SIZE) {
              chunks.push(lineChunk.trim());
              lineChunk = '';
            }
            lineChunk += line + '\n';
          }
          current = lineChunk + '\n\n';
        } else {
          current = para + '\n\n';
        }
      } else {
        current += para + '\n\n';
      }
    }

    if (current.trim()) chunks.push(current.trim());
    logger.info(`Prepared ${chunks.length} comment chunk(s)`);
    return chunks;
  }
}
