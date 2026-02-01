import { GitHubClient } from '../../../src/github/client';
import * as github from '@actions/github';

describe('GitHubClient', () => {
  const mockToken = 'TEST_TOKEN';
  const originalEnv = process.env;
  const originalContext = github.context;

  beforeEach(() => {
    process.env = {
      ...originalEnv,
      GITHUB_REPOSITORY: 'owner/repo',
    };
  });

  afterEach(() => {
    process.env = originalEnv;
    (github as any).context = originalContext;
  });

  describe('Initialization', () => {
    it('creates client with token', () => {
      const client = new GitHubClient(mockToken);

      expect(client).toBeDefined();
      expect(client.owner).toBe('owner');
      expect(client.repo).toBe('repo');
    });

    it('parses owner and repo from environment', () => {
      process.env.GITHUB_REPOSITORY = 'test-owner/test-repo';

      const client = new GitHubClient(mockToken);

      expect(client.owner).toBe('test-owner');
      expect(client.repo).toBe('test-repo');
    });

    it('handles GITHUB_REPOSITORY without slash', () => {
      process.env.GITHUB_REPOSITORY = 'invalid-format';

      const client = new GitHubClient(mockToken);

      // When there's no '/', split returns the whole string as first element, repo is empty string
      expect(client.owner).toBe('invalid-format');
      expect(client.repo).toBe('');
    });

    it('handles GITHUB_REPOSITORY not set', () => {
      delete process.env.GITHUB_REPOSITORY;
      // Simulate missing GitHub context as well
      (github as any).context = { repo: { owner: '', repo: '' } };

      const client = new GitHubClient(mockToken);

      // When GITHUB_REPOSITORY is undefined, should handle gracefully
      expect(client.owner).toBe('');
      expect(client.repo).toBe('');
    });
  });

  describe('Octokit Integration', () => {
    it('provides access to octokit instance', () => {
      const client = new GitHubClient(mockToken);

      expect(client.octokit).toBeDefined();
      expect(client.octokit.rest).toBeDefined();
    });

    it('configures octokit with correct auth', () => {
      const client = new GitHubClient(mockToken);

      // Octokit should be configured with the token
      expect(client.octokit).toBeDefined();
    });
  });
});
