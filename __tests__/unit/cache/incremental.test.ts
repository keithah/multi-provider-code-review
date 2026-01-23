import { IncrementalReviewer } from '../../../src/cache/incremental';
import { CacheStorage } from '../../../src/cache/storage';
import { PRContext, Review, Finding, FileChange } from '../../../src/types';
import * as childProcess from 'child_process';

jest.mock('../../../src/cache/storage');
jest.mock('child_process');

describe('IncrementalReviewer', () => {
  let mockStorage: jest.Mocked<CacheStorage>;
  let reviewer: IncrementalReviewer;

  beforeEach(() => {
    mockStorage = {
      read: jest.fn(),
      write: jest.fn(),
    } as any;

    reviewer = new IncrementalReviewer(mockStorage, {
      enabled: true,
      cacheTtlDays: 7,
    });
  });

  describe('shouldUseIncremental', () => {
    it('returns false when incremental is disabled', async () => {
      const disabledReviewer = new IncrementalReviewer(mockStorage, {
        enabled: false,
        cacheTtlDays: 7,
      });

      const pr: PRContext = createMockPR();
      const result = await disabledReviewer.shouldUseIncremental(pr);

      expect(result).toBe(false);
    });

    it('returns false when no previous review exists', async () => {
      mockStorage.read.mockResolvedValue(null);

      const pr: PRContext = createMockPR();
      const result = await reviewer.shouldUseIncremental(pr);

      expect(result).toBe(false);
    });

    it('returns false when cache is expired', async () => {
      const oldTimestamp = Date.now() - (8 * 24 * 60 * 60 * 1000); // 8 days ago
      mockStorage.read.mockResolvedValue(JSON.stringify({
        prNumber: 1,
        lastReviewedCommit: 'old-sha',
        timestamp: oldTimestamp,
        findings: [],
        reviewSummary: 'Old review',
      }));

      const pr: PRContext = createMockPR();
      const result = await reviewer.shouldUseIncremental(pr);

      expect(result).toBe(false);
    });

    it('returns false when PR head SHA unchanged', async () => {
      mockStorage.read.mockResolvedValue(JSON.stringify({
        prNumber: 1,
        lastReviewedCommit: 'current-head-sha',
        timestamp: Date.now(),
        findings: [],
        reviewSummary: 'Previous review',
      }));

      const pr: PRContext = createMockPR({ headSha: 'current-head-sha' });
      const result = await reviewer.shouldUseIncremental(pr);

      expect(result).toBe(false);
    });

    it('returns true when incremental review is possible', async () => {
      mockStorage.read.mockResolvedValue(JSON.stringify({
        prNumber: 1,
        lastReviewedCommit: 'old-sha',
        timestamp: Date.now(),
        findings: [],
        reviewSummary: 'Previous review',
      }));

      const pr: PRContext = createMockPR({ headSha: 'new-sha' });
      const result = await reviewer.shouldUseIncremental(pr);

      expect(result).toBe(true);
    });
  });

  describe('getLastReview', () => {
    it('returns null when no cached data exists', async () => {
      mockStorage.read.mockResolvedValue(null);

      const result = await reviewer.getLastReview(1);

      expect(result).toBeNull();
    });

    it('returns parsed review data', async () => {
      const cachedData = {
        prNumber: 1,
        lastReviewedCommit: 'abc123',
        timestamp: Date.now(),
        findings: [createMockFinding()],
        reviewSummary: 'Test summary',
      };
      mockStorage.read.mockResolvedValue(JSON.stringify(cachedData));

      const result = await reviewer.getLastReview(1);

      expect(result).toEqual(cachedData);
    });

    it('handles JSON parse errors gracefully', async () => {
      mockStorage.read.mockResolvedValue('invalid json{');

      const result = await reviewer.getLastReview(1);

      expect(result).toBeNull();
    });
  });

  describe('saveReview', () => {
    it('saves review data with correct structure', async () => {
      const pr: PRContext = createMockPR({ headSha: 'new-sha' });
      const review: Review = createMockReview();

      await reviewer.saveReview(pr, review);

      expect(mockStorage.write).toHaveBeenCalledWith(
        'incremental-review-pr-1',
        expect.stringContaining('"lastReviewedCommit":"new-sha"')
      );
    });
  });

  describe('getChangedFilesSince', () => {
    it('returns changed files from git diff', async () => {
      const gitOutput = 'M\tsrc/file1.ts\nA\tsrc/file2.ts\nD\tsrc/file3.ts';
      (childProcess.execSync as jest.Mock).mockReturnValue(gitOutput);

      const pr: PRContext = createMockPR({
        files: [
          createMockFile({ filename: 'src/file1.ts' }),
          createMockFile({ filename: 'src/file2.ts' }),
        ],
      });

      const result = await reviewer.getChangedFilesSince(pr, 'old-sha');

      expect(result).toHaveLength(2);
      expect(result[0].filename).toBe('src/file1.ts');
      expect(result[1].filename).toBe('src/file2.ts');
    });

    it('falls back to all files on git error', async () => {
      (childProcess.execSync as jest.Mock).mockImplementation(() => {
        throw new Error('Git command failed');
      });

      const pr: PRContext = createMockPR({
        files: [createMockFile(), createMockFile({ filename: 'src/file2.ts' })],
      });

      const result = await reviewer.getChangedFilesSince(pr, 'old-sha');

      expect(result).toEqual(pr.files);
    });

    it('handles files with tabs in filename', async () => {
      const gitOutput = 'M\tsrc/file\twith\ttabs.ts';
      (childProcess.execSync as jest.Mock).mockReturnValue(gitOutput);

      const pr: PRContext = createMockPR({
        files: [createMockFile({ filename: 'src/file\twith\ttabs.ts' })],
      });

      const result = await reviewer.getChangedFilesSince(pr, 'old-sha');

      expect(result).toHaveLength(1);
      expect(result[0].filename).toBe('src/file\twith\ttabs.ts');
    });
  });

  describe('mergeFindings', () => {
    it('keeps findings from unchanged files', () => {
      const previousFindings: Finding[] = [
        createMockFinding({ file: 'unchanged.ts', title: 'Issue 1' }),
        createMockFinding({ file: 'changed.ts', title: 'Issue 2' }),
      ];
      const newFindings: Finding[] = [
        createMockFinding({ file: 'changed.ts', title: 'New Issue' }),
      ];
      const changedFiles: FileChange[] = [
        createMockFile({ filename: 'changed.ts' }),
      ];

      const result = reviewer.mergeFindings(previousFindings, newFindings, changedFiles);

      expect(result).toHaveLength(2);
      expect(result.find(f => f.file === 'unchanged.ts')).toBeDefined();
      expect(result.find(f => f.title === 'New Issue')).toBeDefined();
      expect(result.find(f => f.title === 'Issue 2')).toBeUndefined();
    });

    it('replaces findings for changed files', () => {
      const previousFindings: Finding[] = [
        createMockFinding({ file: 'file.ts', title: 'Old Finding' }),
      ];
      const newFindings: Finding[] = [
        createMockFinding({ file: 'file.ts', title: 'New Finding' }),
      ];
      const changedFiles: FileChange[] = [
        createMockFile({ filename: 'file.ts' }),
      ];

      const result = reviewer.mergeFindings(previousFindings, newFindings, changedFiles);

      expect(result).toHaveLength(1);
      expect(result[0].title).toBe('New Finding');
    });

    it('handles empty previous findings', () => {
      const previousFindings: Finding[] = [];
      const newFindings: Finding[] = [
        createMockFinding({ file: 'file.ts' }),
      ];
      const changedFiles: FileChange[] = [
        createMockFile({ filename: 'file.ts' }),
      ];

      const result = reviewer.mergeFindings(previousFindings, newFindings, changedFiles);

      expect(result).toEqual(newFindings);
    });

    it('handles empty new findings', () => {
      const previousFindings: Finding[] = [
        createMockFinding({ file: 'unchanged.ts' }),
        createMockFinding({ file: 'changed.ts' }),
      ];
      const newFindings: Finding[] = [];
      const changedFiles: FileChange[] = [
        createMockFile({ filename: 'changed.ts' }),
      ];

      const result = reviewer.mergeFindings(previousFindings, newFindings, changedFiles);

      expect(result).toHaveLength(1);
      expect(result[0].file).toBe('unchanged.ts');
    });
  });

  describe('generateIncrementalSummary', () => {
    it('generates summary with incremental note', () => {
      const result = reviewer.generateIncrementalSummary(
        'Previous summary',
        'New summary',
        [createMockFile({ filename: 'file1.ts' }), createMockFile({ filename: 'file2.ts' })],
        'abc1234567890',
        'def9876543210'
      );

      expect(result).toContain('Incremental Review');
      expect(result).toContain('abc1234');
      expect(result).toContain('def9876');
      expect(result).toContain('Files reviewed in this update:**');
      expect(result).toContain('file1.ts');
      expect(result).toContain('file2.ts');
      expect(result).toContain('New summary');
      expect(result).toContain('Previous summary');
    });

    it('includes all changed filenames', () => {
      const files = [
        createMockFile({ filename: 'src/a.ts' }),
        createMockFile({ filename: 'src/b.ts' }),
        createMockFile({ filename: 'src/c.ts' }),
      ];

      const result = reviewer.generateIncrementalSummary(
        'Old',
        'New',
        files,
        'old-commit',
        'new-commit'
      );

      expect(result).toContain('src/a.ts');
      expect(result).toContain('src/b.ts');
      expect(result).toContain('src/c.ts');
    });
  });
});

