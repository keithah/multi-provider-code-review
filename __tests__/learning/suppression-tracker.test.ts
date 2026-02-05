import { SuppressionTracker, SuppressionPattern } from '../../src/learning/suppression-tracker';
import { CacheStorage } from '../../src/cache/storage';
import * as fs from 'fs/promises';
import * as path from 'path';

describe('SuppressionTracker', () => {
  let storage: CacheStorage;
  let tracker: SuppressionTracker;
  const testCacheDir = path.join(process.cwd(), '.test-cache-suppression');
  const repoKey = 'test-repo';

  beforeEach(async () => {
    storage = new CacheStorage(testCacheDir);
    tracker = new SuppressionTracker(storage, repoKey);
    // Clear any existing test cache
    await fs.rm(testCacheDir, { recursive: true, force: true });
  });

  afterEach(async () => {
    await fs.rm(testCacheDir, { recursive: true, force: true });
  });

  describe('recordDismissal', () => {
    it('should record PR-scoped dismissal', async () => {
      const finding = {
        category: 'null-check',
        file: 'src/utils.ts',
        line: 42,
      };

      await tracker.recordDismissal(finding, 'pr', 123);

      // Verify pattern was recorded
      const shouldSuppress = await tracker.shouldSuppress(finding, 123);
      expect(shouldSuppress).toBe(true);
    });

    it('should record repo-scoped dismissal', async () => {
      const finding = {
        category: 'type-safety',
        file: 'src/types.ts',
        line: 100,
      };

      await tracker.recordDismissal(finding, 'repo');

      // Should suppress in any PR
      const shouldSuppress1 = await tracker.shouldSuppress(finding, 123);
      const shouldSuppress2 = await tracker.shouldSuppress(finding, 456);
      expect(shouldSuppress1).toBe(true);
      expect(shouldSuppress2).toBe(true);
    });

    it('should set correct TTL for PR scope (7 days)', async () => {
      const finding = {
        category: 'null-check',
        file: 'src/test.ts',
        line: 10,
      };

      await tracker.recordDismissal(finding, 'pr', 100);

      // Manually verify expiry time is ~7 days from now
      const raw = await storage.read(`suppression-${repoKey}`);
      expect(raw).not.toBeNull();
      const data = JSON.parse(raw!);
      const pattern = data.patterns[0];
      const expectedExpiry = pattern.timestamp + 7 * 24 * 60 * 60 * 1000;
      expect(pattern.expiresAt).toBe(expectedExpiry);
    });

    it('should set correct TTL for repo scope (30 days)', async () => {
      const finding = {
        category: 'null-check',
        file: 'src/test.ts',
        line: 10,
      };

      await tracker.recordDismissal(finding, 'repo');

      // Manually verify expiry time is ~30 days from now
      const raw = await storage.read(`suppression-${repoKey}`);
      expect(raw).not.toBeNull();
      const data = JSON.parse(raw!);
      const pattern = data.patterns[0];
      const expectedExpiry = pattern.timestamp + 30 * 24 * 60 * 60 * 1000;
      expect(pattern.expiresAt).toBe(expectedExpiry);
    });
  });

  describe('shouldSuppress', () => {
    it('should suppress exact match (same file, category, line)', async () => {
      const finding = {
        category: 'null-check',
        file: 'src/utils.ts',
        line: 42,
      };

      await tracker.recordDismissal(finding, 'pr', 123);

      const shouldSuppress = await tracker.shouldSuppress(finding, 123);
      expect(shouldSuppress).toBe(true);
    });

    it('should suppress near match (within 5 lines)', async () => {
      const dismissedFinding = {
        category: 'type-safety',
        file: 'src/api.ts',
        line: 100,
      };

      await tracker.recordDismissal(dismissedFinding, 'repo');

      // Test lines 95-105 should all be suppressed
      for (let line = 95; line <= 105; line++) {
        const finding = { ...dismissedFinding, line };
        const shouldSuppress = await tracker.shouldSuppress(finding, 123);
        expect(shouldSuppress).toBe(true);
      }
    });

    it('should NOT suppress if line is > 5 lines away', async () => {
      const dismissedFinding = {
        category: 'null-check',
        file: 'src/test.ts',
        line: 50,
      };

      await tracker.recordDismissal(dismissedFinding, 'repo');

      // Line 44 is 6 lines away - should NOT suppress
      const finding = { ...dismissedFinding, line: 44 };
      const shouldSuppress = await tracker.shouldSuppress(finding, 123);
      expect(shouldSuppress).toBe(false);

      // Line 56 is 6 lines away - should NOT suppress
      const finding2 = { ...dismissedFinding, line: 56 };
      const shouldSuppress2 = await tracker.shouldSuppress(finding2, 123);
      expect(shouldSuppress2).toBe(false);
    });

    it('should NOT suppress different file', async () => {
      const dismissedFinding = {
        category: 'null-check',
        file: 'src/utils.ts',
        line: 42,
      };

      await tracker.recordDismissal(dismissedFinding, 'repo');

      // Different file - should NOT suppress
      const finding = { ...dismissedFinding, file: 'src/other.ts' };
      const shouldSuppress = await tracker.shouldSuppress(finding, 123);
      expect(shouldSuppress).toBe(false);
    });

    it('should NOT suppress different category', async () => {
      const dismissedFinding = {
        category: 'null-check',
        file: 'src/utils.ts',
        line: 42,
      };

      await tracker.recordDismissal(dismissedFinding, 'repo');

      // Different category - should NOT suppress
      const finding = { ...dismissedFinding, category: 'type-safety' };
      const shouldSuppress = await tracker.shouldSuppress(finding, 123);
      expect(shouldSuppress).toBe(false);
    });

    it('should enforce PR scope (only suppress within same PR)', async () => {
      const finding = {
        category: 'null-check',
        file: 'src/test.ts',
        line: 10,
      };

      // Record dismissal for PR 100
      await tracker.recordDismissal(finding, 'pr', 100);

      // Should suppress in PR 100
      const shouldSuppressSamePR = await tracker.shouldSuppress(finding, 100);
      expect(shouldSuppressSamePR).toBe(true);

      // Should NOT suppress in PR 200
      const shouldSuppressDifferentPR = await tracker.shouldSuppress(finding, 200);
      expect(shouldSuppressDifferentPR).toBe(false);
    });

    it('should NOT suppress expired patterns', async () => {
      const finding = {
        category: 'null-check',
        file: 'src/test.ts',
        line: 10,
      };

      // Manually create an expired pattern
      const expiredPattern: SuppressionPattern = {
        id: 'test-expired',
        category: finding.category,
        file: finding.file,
        line: finding.line,
        scope: 'repo',
        timestamp: Date.now() - 31 * 24 * 60 * 60 * 1000, // 31 days ago
        expiresAt: Date.now() - 1 * 24 * 60 * 60 * 1000, // Expired 1 day ago
      };

      // Write directly to storage
      await storage.write(`suppression-${repoKey}`, JSON.stringify({
        patterns: [expiredPattern],
        lastCleanup: Date.now(),
      }));

      const shouldSuppress = await tracker.shouldSuppress(finding, 123);
      expect(shouldSuppress).toBe(false);
    });
  });

  describe('clearExpired', () => {
    it('should remove expired patterns and return count', async () => {
      const now = Date.now();

      // Create mix of expired and active patterns
      const patterns: SuppressionPattern[] = [
        {
          id: 'expired-1',
          category: 'null-check',
          file: 'src/a.ts',
          line: 10,
          scope: 'repo',
          timestamp: now - 31 * 24 * 60 * 60 * 1000,
          expiresAt: now - 1 * 24 * 60 * 60 * 1000, // Expired
        },
        {
          id: 'active-1',
          category: 'type-safety',
          file: 'src/b.ts',
          line: 20,
          scope: 'repo',
          timestamp: now,
          expiresAt: now + 29 * 24 * 60 * 60 * 1000, // Active
        },
        {
          id: 'expired-2',
          category: 'performance',
          file: 'src/c.ts',
          line: 30,
          scope: 'pr',
          prNumber: 100,
          timestamp: now - 8 * 24 * 60 * 60 * 1000,
          expiresAt: now - 1 * 24 * 60 * 60 * 1000, // Expired
        },
      ];

      await storage.write(`suppression-${repoKey}`, JSON.stringify({
        patterns,
        lastCleanup: now,
      }));

      const clearedCount = await tracker.clearExpired();
      expect(clearedCount).toBe(2); // Two expired patterns

      // Verify only active pattern remains
      const raw = await storage.read(`suppression-${repoKey}`);
      const data = JSON.parse(raw!);
      expect(data.patterns).toHaveLength(1);
      expect(data.patterns[0].id).toBe('active-1');
    });

    it('should return 0 if no patterns are expired', async () => {
      const now = Date.now();

      const patterns: SuppressionPattern[] = [
        {
          id: 'active-1',
          category: 'null-check',
          file: 'src/test.ts',
          line: 10,
          scope: 'repo',
          timestamp: now,
          expiresAt: now + 29 * 24 * 60 * 60 * 1000,
        },
      ];

      await storage.write(`suppression-${repoKey}`, JSON.stringify({
        patterns,
        lastCleanup: now,
      }));

      const clearedCount = await tracker.clearExpired();
      expect(clearedCount).toBe(0);
    });
  });
});
