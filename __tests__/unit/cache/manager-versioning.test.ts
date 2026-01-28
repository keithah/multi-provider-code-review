import { CacheManager } from '../../../src/cache/manager';
import { CacheStorage } from '../../../src/cache/storage';
import { PRContext, Review, ReviewConfig, Finding } from '../../../src/types';
import { CACHE_VERSION } from '../../../src/cache/version';
import { hashConfig } from '../../../src/cache/key-builder';

// Mock the storage
jest.mock('../../../src/cache/storage');

describe('CacheManager Versioning', () => {
  let manager: CacheManager;
  let mockStorage: jest.Mocked<CacheStorage>;
  let mockConfig: ReviewConfig;
  let mockPR: PRContext;

  const createMockReview = (findings: Finding[]): Review => ({
    findings,
    summary: 'Test review',
    inlineComments: [],
    actionItems: [],
    metrics: {
      totalFindings: findings.length,
      critical: 0,
      major: findings.length,
      minor: 0,
      providersUsed: 1,
      providersSuccess: 1,
      providersFailed: 0,
      totalTokens: 0,
      totalCost: 0,
      durationSeconds: 0,
    },
  });

  beforeEach(() => {
    mockStorage = new CacheStorage() as jest.Mocked<CacheStorage>;
    mockConfig = {
      enableAstAnalysis: true,
      enableSecurity: true,
      inlineMinSeverity: 'high',
      inlineMinAgreement: 0.6,
    } as unknown as ReviewConfig;
    manager = new CacheManager(mockStorage, mockConfig);

    mockPR = {
      baseSha: 'abc123',
      headSha: 'def456',
      number: 123,
    } as PRContext;
  });

  describe('Version Validation', () => {
    it('should load cache with matching version', async () => {
      const findings: Finding[] = [
        {
          file: 'test.ts',
          line: 10,
          severity: 'major',
          title: 'Test Finding',
          message: 'Test finding',
        } as Finding,
      ];

      const payload = {
        findings,
        timestamp: Date.now(),
      };

      const versioned = {
        version: CACHE_VERSION,
        timestamp: Date.now(),
        data: payload,
      };

      mockStorage.read.mockResolvedValue(JSON.stringify(versioned));

      const result = await manager.load(mockPR);

      expect(result).toEqual(findings);
    });

    it('should reject cache with old version', async () => {
      const findings: Finding[] = [
        {
          file: 'test.ts',
          line: 10,
          severity: 'major',
          title: 'Test Finding',
          message: 'Test finding',
        } as Finding,
      ];

      const payload = {
        findings,
        timestamp: Date.now(),
      };

      const versioned = {
        version: CACHE_VERSION - 1, // Old version
        timestamp: Date.now(),
        data: payload,
      };

      mockStorage.read.mockResolvedValue(JSON.stringify(versioned));

      const result = await manager.load(mockPR);

      expect(result).toBeNull();
    });

    it('should reject cache with future version', async () => {
      const findings: Finding[] = [
        {
          file: 'test.ts',
          line: 10,
          severity: 'major',
          title: 'Test Finding',
          message: 'Test finding',
        } as Finding,
      ];

      const payload = {
        findings,
        timestamp: Date.now(),
      };

      const versioned = {
        version: CACHE_VERSION + 1, // Future version
        timestamp: Date.now(),
        data: payload,
      };

      mockStorage.read.mockResolvedValue(JSON.stringify(versioned));

      const result = await manager.load(mockPR);

      expect(result).toBeNull();
    });
  });

  describe('TTL Validation', () => {
    it('should reject expired cache', async () => {
      const findings: Finding[] = [
        {
          file: 'test.ts',
          line: 10,
          severity: 'major',
          title: 'Test Finding',
          message: 'Test finding',
        } as Finding,
      ];

      const payload = {
        findings,
        timestamp: Date.now(),
      };

      const versioned = {
        version: CACHE_VERSION,
        timestamp: Date.now() - 8 * 24 * 60 * 60 * 1000, // 8 days ago (TTL is 7 days)
        data: payload,
      };

      mockStorage.read.mockResolvedValue(JSON.stringify(versioned));

      const result = await manager.load(mockPR);

      expect(result).toBeNull();
    });

    it('should accept cache within TTL', async () => {
      const findings: Finding[] = [
        {
          file: 'test.ts',
          line: 10,
          severity: 'major',
          title: 'Test Finding',
          message: 'Test finding',
        } as Finding,
      ];

      const payload = {
        findings,
        timestamp: Date.now(),
      };

      const versioned = {
        version: CACHE_VERSION,
        timestamp: Date.now() - 6 * 24 * 60 * 60 * 1000, // 6 days ago (within 7 day TTL)
        data: payload,
      };

      mockStorage.read.mockResolvedValue(JSON.stringify(versioned));

      const result = await manager.load(mockPR);

      expect(result).toEqual(findings);
    });
  });

  describe('Config Hash Integration', () => {
    it('should include config hash in cache key', async () => {
      const review = createMockReview([
        {
          file: 'test.ts',
          line: 10,
          severity: 'major',
          title: 'Test Finding',
          message: 'Test finding',
        } as Finding,
      ]);

      await manager.save(mockPR, review);

      const expectedConfigHash = hashConfig(mockConfig);
      const callArgs = mockStorage.write.mock.calls[0];
      const key = callArgs[0];

      expect(key).toContain(expectedConfigHash);
    });

    it('should use different keys for different configs', () => {
      const config1: ReviewConfig = {
        enableAstAnalysis: true,
        enableSecurity: true,
      } as unknown as ReviewConfig;

      const config2: ReviewConfig = {
        enableAstAnalysis: false,
        enableSecurity: true,
      } as unknown as ReviewConfig;

      const hash1 = hashConfig(config1);
      const hash2 = hashConfig(config2);

      expect(hash1).not.toBe(hash2);
    });

    it('should use same key for identical configs', () => {
      const config1: ReviewConfig = {
        enableAstAnalysis: true,
        enableSecurity: true,
        inlineMinSeverity: 'high',
      } as unknown as ReviewConfig;

      const config2: ReviewConfig = {
        enableAstAnalysis: true,
        enableSecurity: true,
        inlineMinSeverity: 'high',
      } as unknown as ReviewConfig;

      const hash1 = hashConfig(config1);
      const hash2 = hashConfig(config2);

      expect(hash1).toBe(hash2);
    });
  });

  describe('Save with Versioning', () => {
    it('should save with version metadata', async () => {
      const review = createMockReview([
        {
          file: 'test.ts',
          line: 10,
          severity: 'major',
          title: 'Test Finding',
          message: 'Test finding',
        } as Finding,
      ]);

      await manager.save(mockPR, review);

      expect(mockStorage.write).toHaveBeenCalledTimes(1);
      const callArgs = mockStorage.write.mock.calls[0];
      const serialized = callArgs[1];
      const parsed = JSON.parse(serialized);

      expect(parsed.version).toBe(CACHE_VERSION);
      expect(parsed.timestamp).toBeDefined();
      expect(parsed.data).toBeDefined();
      expect(parsed.data.findings).toEqual(review.findings);
    });

    it('should preserve all finding fields', async () => {
      const finding: Finding = {
        file: 'test.ts',
        line: 10,
        severity: 'major',
        title: 'Test Finding',
        message: 'Test finding',
        category: 'security',
        suggestion: 'Fix it',
        confidence: 0.9,
      } as Finding;

      const review = createMockReview([finding]);

      await manager.save(mockPR, review);

      const callArgs = mockStorage.write.mock.calls[0];
      const serialized = callArgs[1];
      const parsed = JSON.parse(serialized);

      expect(parsed.data.findings[0]).toMatchObject(finding);
    });
  });

  describe('Corrupted Cache Handling', () => {
    it('should handle malformed JSON gracefully', async () => {
      mockStorage.read.mockResolvedValue('not valid json');

      const result = await manager.load(mockPR);

      expect(result).toBeNull();
    });

    it('should handle missing fields gracefully', async () => {
      const invalid = { version: CACHE_VERSION };
      mockStorage.read.mockResolvedValue(JSON.stringify(invalid));

      const result = await manager.load(mockPR);

      expect(result).toBeNull();
    });

    it('should handle null data gracefully', async () => {
      mockStorage.read.mockResolvedValue(null);

      const result = await manager.load(mockPR);

      expect(result).toBeNull();
    });
  });

  describe('Cache Manager without Config', () => {
    it('should work without config', async () => {
      const managerWithoutConfig = new CacheManager(mockStorage);

      const review = createMockReview([]);

      await managerWithoutConfig.save(mockPR, review);

      expect(mockStorage.write).toHaveBeenCalled();
      const key = mockStorage.write.mock.calls[0][0];
      // Should not have config hash suffix
      expect(key.split('-').length).toBe(2); // mpr-<hash>
    });
  });
});
