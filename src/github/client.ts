import * as core from '@actions/core';
import * as github from '@actions/github';
import { Octokit } from '@octokit/rest';

export class GitHubClient {
  public readonly octokit: Octokit;
  public readonly owner: string;
  public readonly repo: string;

  constructor(token: string) {
    this.octokit = github.getOctokit(token) as unknown as Octokit;

    // Try to get repository from environment or GitHub context
    let repoEnv = process.env.GITHUB_REPOSITORY;
    if (!repoEnv) {
      try {
        repoEnv = `${github.context.repo.owner}/${github.context.repo.repo}`;
      } catch {
        // If GitHub context is not available, use empty strings
        repoEnv = '/';
      }
    }

    const [owner, repo] = repoEnv.split('/');
    this.owner = owner || '';
    this.repo = repo || '';

    core.debug(`GitHub client initialized for ${this.owner}/${this.repo}`);
  }

  /**
   * Fetch file content from a specific ref (commit SHA, branch, or tag)
   * @param filePath - Path to the file in the repository
   * @param ref - Git ref (commit SHA, branch name, or tag)
   * @returns File content as string, or null if file doesn't exist/inaccessible
   */
  async getFileContent(filePath: string, ref: string): Promise<string | null> {
    try {
      const response = await this.octokit.rest.repos.getContent({
        owner: this.owner,
        repo: this.repo,
        path: filePath,
        ref,
      });

      // Check if the response is a file (not a directory)
      if ('content' in response.data && !Array.isArray(response.data)) {
        // Handle empty content or encoding "none" for large files
        if (!response.data.content || response.data.content === '' || response.data.encoding === 'none') {
          // File is empty or too large
          core.debug(`File content empty or encoding 'none': ${filePath}`);
          return '';
        }
        // Content is base64 encoded
        return Buffer.from(response.data.content, 'base64').toString('utf-8');
      }

      return null;
    } catch (error) {
      const err = error as { status?: number };
      if (err.status === 404) {
        // File not found - this is expected for new files in PRs
        core.debug(`File not found: ${filePath} at ref ${ref}`);
        return null;
      }
      // Log other errors but don't throw - gracefully degrade
      core.warning(`Failed to fetch file content for ${filePath}: ${(error as Error).message}`);
      return null;
    }
  }
}
