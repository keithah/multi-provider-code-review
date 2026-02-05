import { AcceptanceDetector } from '../../src/learning/acceptance-detector';
import { ProviderWeightTracker } from '../../src/learning/provider-weights';

describe('AcceptanceDetector', () => {
  let detector: AcceptanceDetector;
  let mockWeightTracker: jest.Mocked<ProviderWeightTracker>;

  beforeEach(() => {
    detector = new AcceptanceDetector();
    mockWeightTracker = {
      recordFeedback: jest.fn().mockResolvedValue(undefined),
    } as any;
  });

  describe('detectFromCommits', () => {
    const commentedFiles = new Map([
      ['src/auth.ts', [
        { line: 10, provider: 'claude' },
        { line: 20, provider: 'gemini' },
      ]],
      ['src/user.ts', [
        { line: 5, provider: 'claude' },
      ]],
    ]);

    it('detects acceptance from "Apply suggestions from code review" commit', () => {
      const commits = [
        {
          sha: 'abc123',
          message: 'Apply suggestions from code review',
          files: ['src/auth.ts'],
          timestamp: 1000,
        },
      ];

      const acceptances = detector.detectFromCommits(commits, commentedFiles);

      expect(acceptances).toHaveLength(2);
      expect(acceptances[0]).toMatchObject({
        file: 'src/auth.ts',
        line: 10,
        provider: 'claude',
        commitSha: 'abc123',
        timestamp: 1000,
      });
      expect(acceptances[1]).toMatchObject({
        file: 'src/auth.ts',
        line: 20,
        provider: 'gemini',
        commitSha: 'abc123',
        timestamp: 1000,
      });
    });

    it('detects acceptance from "Apply suggestion from code review" (singular)', () => {
      const commits = [
        {
          sha: 'def456',
          message: 'Apply suggestion from code review',
          files: ['src/user.ts'],
          timestamp: 2000,
        },
      ];

      const acceptances = detector.detectFromCommits(commits, commentedFiles);

      expect(acceptances).toHaveLength(1);
      expect(acceptances[0]).toMatchObject({
        file: 'src/user.ts',
        line: 5,
        provider: 'claude',
        commitSha: 'def456',
      });
    });

    it('detects acceptance from "Apply 3 suggestions" batch commit', () => {
      const commits = [
        {
          sha: 'ghi789',
          message: 'Apply 3 suggestions from code review',
          files: ['src/auth.ts', 'src/user.ts'],
          timestamp: 3000,
        },
      ];

      const acceptances = detector.detectFromCommits(commits, commentedFiles);

      expect(acceptances).toHaveLength(3); // 2 from auth.ts + 1 from user.ts
    });

    it('detects acceptance from "Apply suggestions from @username"', () => {
      const commits = [
        {
          sha: 'jkl012',
          message: 'Apply suggestions from @reviewer',
          files: ['src/auth.ts'],
          timestamp: 4000,
        },
      ];

      const acceptances = detector.detectFromCommits(commits, commentedFiles);

      expect(acceptances).toHaveLength(2);
    });

    it('does not detect regular commits without suggestion pattern', () => {
      const commits = [
        {
          sha: 'mno345',
          message: 'Fix authentication bug',
          files: ['src/auth.ts'],
          timestamp: 5000,
        },
      ];

      const acceptances = detector.detectFromCommits(commits, commentedFiles);

      expect(acceptances).toHaveLength(0);
    });

    it('ignores suggestion commits for files without comments', () => {
      const commits = [
        {
          sha: 'pqr678',
          message: 'Apply suggestions from code review',
          files: ['src/database.ts'], // No comments on this file
          timestamp: 6000,
        },
      ];

      const acceptances = detector.detectFromCommits(commits, commentedFiles);

      expect(acceptances).toHaveLength(0);
    });

    it('handles commits with multiple files', () => {
      const commits = [
        {
          sha: 'stu901',
          message: 'Apply suggestions from code review',
          files: ['src/auth.ts', 'src/user.ts'],
          timestamp: 7000,
        },
      ];

      const acceptances = detector.detectFromCommits(commits, commentedFiles);

      expect(acceptances).toHaveLength(3); // 2 from auth.ts + 1 from user.ts
      expect(acceptances.map(a => a.file)).toEqual([
        'src/auth.ts',
        'src/auth.ts',
        'src/user.ts',
      ]);
    });

    it('uses "unknown" provider when provider is missing', () => {
      const filesWithoutProvider = new Map([
        ['src/test.ts', [{ line: 1 }]],
      ]);

      const commits = [
        {
          sha: 'vwx234',
          message: 'Apply suggestions from code review',
          files: ['src/test.ts'],
          timestamp: 8000,
        },
      ];

      const acceptances = detector.detectFromCommits(commits, filesWithoutProvider as any);

      expect(acceptances).toHaveLength(1);
      expect(acceptances[0].provider).toBe('unknown');
    });

    it('is case-insensitive for suggestion patterns', () => {
      const commits = [
        {
          sha: 'yza567',
          message: 'APPLY SUGGESTIONS FROM CODE REVIEW',
          files: ['src/auth.ts'],
          timestamp: 9000,
        },
      ];

      const acceptances = detector.detectFromCommits(commits, commentedFiles);

      expect(acceptances).toHaveLength(2);
    });
  });

  describe('detectFromReactions', () => {
    it('detects acceptance from thumbs-up reaction', () => {
      const commentReactions = [
        {
          commentId: 123,
          file: 'src/auth.ts',
          line: 10,
          provider: 'claude',
          reactions: [
            { user: 'developer', content: '+1' },
          ],
        },
      ];

      const acceptances = detector.detectFromReactions(commentReactions);

      expect(acceptances).toHaveLength(1);
      expect(acceptances[0]).toMatchObject({
        file: 'src/auth.ts',
        line: 10,
        provider: 'claude',
        commentId: 123,
      });
      expect(acceptances[0].timestamp).toBeGreaterThan(0);
    });

    it('does not detect acceptance without thumbs-up reaction', () => {
      const commentReactions = [
        {
          commentId: 456,
          file: 'src/auth.ts',
          line: 10,
          provider: 'claude',
          reactions: [
            { user: 'developer', content: '-1' }, // thumbs-down
          ],
        },
      ];

      const acceptances = detector.detectFromReactions(commentReactions);

      expect(acceptances).toHaveLength(0);
    });

    it('detects acceptance from multiple comments', () => {
      const commentReactions = [
        {
          commentId: 123,
          file: 'src/auth.ts',
          line: 10,
          provider: 'claude',
          reactions: [{ user: 'dev1', content: '+1' }],
        },
        {
          commentId: 456,
          file: 'src/user.ts',
          line: 20,
          provider: 'gemini',
          reactions: [{ user: 'dev2', content: '+1' }],
        },
      ];

      const acceptances = detector.detectFromReactions(commentReactions);

      expect(acceptances).toHaveLength(2);
      expect(acceptances[0].provider).toBe('claude');
      expect(acceptances[1].provider).toBe('gemini');
    });

    it('ignores comments without reactions', () => {
      const commentReactions = [
        {
          commentId: 789,
          file: 'src/auth.ts',
          line: 10,
          provider: 'claude',
          reactions: [],
        },
      ];

      const acceptances = detector.detectFromReactions(commentReactions);

      expect(acceptances).toHaveLength(0);
    });

    it('uses "unknown" provider when provider is missing', () => {
      const commentReactions = [
        {
          commentId: 999,
          file: 'src/test.ts',
          line: 5,
          reactions: [{ user: 'developer', content: '+1' }],
        },
      ];

      const acceptances = detector.detectFromReactions(commentReactions as any);

      expect(acceptances).toHaveLength(1);
      expect(acceptances[0].provider).toBe('unknown');
    });

    it('handles multiple reactions on same comment', () => {
      const commentReactions = [
        {
          commentId: 111,
          file: 'src/auth.ts',
          line: 10,
          provider: 'claude',
          reactions: [
            { user: 'dev1', content: '+1' },
            { user: 'dev2', content: '+1' },
            { user: 'dev3', content: '-1' },
          ],
        },
      ];

      const acceptances = detector.detectFromReactions(commentReactions);

      // Should detect one acceptance (multiple thumbs-up still = one acceptance)
      expect(acceptances).toHaveLength(1);
      expect(acceptances[0].commentId).toBe(111);
    });
  });

  describe('recordAcceptances', () => {
    it('records positive feedback for each acceptance', async () => {
      const acceptances = [
        {
          file: 'src/auth.ts',
          line: 10,
          provider: 'claude',
          commitSha: 'abc123',
          timestamp: 1000,
        },
        {
          file: 'src/user.ts',
          line: 20,
          provider: 'gemini',
          commentId: 456,
          timestamp: 2000,
        },
      ];

      await detector.recordAcceptances(acceptances, mockWeightTracker);

      expect(mockWeightTracker.recordFeedback).toHaveBeenCalledTimes(2);
      expect(mockWeightTracker.recordFeedback).toHaveBeenCalledWith('claude', '👍');
      expect(mockWeightTracker.recordFeedback).toHaveBeenCalledWith('gemini', '👍');
    });

    it('skips recording for unknown providers', async () => {
      const acceptances = [
        {
          file: 'src/test.ts',
          line: 5,
          provider: 'unknown',
          commitSha: 'xyz789',
          timestamp: 3000,
        },
      ];

      await detector.recordAcceptances(acceptances, mockWeightTracker);

      expect(mockWeightTracker.recordFeedback).not.toHaveBeenCalled();
    });

    it('skips recording for acceptances without provider', async () => {
      const acceptances = [
        {
          file: 'src/test.ts',
          line: 5,
          commitSha: 'xyz789',
          timestamp: 3000,
        } as any,
      ];

      await detector.recordAcceptances(acceptances, mockWeightTracker);

      expect(mockWeightTracker.recordFeedback).not.toHaveBeenCalled();
    });

    it('handles empty acceptances array', async () => {
      await detector.recordAcceptances([], mockWeightTracker);

      expect(mockWeightTracker.recordFeedback).not.toHaveBeenCalled();
    });

    it('records feedback for duplicate providers', async () => {
      const acceptances = [
        {
          file: 'src/auth.ts',
          line: 10,
          provider: 'claude',
          commitSha: 'abc123',
          timestamp: 1000,
        },
        {
          file: 'src/auth.ts',
          line: 20,
          provider: 'claude',
          commitSha: 'abc123',
          timestamp: 1000,
        },
      ];

      await detector.recordAcceptances(acceptances, mockWeightTracker);

      // Should record twice for same provider (two separate acceptances)
      expect(mockWeightTracker.recordFeedback).toHaveBeenCalledTimes(2);
      expect(mockWeightTracker.recordFeedback).toHaveBeenNthCalledWith(1, 'claude', '👍');
      expect(mockWeightTracker.recordFeedback).toHaveBeenNthCalledWith(2, 'claude', '👍');
    });
  });
});
