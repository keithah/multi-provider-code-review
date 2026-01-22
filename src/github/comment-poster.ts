import { InlineComment, FileChange } from '../types';
import { GitHubClient } from './client';
import { logger } from '../utils/logger';
import { mapLinesToPositions } from '../utils/diff';

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

    const { octokit, owner, repo } = this.client;
    await octokit.rest.pulls.createReview({
      owner,
      repo,
      pull_number: prNumber,
      event: 'COMMENT',
      comments: apiComments,
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
