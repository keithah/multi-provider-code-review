/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * GitHub API mock helpers for testing
 * Provides consistent mocking of Octokit GitHub API
 */

import { PRContext, FileChange } from '../../src/types';

export interface MockOctokitOptions {
  pr?: Partial<PRContext>;
  files?: FileChange[];
  createCommentSuccess?: boolean;
  createReviewSuccess?: boolean;
  rateLimitRemaining?: number;
}

/**
 * Creates a mock Octokit client for testing
 */
export function createMockOctokit(options: MockOctokitOptions = {}): any {
  const {
    pr = {
      number: 1,
      title: 'Test PR',
      body: 'Test description',
      draft: false,
      labels: [],
      additions: 10,
      deletions: 5,
      baseSha: 'base-sha',
      headSha: 'head-sha',
      author: 'test-user',
    },
    files = [
      {
        filename: 'src/test.ts',
        status: 'modified' as const,
        additions: 5,
        deletions: 2,
        changes: 7,
        patch: '@@ -8,3 +8,4 @@\n line8\n line9\n+line10\n line11',
      },
    ],
    createCommentSuccess = true,
    createReviewSuccess = true,
    rateLimitRemaining = 5000,
  } = options;

  return {
    request: jest.fn().mockImplementation((url: string, options?: any) => {
      // Handle diff requests with special accept header
      if (url.includes('/pulls/') && options?.headers?.accept?.includes('diff')) {
        return Promise.resolve({
          data: files.map(f => f.patch || '').join('\n'),
        });
      }
      // Default: return empty string
      return Promise.resolve({ data: '' });
    }),
    rest: {
      pulls: {
        get: jest.fn().mockResolvedValue({
          data: {
            number: pr.number,
            title: pr.title,
            body: pr.body,
            draft: pr.draft,
            labels: pr.labels?.map(name => ({ name })) ?? [],
            additions: pr.additions,
            deletions: pr.deletions,
            base: { sha: pr.baseSha },
            head: { sha: pr.headSha },
            user: { login: pr.author, type: 'User' },
          },
        }),
        listFiles: jest.fn().mockResolvedValue({
          data: files,
        }),
        createReview: jest.fn().mockImplementation(() => {
          if (createReviewSuccess) {
            return Promise.resolve({ data: { id: 123 } });
          }
          return Promise.reject(new Error('Failed to create review'));
        }),
      },
      issues: {
        createComment: jest.fn().mockImplementation(() => {
          if (createCommentSuccess) {
            return Promise.resolve({ data: { id: 456 } });
          }
          return Promise.reject(new Error('Failed to create comment'));
        }),
        listComments: jest.fn().mockResolvedValue({
          data: [],
        }),
        createReaction: jest.fn().mockResolvedValue({
          data: { id: 789 },
        }),
      },
      rateLimit: {
        get: jest.fn().mockResolvedValue({
          data: {
            rate: {
              remaining: rateLimitRemaining,
              limit: 5000,
              reset: Date.now() / 1000 + 3600,
            },
          },
        }),
      },
      repos: {
        getContent: jest.fn().mockResolvedValue({
          data: {
            type: 'file',
            content: Buffer.from('export const config = {}').toString('base64'),
          },
        }),
      },
    },
  };
}

/**
 * Creates a mock PR context for testing
 */
export function createMockPRContext(overrides: Partial<PRContext> = {}): PRContext {
  return {
    number: 1,
    title: 'Test PR',
    body: 'Test description',
    author: 'test-user',
    draft: false,
    labels: [],
    files: [
      {
        filename: 'src/test.ts',
        status: 'modified',
        additions: 5,
        deletions: 2,
        changes: 7,
        patch: '@@ -8,3 +8,4 @@\n line8\n line9\n+line10\n line11',
      },
    ],
    diff: `diff --git a/src/test.ts b/src/test.ts
index abc123..def456 100644
--- a/src/test.ts
+++ b/src/test.ts
@@ -8,3 +8,4 @@
 line8
 line9
+line10
 line11`,
    additions: 5,
    deletions: 2,
    baseSha: 'base-sha',
    headSha: 'head-sha',
    ...overrides,
  };
}

/**
 * Creates a mock file change for testing
 */
export function createMockFileChange(overrides: Partial<FileChange> = {}): FileChange {
  return {
    filename: 'src/test.ts',
    status: 'modified',
    additions: 5,
    deletions: 2,
    changes: 7,
    patch: '@@ -8,3 +8,4 @@\n line8\n line9\n+line10\n line11',
    ...overrides,
  };
}

/**
 * Simulates GitHub API rate limiting
 */
export function createRateLimitedOctokit(): any {
  const mock = createMockOctokit({ rateLimitRemaining: 0 });

  mock.rest.pulls.get.mockRejectedValue(
    Object.assign(new Error('API rate limit exceeded'), {
      status: 403,
      response: {
        data: {
          message: 'API rate limit exceeded',
        },
      },
    })
  );

  return mock;
}

/**
 * Simulates GitHub API errors
 */
export function createErrorOctokit(statusCode: number = 500, message: string = 'Internal Server Error'): any {
  const mock = createMockOctokit();

  const error = Object.assign(new Error(message), {
    status: statusCode,
    response: {
      data: {
        message,
      },
    },
  });

  mock.rest.pulls.get.mockRejectedValue(error);
  mock.rest.issues.createComment.mockRejectedValue(error);
  mock.rest.pulls.createReview.mockRejectedValue(error);

  return mock;
}
