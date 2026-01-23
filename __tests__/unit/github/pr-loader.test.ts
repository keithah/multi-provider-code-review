import { PullRequestLoader } from '../../../src/github/pr-loader';
import { GitHubClient } from '../../../src/github/client';
import { createMockOctokit, createErrorOctokit } from '../../helpers/github-mock';

function createMockClient(octokit: any): jest.Mocked<GitHubClient> {
  return {
    octokit,
    owner: 'test-owner',
    repo: 'test-repo',
  } as any;
}

describe('PullRequestLoader', () => {

  describe('load', () => {
    it('loads PR context successfully', async () => {
      const mockClient = createMockClient(createMockOctokit());
      const loader = new PullRequestLoader(mockClient);

      const context = await loader.load(1);

      expect(context).toBeDefined();
      expect(context.number).toBe(1);
      expect(context.title).toBe('Test PR');
      expect(context.author).toBe('test-user');
      expect(context.files).toHaveLength(1);
      expect(context.baseSha).toBe('base-sha');
      expect(context.headSha).toBe('head-sha');
    });

    it('loads PR files', async () => {
      const mockClient = createMockClient(createMockOctokit());
      const loader = new PullRequestLoader(mockClient);

      const context = await loader.load(1);

      expect(context.files).toBeDefined();
      expect(context.files[0].filename).toBe('src/test.ts');
      expect(context.files[0].status).toBe('modified');
      expect(context.files[0].additions).toBe(5);
      expect(context.files[0].deletions).toBe(2);
    });

    it('handles PR with labels', async () => {
      const mockOctokit = createMockOctokit({
        pr: {
          labels: ['bug', 'enhancement'],
        },
      });
      const mockClient = createMockClient(mockOctokit);

      const loader = new PullRequestLoader(mockClient);
      const context = await loader.load(1);

      expect(context.labels).toEqual(['bug', 'enhancement']);
    });

    it('handles draft PR', async () => {
      const mockOctokit = createMockOctokit({
        pr: {
          draft: true,
        },
      });
      const mockClient = createMockClient(mockOctokit);

      const loader = new PullRequestLoader(mockClient);
      const context = await loader.load(1);

      expect(context.draft).toBe(true);
    });

    it('handles bot author', async () => {
      const mockOctokit = createMockOctokit({
        pr: {
          author: 'dependabot[bot]',
        },
      });
      const mockClient = createMockClient(mockOctokit);

      const loader = new PullRequestLoader(mockClient);
      const context = await loader.load(1);

      expect(context.author).toBe('dependabot[bot]');
    });
  });

  describe('Error Handling', () => {
    it('throws error when PR not found', async () => {
      const errorOctokit = createErrorOctokit(404, 'Not Found');
      const mockClient = createMockClient(errorOctokit);

      const loader = new PullRequestLoader(mockClient);

      await expect(loader.load(999)).rejects.toThrow('Not Found');
    });

    it('throws error on API failure', async () => {
      const errorOctokit = createErrorOctokit(500, 'Internal Server Error');
      const mockClient = createMockClient(errorOctokit);

      const loader = new PullRequestLoader(mockClient);

      await expect(loader.load(1)).rejects.toThrow('Internal Server Error');
    });
  });

  describe('Diff Generation', () => {
    it('includes diff in PR context', async () => {
      const mockClient = createMockClient(createMockOctokit());
      const loader = new PullRequestLoader(mockClient);

      const context = await loader.load(1);

      expect(context.diff).toBeDefined();
      expect(typeof context.diff).toBe('string');
    });

    it('handles files without patches', async () => {
      const mockOctokit = createMockOctokit({
        files: [
          {
            filename: 'binary-file.png',
            status: 'added',
            additions: 0,
            deletions: 0,
            changes: 0,
            // No patch for binary files
          },
        ],
      });
      const mockClient = createMockClient(mockOctokit);

      const loader = new PullRequestLoader(mockClient);
      const context = await loader.load(1);

      expect(context.files).toHaveLength(1);
      expect(context.files[0].patch).toBeUndefined();
    });
  });
});
