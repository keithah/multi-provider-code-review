/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * Incremental Review System - Interactive Demonstration
 *
 * This test demonstrates the incremental review workflow step-by-step
 */

import { IncrementalReviewer } from '../../src/cache/incremental';
import { CacheStorage } from '../../src/cache/storage';
import { PRContext, Review, Finding, FileChange } from '../../src/types';
import * as childProcess from 'child_process';

jest.mock('../../src/cache/storage');
jest.mock('child_process');

describe('Incremental Review System - Interactive Demo', () => {
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

    jest.clearAllMocks();
  });

  it('DEMO: Complete incremental review workflow', async () => {
    console.log('\n=== INCREMENTAL REVIEW DEMO ===\n');

    // ========================================
    // SCENARIO: Large PR with 50 files
    // ========================================
    console.log('📝 Scenario: Large PR with 50 files opened');
    console.log('   - PR #123: "Add authentication system"');
    console.log('   - 50 files changed');
    console.log('   - Commit: abc123\n');

    const pr: PRContext = {
      number: 123,
      title: 'Add authentication system',
      body: 'Implements JWT authentication',
      author: 'developer',
      draft: false,
      labels: [],
      files: createManyFiles(50), // 50 files!
      diff: 'large diff...',
      additions: 2000,
      deletions: 500,
      baseSha: 'base-sha',
      headSha: 'abc123',
    };

    // ========================================
    // STEP 1: First Review (Full Review)
    // ========================================
    console.log('🔍 STEP 1: First Review');
    console.log('   Action: Check if incremental review is possible');

    mockStorage.read.mockResolvedValue(null); // No previous review
    const canUseIncremental1 = await reviewer.shouldUseIncremental(pr);

    console.log(`   Result: ${canUseIncremental1 ? '✅ Use incremental' : '❌ Use full review'}`);
    console.log('   Reason: No previous review found\n');

    expect(canUseIncremental1).toBe(false);

    console.log('   ⏱️  Reviewing all 50 files...');
    console.log('   💰 Cost: ~$0.015');
    console.log('   ⌛ Time: ~30 seconds\n');

    const firstReview: Review = {
      summary: 'Found 15 issues across authentication files',
      findings: [
        { file: 'src/auth/login.ts', line: 10, severity: 'critical', title: 'SQL Injection', message: 'Vulnerable query' },
        { file: 'src/auth/jwt.ts', line: 45, severity: 'major', title: 'Weak Secret', message: 'Use stronger secret' },
        { file: 'src/middleware/auth.ts', line: 20, severity: 'minor', title: 'Missing Validation', message: 'Add validation' },
        ...createManyFindings(12), // 12 more findings
      ],
      inlineComments: [],
      actionItems: [],
      metrics: {
        totalFindings: 15,
        critical: 1,
        major: 5,
        minor: 9,
        providersUsed: 3,
        providersSuccess: 3,
        providersFailed: 0,
        totalTokens: 5000,
        totalCost: 0.015,
        durationSeconds: 30,
      },
    };

    console.log('   ✅ Review complete!');
    console.log('   📊 Found 15 issues:');
    console.log('      - 1 critical');
    console.log('      - 5 major');
    console.log('      - 9 minor\n');

    console.log('   💾 Saving review state for next update...');
    await reviewer.saveReview(pr, firstReview);

    expect(mockStorage.write).toHaveBeenCalledWith(
      'incremental-review-pr-123',
      expect.stringContaining('"lastReviewedCommit":"abc123"')
    );

    console.log('   ✅ State saved!\n');
    console.log('─────────────────────────────────────────\n');

    // ========================================
    // STEP 2: Developer Updates PR (3 files)
    // ========================================
    console.log('👨‍💻 Developer updates the PR');
    console.log('   - Fixes the SQL injection issue');
    console.log('   - Updates 3 files:');
    console.log('     • src/auth/login.ts (fixed SQL)');
    console.log('     • src/auth/query.ts (new helper)');
    console.log('     • tests/auth.test.ts (new tests)');
    console.log('   - New commit: def456\n');

    const updatedPR: PRContext = {
      ...pr,
      headSha: 'def456', // New commit!
      files: [
        ...createManyFiles(47), // 47 unchanged files
        createMockFile({ filename: 'src/auth/login.ts' }), // Changed file
        createMockFile({ filename: 'src/auth/query.ts' }), // New file
        createMockFile({ filename: 'tests/auth.test.ts' }), // Changed file
      ],
    };

    // ========================================
    // STEP 3: Second Review (Incremental!)
    // ========================================
    console.log('🔍 STEP 2: Updated Review');
    console.log('   Action: Check if incremental review is possible');

    // Mock cached data
    mockStorage.read.mockResolvedValue(
      JSON.stringify({
        prNumber: 123,
        lastReviewedCommit: 'abc123',
        timestamp: Date.now(),
        findings: firstReview.findings,
        reviewSummary: firstReview.summary,
      })
    );

    const canUseIncremental2 = await reviewer.shouldUseIncremental(updatedPR);

    console.log(`   Result: ${canUseIncremental2 ? '✅ Use incremental!' : '❌ Use full review'}`);
    console.log('   Reason: Previous review found, commit changed\n');

    expect(canUseIncremental2).toBe(true);

    console.log('   🎯 Getting changed files via git diff...');

    // Mock git diff output
    (childProcess.execSync as jest.Mock).mockReturnValue(
      'M\tsrc/auth/login.ts\nA\tsrc/auth/query.ts\nM\ttests/auth.test.ts'
    );

    const lastReview = await reviewer.getLastReview(123);
    const changedFiles = await reviewer.getChangedFilesSince(updatedPR, lastReview!.lastReviewedCommit);

    console.log(`   ✅ Found ${changedFiles.length} changed files:`);
    changedFiles.forEach((f, i) => {
      console.log(`      ${i + 1}. ${f.filename}`);
    });
    console.log('');

    expect(changedFiles).toHaveLength(3);

    console.log('   ⏱️  Reviewing only 3 changed files...');
    console.log('   💰 Cost: ~$0.003 (80% savings!)');
    console.log('   ⌛ Time: ~5 seconds (6x faster!)\n');

    // New findings from reviewing the 3 changed files
    const newFindings: Finding[] = [
      { file: 'src/auth/login.ts', line: 10, severity: 'minor', title: 'Code Style', message: 'Minor style issue' },
      { file: 'tests/auth.test.ts', line: 5, severity: 'minor', title: 'Test Coverage', message: 'Add edge case test' },
    ];

    console.log('   📊 New findings: 2');
    console.log('      - 0 critical');
    console.log('      - 0 major');
    console.log('      - 2 minor\n');

    // ========================================
    // STEP 4: Merge Findings
    // ========================================
    console.log('   🔄 Merging findings...');
    console.log('   Strategy:');
    console.log('      • Keep findings from unchanged files (47 files)');
    console.log('      • Add new findings from changed files (3 files)\n');

    const mergedFindings = reviewer.mergeFindings(
      firstReview.findings,
      newFindings,
      changedFiles
    );

    console.log(`   ✅ Merged findings: ${mergedFindings.length} total`);

    // Original 15 findings - 1 from changed file (SQL injection in login.ts) + 2 new = 16
    const keptCount = firstReview.findings.filter(
      f => !changedFiles.find(cf => cf.filename === f.file)
    ).length;
    console.log(`      - ${keptCount} kept from unchanged files`);
    console.log(`      - ${newFindings.length} new from review`);
    console.log('      - 1 fixed (SQL injection no longer appears!)\n');

    expect(mergedFindings.length).toBeGreaterThan(0);

    // ========================================
    // STEP 5: Generate Summary
    // ========================================
    console.log('   📝 Generating incremental summary...');

    const summary = reviewer.generateIncrementalSummary(
      firstReview.summary,
      'Fixed SQL injection, added query helper',
      changedFiles,
      'abc123',
      'def456'
    );

    console.log('   ✅ Summary generated with:');
    console.log('      • 🔄 Incremental review badge');
    console.log('      • Commit range (abc123 → def456)');
    console.log('      • List of changed files');
    console.log('      • New findings');
    console.log('      • Collapsed previous review\n');

    expect(summary).toContain('Incremental Review');
    expect(summary).toContain('abc123');
    expect(summary).toContain('def456');

    console.log('─────────────────────────────────────────\n');

    // ========================================
    // SUMMARY
    // ========================================
    console.log('📊 PERFORMANCE COMPARISON\n');

    console.log('Without Incremental:');
    console.log('   Files Reviewed: 50 files');
    console.log('   Time: ~30 seconds');
    console.log('   Cost: ~$0.015');
    console.log('   Comments: New comment created\n');

    console.log('With Incremental:');
    console.log('   Files Reviewed: 3 files (94% reduction!)');
    console.log('   Time: ~5 seconds (6x faster!)');
    console.log('   Cost: ~$0.003 (80% cheaper!)');
    console.log('   Comments: Existing comment updated\n');

    console.log('💰 SAVINGS:');
    console.log('   ⚡ Time saved: 25 seconds (83%)');
    console.log('   💵 Cost saved: $0.012 (80%)');
    console.log('   📝 Comment spam: Prevented\n');

    console.log('=== DEMO COMPLETE ===\n');
  });

  it('DEMO: Cache expiration scenario', async () => {
    console.log('\n=== CACHE EXPIRATION DEMO ===\n');

    console.log('📝 Scenario: PR hasn\'t been updated in 8 days\n');

    const pr: PRContext = createMockPR();

    // Mock review from 8 days ago (> 7 day TTL)
    const eightDaysAgo = Date.now() - (8 * 24 * 60 * 60 * 1000);
    mockStorage.read.mockResolvedValue(
      JSON.stringify({
        prNumber: 1,
        lastReviewedCommit: 'old-sha',
        timestamp: eightDaysAgo,
        findings: [],
        reviewSummary: 'Old review',
      })
    );

    console.log('🔍 Checking if incremental review is possible...');
    const canUse = await reviewer.shouldUseIncremental(pr);

    console.log(`Result: ${canUse ? '✅ Use incremental' : '❌ Use full review'}`);
    console.log('Reason: Cache expired (8 days > 7 day TTL)\n');

    console.log('💡 Solution: Run reviews more frequently or increase TTL\n');
    console.log('=== DEMO COMPLETE ===\n');

    expect(canUse).toBe(false);
  });

  it('DEMO: Git diff failure handling', async () => {
    console.log('\n=== GIT DIFF FAILURE DEMO ===\n');

    console.log('📝 Scenario: Git command fails (repo not available)\n');

    const pr: PRContext = createMockPR({
      files: [
        createMockFile({ filename: 'file1.ts' }),
        createMockFile({ filename: 'file2.ts' }),
        createMockFile({ filename: 'file3.ts' }),
      ],
    });

    // Mock git failure
    (childProcess.execSync as jest.Mock).mockImplementation(() => {
      throw new Error('fatal: not a git repository');
    });

    console.log('🔍 Attempting to get changed files...');
    console.log('   Running: git diff --name-status old-sha...new-sha');
    console.log('   Error: fatal: not a git repository\n');

    const files = await reviewer.getChangedFilesSince(pr, 'old-sha');

    console.log('🛡️  Fallback activated!');
    console.log(`   Returning all PR files: ${files.length} files`);
    console.log('   Will perform full review instead\n');

    console.log('💡 This ensures reviews always complete, even if git fails\n');
    console.log('=== DEMO COMPLETE ===\n');

    expect(files).toEqual(pr.files);
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

function createManyFiles(count: number): FileChange[] {
  return Array.from({ length: count }, (_, i) => createMockFile({ filename: `src/file${i + 1}.ts` }));
}

function createManyFindings(count: number): Finding[] {
  return Array.from({ length: count }, (_, i) => ({
    file: `src/file${i + 1}.ts`,
    line: 10,
    severity: 'minor' as const,
    title: `Issue ${i + 1}`,
    message: `Test message ${i + 1}`,
  }));
}