// Helper functions
function createMockPR(overrides: Partial<PRContext> = {}): PRContext {
  return {
    number: 1,
    title: 'Test PR',
    body: 'Test body',
    author: 'test-user',
    draft: false,
    labels: [],
    files: [createMockFile()],
    diff: 'test diff',
    additions: 10,
    deletions: 5,
    baseSha: 'base-sha',
    headSha: 'head-sha',
    ...overrides,
  };
}

function createMockFile(overrides: Partial<FileChange> = {}): FileChange {
  return {
    filename: 'src/test.ts',
    status: 'modified',
    additions: 5,
    deletions: 2,
    changes: 7,
    patch: '@@ -1,3 +1,4 @@\n line1\n+line2\n line3',
    ...overrides,
  };
}

function createMockFinding(overrides: Partial<Finding> = {}): Finding {
  return {
    file: 'src/test.ts',
    line: 10,
    severity: 'major',
    title: 'Test finding',
    message: 'Test message',
    ...overrides,
  };
}

function createMockReview(overrides: Partial<Review> = {}): Review {
  return {
    summary: 'Test summary',
    findings: [createMockFinding()],
    inlineComments: [],
    actionItems: [],
    metrics: {
      totalFindings: 1,
      critical: 0,
      major: 1,
      minor: 0,
      providersUsed: 1,
      providersSuccess: 1,
      providersFailed: 0,
      totalTokens: 100,
      totalCost: 0.001,
      durationSeconds: 1.0,
    },
    ...overrides,
  };
}
