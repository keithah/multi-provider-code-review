import { FeedbackFilter } from '../../../src/github/feedback';
import { GitHubClient } from '../../../src/github/client';
import { InlineComment } from '../../../src/types';
import { ProviderWeightTracker } from '../../../src/learning/provider-weights';

// Mock GitHubClient
jest.mock('../../../src/github/client');

describe('FeedbackFilter', () => {
  let feedbackFilter: FeedbackFilter;
  let mockClient: jest.Mocked<GitHubClient>;
  let mockOctokit: any;

  beforeEach(() => {
    mockOctokit = {
      rest: {
        pulls: {
          listReviewComments: jest.fn(),
        },
        reactions: {
          listForPullRequestReviewComment: jest.fn(),
        },
      },
      paginate: jest.fn(),
    };

    mockClient = {
      octokit: mockOctokit,
      owner: 'test-owner',
      repo: 'test-repo',
    } as any;

    feedbackFilter = new FeedbackFilter(mockClient);
  });

  describe('loadSuppressed', () => {
    it('should return empty set when no comments exist', async () => {
      mockOctokit.paginate.mockResolvedValue([]);

      const suppressed = await feedbackFilter.loadSuppressed(123);

      expect(suppressed.size).toBe(0);
      expect(mockOctokit.paginate).toHaveBeenCalledWith(
        mockOctokit.rest.pulls.listReviewComments,
        {
          owner: 'test-owner',
          repo: 'test-repo',
          pull_number: 123,
          per_page: 100,
        }
      );
    });

    it('should identify suppressed comments with thumbs-down reactions', async () => {
      const mockComments = [
        {
          id: 1,
          path: 'src/file.ts',
          line: 10,
          body: '**Security Issue**\nThis is a finding',
        },
        {
          id: 2,
          path: 'src/other.ts',
          line: 20,
          body: '**Performance Issue**\nAnother finding',
        },
      ];

      mockOctokit.paginate.mockResolvedValue(mockComments);

      // First comment has thumbs-down, second doesn't
      mockOctokit.rest.reactions.listForPullRequestReviewComment
        .mockResolvedValueOnce({
          data: [{ content: '-1' }], // Thumbs down
        })
        .mockResolvedValueOnce({
          data: [{ content: '+1' }], // Thumbs up
        });

      const suppressed = await feedbackFilter.loadSuppressed(123);

      expect(suppressed.size).toBe(1);
      expect(suppressed.has('src/file.ts:10:security issue')).toBe(true);
      expect(suppressed.has('src/other.ts:20:performance issue')).toBe(false);
    });

    it('should handle multiple reactions on same comment', async () => {
      const mockComments = [
        {
          id: 1,
          path: 'src/file.ts',
          line: 10,
          body: '**Issue Title**\nDescription',
        },
      ];

      mockOctokit.paginate.mockResolvedValue(mockComments);
      mockOctokit.rest.reactions.listForPullRequestReviewComment.mockResolvedValue({
        data: [
          { content: '+1' }, // Thumbs up
          { content: '-1' }, // Thumbs down
          { content: 'laugh' }, // Other reaction
        ],
      });

      const suppressed = await feedbackFilter.loadSuppressed(123);

      expect(suppressed.size).toBe(1);
      expect(suppressed.has('src/file.ts:10:issue title')).toBe(true);
    });

    it('should handle errors gracefully when loading reactions', async () => {
      const mockComments = [
        {
          id: 1,
          path: 'src/file.ts',
          line: 10,
          body: '**Issue**\nDescription',
        },
      ];

      mockOctokit.paginate.mockResolvedValue(mockComments);
      mockOctokit.rest.reactions.listForPullRequestReviewComment.mockRejectedValue(
        new Error('API rate limited')
      );

      const suppressed = await feedbackFilter.loadSuppressed(123);

      // Should not throw, should return empty set
      expect(suppressed.size).toBe(0);
    });

    it('should handle errors when loading comments', async () => {
      mockOctokit.paginate.mockRejectedValue(new Error('Network error'));

      const suppressed = await feedbackFilter.loadSuppressed(123);

      // Should not throw, should return empty set
      expect(suppressed.size).toBe(0);
    });

    it('should extract title from bold text in comment body', async () => {
      const mockComments = [
        {
          id: 1,
          path: 'src/file.ts',
          line: 15,
          body: '**Extracted Title**\nMore details here',
        },
      ];

      mockOctokit.paginate.mockResolvedValue(mockComments);
      mockOctokit.rest.reactions.listForPullRequestReviewComment.mockResolvedValue({
        data: [{ content: '-1' }],
      });

      const suppressed = await feedbackFilter.loadSuppressed(123);

      expect(suppressed.has('src/file.ts:15:extracted title')).toBe(true);
    });

    it('should use first line as fallback when no bold text', async () => {
      const mockComments = [
        {
          id: 1,
          path: 'src/file.ts',
          line: 5,
          body: 'Plain text comment\nMore details',
        },
      ];

      mockOctokit.paginate.mockResolvedValue(mockComments);
      mockOctokit.rest.reactions.listForPullRequestReviewComment.mockResolvedValue({
        data: [{ content: '-1' }],
      });

      const suppressed = await feedbackFilter.loadSuppressed(123);

      expect(suppressed.has('src/file.ts:5:plain text comment')).toBe(true);
    });
  });

  describe('shouldPost', () => {
    it('should allow posting when comment is not suppressed', () => {
      const comment: InlineComment = {
        path: 'src/file.ts',
        line: 10,
        side: 'RIGHT',
        body: '**Issue Title**\nDescription',
      };

      const suppressed = new Set<string>();
      const result = feedbackFilter.shouldPost(comment, suppressed);

      expect(result).toBe(true);
    });

    it('should block posting when comment is suppressed', () => {
      const comment: InlineComment = {
        path: 'src/file.ts',
        line: 10,
        side: 'RIGHT',
        body: '**Issue Title**\nDescription',
      };

      const suppressed = new Set<string>(['src/file.ts:10:issue title']);
      const result = feedbackFilter.shouldPost(comment, suppressed);

      expect(result).toBe(false);
    });

    it('should be case-insensitive for file paths and titles', () => {
      const comment: InlineComment = {
        path: 'src/File.TS',
        line: 10,
        side: 'RIGHT',
        body: '**Issue TITLE**\nDescription',
      };

      const suppressed = new Set<string>(['src/file.ts:10:issue title']);
      const result = feedbackFilter.shouldPost(comment, suppressed);

      expect(result).toBe(false);
    });

    it('should differentiate between different line numbers', () => {
      const comment1: InlineComment = {
        path: 'src/file.ts',
        line: 10,
        side: 'RIGHT',
        body: '**Issue**\nDescription',
      };

      const comment2: InlineComment = {
        path: 'src/file.ts',
        line: 20,
        side: 'RIGHT',
        body: '**Issue**\nDescription',
      };

      const suppressed = new Set<string>(['src/file.ts:10:issue']);

      expect(feedbackFilter.shouldPost(comment1, suppressed)).toBe(false);
      expect(feedbackFilter.shouldPost(comment2, suppressed)).toBe(true);
    });

    it('should differentiate between different files', () => {
      const comment1: InlineComment = {
        path: 'src/file1.ts',
        line: 10,
        side: 'RIGHT',
        body: '**Issue**\nDescription',
      };

      const comment2: InlineComment = {
        path: 'src/file2.ts',
        line: 10,
        side: 'RIGHT',
        body: '**Issue**\nDescription',
      };

      const suppressed = new Set<string>(['src/file1.ts:10:issue']);

      expect(feedbackFilter.shouldPost(comment1, suppressed)).toBe(false);
      expect(feedbackFilter.shouldPost(comment2, suppressed)).toBe(true);
    });
  });

  describe('negative feedback recording', () => {
    it('records negative feedback when comment has thumbs-down and provider', async () => {
      const mockWeightTracker = {
        recordFeedback: jest.fn().mockResolvedValue(undefined),
      } as unknown as ProviderWeightTracker;

      const filter = new FeedbackFilter(mockClient, mockWeightTracker);

      // Mock comment with provider attribution and thumbs-down
      mockOctokit.paginate.mockResolvedValue([
        {
          id: 1,
          path: 'test.ts',
          line: 10,
          body: '**Issue Title**\n\n**Provider:** `claude`',
        },
      ]);
      mockOctokit.rest.reactions.listForPullRequestReviewComment.mockResolvedValue({
        data: [{ content: '-1' }],
      });

      await filter.loadSuppressed(123);

      expect(mockWeightTracker.recordFeedback).toHaveBeenCalledWith('claude', '👎');
    });

    it('does not record feedback when no provider in comment', async () => {
      const mockWeightTracker = {
        recordFeedback: jest.fn().mockResolvedValue(undefined),
      } as unknown as ProviderWeightTracker;

      const filter = new FeedbackFilter(mockClient, mockWeightTracker);

      // Mock comment without provider attribution
      mockOctokit.paginate.mockResolvedValue([
        {
          id: 1,
          path: 'test.ts',
          line: 10,
          body: '**Issue Title**\n\nSome description without provider',
        },
      ]);
      mockOctokit.rest.reactions.listForPullRequestReviewComment.mockResolvedValue({
        data: [{ content: '-1' }],
      });

      await filter.loadSuppressed(123);

      expect(mockWeightTracker.recordFeedback).not.toHaveBeenCalled();
    });

    it('works without weight tracker (backward compatible)', async () => {
      const filter = new FeedbackFilter(mockClient);

      mockOctokit.paginate.mockResolvedValue([
        {
          id: 1,
          path: 'test.ts',
          line: 10,
          body: '**Issue Title**\n\n**Provider:** `claude`',
        },
      ]);
      mockOctokit.rest.reactions.listForPullRequestReviewComment.mockResolvedValue({
        data: [{ content: '-1' }],
      });

      // Should not throw, suppression still works
      const suppressed = await filter.loadSuppressed(123);
      expect(suppressed.size).toBe(1);
    });

    it('extracts provider and records feedback for multiple dismissals', async () => {
      const mockWeightTracker = {
        recordFeedback: jest.fn().mockResolvedValue(undefined),
      } as unknown as ProviderWeightTracker;

      const filter = new FeedbackFilter(mockClient, mockWeightTracker);

      // Mock multiple comments with different providers
      mockOctokit.paginate.mockResolvedValue([
        {
          id: 1,
          path: 'test.ts',
          line: 10,
          body: '**Issue 1**\n\n**Provider:** `openai`',
        },
        {
          id: 2,
          path: 'test.ts',
          line: 20,
          body: '**Issue 2**\n\n**Provider:** `anthropic`',
        },
      ]);
      mockOctokit.rest.reactions.listForPullRequestReviewComment
        .mockResolvedValueOnce({
          data: [{ content: '-1' }],
        })
        .mockResolvedValueOnce({
          data: [{ content: '-1' }],
        });

      await filter.loadSuppressed(123);

      expect(mockWeightTracker.recordFeedback).toHaveBeenCalledWith('openai', '👎');
      expect(mockWeightTracker.recordFeedback).toHaveBeenCalledWith('anthropic', '👎');
      expect(mockWeightTracker.recordFeedback).toHaveBeenCalledTimes(2);
    });

    it('does not record feedback when no thumbs-down reaction', async () => {
      const mockWeightTracker = {
        recordFeedback: jest.fn().mockResolvedValue(undefined),
      } as unknown as ProviderWeightTracker;

      const filter = new FeedbackFilter(mockClient, mockWeightTracker);

      mockOctokit.paginate.mockResolvedValue([
        {
          id: 1,
          path: 'test.ts',
          line: 10,
          body: '**Issue Title**\n\n**Provider:** `claude`',
        },
      ]);
      mockOctokit.rest.reactions.listForPullRequestReviewComment.mockResolvedValue({
        data: [{ content: '+1' }], // Thumbs up, not down
      });

      await filter.loadSuppressed(123);

      expect(mockWeightTracker.recordFeedback).not.toHaveBeenCalled();
    });
  });
});
