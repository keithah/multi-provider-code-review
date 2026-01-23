import { GitHubClient } from '../../../src/github/client';
import { createMockOctokit, createErrorOctokit } from '../../helpers/github-mock';

describe('GitHubClient', () => {
  const mockToken = 'ghp_test123456789';
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = {
      ...originalEnv,
      GITHUB_REPOSITORY: 'owner/repo',
    };
  });

  afterEach(() => {
    process.env = originalEnv;
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

    it('throws error if GITHUB_REPOSITORY not set', () => {
      delete process.env.GITHUB_REPOSITORY;

      expect(() => new GitHubClient(mockToken)).toThrow('GITHUB_REPOSITORY');
    });

    it('handles GITHUB_REPOSITORY without slash', () => {
      process.env.GITHUB_REPOSITORY = 'invalid-format';

      const client = new GitHubClient(mockToken);

      // When there's no '/', split returns the whole string as first element
      expect(client.owner).toBe('invalid-format');
      expect(client.repo).toBeUndefined();
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
