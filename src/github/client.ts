import * as core from '@actions/core';
import * as github from '@actions/github';
import { Octokit } from '@octokit/rest';

export class GitHubClient {
  public readonly octokit: Octokit;
  public readonly owner: string;
  public readonly repo: string;

  constructor(token: string) {
    this.octokit = github.getOctokit(token) as unknown as Octokit;
    const repoEnv = process.env.GITHUB_REPOSITORY || github.context.repo.owner + '/' + github.context.repo.repo;
    const [owner, repo] = repoEnv.split('/');
    this.owner = owner;
    this.repo = repo;

    core.debug(`GitHub client initialized for ${owner}/${repo}`);
  }
}
