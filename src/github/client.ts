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
    this.repo = repo;

    core.debug(`GitHub client initialized for ${owner}/${repo}`);
  }
}
