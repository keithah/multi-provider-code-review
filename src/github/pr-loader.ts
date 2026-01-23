import { GitHubClient } from './client';
import { FileChange, PRContext } from '../types';
import { logger } from '../utils/logger';

export class PullRequestLoader {
  constructor(private readonly client: GitHubClient) {}

  async load(prNumber: number): Promise<PRContext> {
    const { octokit, owner, repo } = this.client;

    const prResponse = await octokit.rest.pulls.get({ owner, repo, pull_number: prNumber });
    const pr = prResponse.data;

    const files: FileChange[] = [];
    let page = 1;
    const per_page = 100;
    let hasMore = true;

    while (hasMore) {
      const res = await octokit.rest.pulls.listFiles({ owner, repo, pull_number: prNumber, page, per_page });
      files.push(
        ...res.data.map(file => ({
          filename: file.filename,
          status: (file.status as FileChange['status']) || 'modified',
          additions: file.additions,
          deletions: file.deletions,
          changes: file.changes,
          patch: file.patch || undefined,
          previousFilename: file.previous_filename || undefined,
        }))
      );
      hasMore = res.data.length === per_page;
      page += 1;
      if (files.length > 500) {
        logger.warn(`PR #${prNumber} has more than 500 files; further file fetching skipped for safety.`);
        break;
      }
    }

    const diff = await this.fetchDiff(owner, repo, prNumber);

    return {
      number: pr.number,
      title: pr.title || '',
      body: pr.body || '',
      author: pr.user?.login || 'unknown',
      draft: Boolean(pr.draft),
      labels: (pr.labels || []).map(label => (typeof label === 'string' ? label : label.name || '')),
      files,
      diff,
      additions: pr.additions || 0,
      deletions: pr.deletions || 0,
      baseSha: pr.base?.sha || '',
      headSha: pr.head?.sha || '',
    };
  }

  private async fetchDiff(owner: string, repo: string, prNumber: number): Promise<string> {
    const { octokit } = this.client;
    const res = await octokit.request('GET /repos/{owner}/{repo}/pulls/{pull_number}', {
      owner,
      repo,
      pull_number: prNumber,
      headers: { accept: 'application/vnd.github.v3.diff' },
    });
    return typeof res.data === 'string' ? res.data : '';
  }
}
