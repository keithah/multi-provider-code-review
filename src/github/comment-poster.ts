import { InlineComment } from '../types';
import { GitHubClient } from './client';
import { logger } from '../utils/logger';

export class CommentPoster {
  private static readonly MAX_COMMENT_SIZE = 60_000;

  constructor(private readonly client: GitHubClient) {}

  async postSummary(prNumber: number, body: string): Promise<void> {
    const chunks = this.chunk(body);
    const { octokit, owner, repo } = this.client;

    for (let i = 0; i < chunks.length; i++) {
      const header = chunks.length > 1 ? `## Review Summary (Part ${i + 1}/${chunks.length})\n\n` : '';
      const content = header + chunks[i];
      await octokit.rest.issues.createComment({ owner, repo, issue_number: prNumber, body: content });
      if (i < chunks.length - 1) {
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }
  }

  async postInline(prNumber: number, comments: InlineComment[]): Promise<void> {
    if (comments.length === 0) return;
    const { octokit, owner, repo } = this.client;

    await octokit.rest.pulls.createReview({
      owner,
      repo,
      pull_number: prNumber,
      event: 'COMMENT',
      comments: comments.map(c => ({ path: c.path, line: c.line, side: c.side, body: c.body })),
    });
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
          current = lineChunk;
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
