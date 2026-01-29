import {
  estimateTokensForFile,
  estimateTokensForFiles,
  calculateOptimalBatchSize,
} from '../../../src/utils/token-estimation';
import { FileChange } from '../../../src/types';

describe('Dynamic Batch Sizing', () => {
  const createMockFile = (filename: string, additions: number, deletions: number): FileChange => ({
    filename,
    status: 'modified',
    additions,
    deletions,
    changes: additions + deletions,
  });

  const createMockFileWithPatch = (filename: string, patch: string): FileChange => ({
    filename,
    status: 'modified',
    additions: 10,
    deletions: 5,
    changes: 15,
    patch,
  });

  describe('estimateTokensForFile', () => {
    it('should use patch content when available', () => {
      const file = createMockFileWithPatch('test.ts', 'diff --git a/test.ts b/test.ts\n@@ -1,5 +1,5 @@\n' + '-old\n'.repeat(50) + '+new\n'.repeat(50));
      const tokens = estimateTokensForFile(file);

      expect(tokens).toBeGreaterThan(0);
      // Diff format is ~10% more efficient, so should be less than raw char count / 4
      expect(tokens).toBeLessThan(file.patch!.length / 3);
    });

    it('should estimate from additions/deletions when no patch', () => {
      const file = createMockFile('test.ts', 100, 50);
      const tokens = estimateTokensForFile(file);

      // 150 lines * 20 tokens/line = 3000 tokens
      expect(tokens).toBe(3000);
    });

    it('should handle files with no changes', () => {
      const file = createMockFile('test.ts', 0, 0);
      const tokens = estimateTokensForFile(file);

      expect(tokens).toBe(0);
    });

    it('should scale with file size', () => {
      const smallFile = createMockFile('small.ts', 10, 5);
      const largeFile = createMockFile('large.ts', 1000, 500);

      const smallTokens = estimateTokensForFile(smallFile);
      const largeTokens = estimateTokensForFile(largeFile);

      expect(largeTokens).toBeGreaterThan(smallTokens);
      expect(largeTokens).toBe(largeFile.changes * 20); // 1500 * 20 = 30000
    });
  });

  describe('estimateTokensForFiles', () => {
    it('should sum tokens for all files', () => {
      const files = [
        createMockFile('file1.ts', 10, 5),   // 300 tokens
        createMockFile('file2.ts', 20, 10),  // 600 tokens
        createMockFile('file3.ts', 30, 15),  // 900 tokens
      ];

      const total = estimateTokensForFiles(files);

      expect(total).toBe((15 + 30 + 45) * 20); // 1800 tokens
    });

    it('should handle empty file list', () => {
      const total = estimateTokensForFiles([]);
      expect(total).toBe(0);
    });

    it('should handle mix of files with and without patches', () => {
      const files = [
        createMockFileWithPatch('file1.ts', 'diff --git a/file1.ts b/file1.ts\n@@ -1 +1 @@\n-old\n+new\n'),
        createMockFile('file2.ts', 10, 5),
      ];

      const total = estimateTokensForFiles(files);
      expect(total).toBeGreaterThan(0);
    });
  });

  describe('calculateOptimalBatchSize', () => {
    it('should create single batch for small PR', () => {
      const files = [
        createMockFile('file1.ts', 10, 5),
        createMockFile('file2.ts', 10, 5),
      ];

      const result = calculateOptimalBatchSize(files, 50000, 200);

      expect(result.batches.length).toBe(1);
      expect(result.batches[0].length).toBe(2);
      expect(result.batchSize).toBe(2);
      expect(result.reason).toContain('single batch');
    });

    it('should split large files into multiple batches', () => {
      // Create files that exceed target token budget
      const files = [
        createMockFile('huge1.ts', 5000, 0),  // 100k tokens
        createMockFile('huge2.ts', 5000, 0),  // 100k tokens
        createMockFile('huge3.ts', 5000, 0),  // 100k tokens
      ];

      const result = calculateOptimalBatchSize(files, 50000, 200);

      // Each file exceeds target, so should be in separate batches
      expect(result.batches.length).toBeGreaterThan(1);
      expect(result.reason).toContain('Large files');
    });

    it('should pack small files efficiently', () => {
      // Create many small files
      const files = Array(100).fill(null).map((_, i) =>
        createMockFile(`file${i}.ts`, 10, 5)  // 300 tokens each
      );

      const result = calculateOptimalBatchSize(files, 50000, 200);

      // 50000 / 300 = ~166 files per batch
      // 100 files should fit in single batch
      expect(result.batches.length).toBe(1);
      expect(result.batchSize).toBe(100);
      expect(result.reason).toContain('single batch');
    });

    it('should respect max files per batch', () => {
      // Create more small files than max allows
      const files = Array(300).fill(null).map((_, i) =>
        createMockFile(`file${i}.ts`, 1, 0)  // 20 tokens each
      );

      const result = calculateOptimalBatchSize(files, 100000, 100); // Max 100 files

      // Should split into 3 batches of 100 each
      expect(result.batches.length).toBe(3);
      expect(result.batches[0].length).toBe(100);
      expect(result.batches[1].length).toBe(100);
      expect(result.batches[2].length).toBe(100);
    });

    it('should use greedy bin packing for mixed file sizes', () => {
      const files = [
        createMockFile('large1.ts', 1000, 0),  // 20k tokens
        createMockFile('large2.ts', 1000, 0),  // 20k tokens
        createMockFile('medium1.ts', 500, 0),  // 10k tokens
        createMockFile('medium2.ts', 500, 0),  // 10k tokens
        createMockFile('small1.ts', 10, 0),    // 200 tokens
        createMockFile('small2.ts', 10, 0),    // 200 tokens
      ];

      const result = calculateOptimalBatchSize(files, 30000, 200);

      // Should pack files to maximize utilization
      expect(result.batches.length).toBeGreaterThan(1);
      expect(result.estimatedTokensPerBatch).toBeGreaterThan(0);
      expect(result.estimatedTokensPerBatch).toBeLessThanOrEqual(35000); // Within tolerance
    });

    it('should handle empty file list', () => {
      const result = calculateOptimalBatchSize([], 50000, 200);

      expect(result.batches.length).toBe(0);
      expect(result.batchSize).toBe(0);
      expect(result.reason).toContain('No files');
    });

    it('should handle single large file', () => {
      const files = [createMockFile('huge.ts', 10000, 0)]; // 200k tokens

      const result = calculateOptimalBatchSize(files, 50000, 200);

      expect(result.batches.length).toBe(1);
      expect(result.batches[0].length).toBe(1);
    });

    it('should provide meaningful reasons', () => {
      // Test different scenarios produce different reasons
      const smallFiles = Array(10).fill(null).map((_, i) => createMockFile(`file${i}.ts`, 1, 0));
      const largeFiles = Array(3).fill(null).map((_, i) => createMockFile(`file${i}.ts`, 5000, 0));
      const mixedFiles = [
        ...Array(50).fill(null).map((_, i) => createMockFile(`small${i}.ts`, 10, 0)),
        ...Array(2).fill(null).map((_, i) => createMockFile(`large${i}.ts`, 1000, 0)),
      ];

      const smallResult = calculateOptimalBatchSize(smallFiles, 50000, 200);
      const largeResult = calculateOptimalBatchSize(largeFiles, 50000, 200);
      const mixedResult = calculateOptimalBatchSize(mixedFiles, 50000, 200);

      expect(smallResult.reason).toBeTruthy();
      expect(largeResult.reason).toBeTruthy();
      expect(mixedResult.reason).toBeTruthy();
      // Reasons should be different for different scenarios
      expect(smallResult.reason).not.toBe(largeResult.reason);
    });

    it('should calculate average tokens per batch', () => {
      const files = Array(100).fill(null).map((_, i) =>
        createMockFile(`file${i}.ts`, 50, 50)  // 2000 tokens each
      );

      const result = calculateOptimalBatchSize(files, 50000, 200);

      // 100 files * 2000 tokens = 200k total
      // Should be split into batches
      expect(result.estimatedTokensPerBatch).toBeGreaterThan(0);
      expect(result.estimatedTokensPerBatch).toBeLessThanOrEqual(60000); // Close to target with tolerance
    });

    it('should handle custom target token budget', () => {
      const files = Array(100).fill(null).map((_, i) =>
        createMockFile(`file${i}.ts`, 50, 50)  // 2000 tokens each
      );

      const smallTarget = calculateOptimalBatchSize(files, 10000, 200);
      const largeTarget = calculateOptimalBatchSize(files, 100000, 200);

      // Smaller target should create more batches
      expect(smallTarget.batches.length).toBeGreaterThan(largeTarget.batches.length);
    });

    it('should sort files by size for optimal packing', () => {
      // Create files with very different sizes
      const files = [
        createMockFile('tiny.ts', 1, 0),       // 20 tokens
        createMockFile('huge.ts', 5000, 0),    // 100k tokens
        createMockFile('small.ts', 10, 0),     // 200 tokens
        createMockFile('large.ts', 1000, 0),   // 20k tokens
      ];

      const result = calculateOptimalBatchSize(files, 50000, 200);

      // First batch should contain the largest file(s)
      // (Greedy algorithm packs largest first)
      expect(result.batches.length).toBeGreaterThan(0);
    });
  });

  describe('Edge Cases', () => {
    it('should handle files with no patch and no changes', () => {
      const file = createMockFile('empty.ts', 0, 0);
      const tokens = estimateTokensForFile(file);

      expect(tokens).toBe(0);
    });

    it('should handle very large target token budget', () => {
      const files = Array(10).fill(null).map((_, i) =>
        createMockFile(`file${i}.ts`, 100, 100)
      );

      const result = calculateOptimalBatchSize(files, 1000000, 200);

      // All files should fit in single batch
      expect(result.batches.length).toBe(1);
    });

    it('should handle very small target token budget', () => {
      const files = Array(10).fill(null).map((_, i) =>
        createMockFile(`file${i}.ts`, 100, 100)  // 4000 tokens each
      );

      const result = calculateOptimalBatchSize(files, 100, 200);

      // Each file exceeds budget, so each in separate batch
      expect(result.batches.length).toBe(10);
    });

    it('should handle max files of 1', () => {
      const files = Array(5).fill(null).map((_, i) =>
        createMockFile(`file${i}.ts`, 10, 10)
      );

      const result = calculateOptimalBatchSize(files, 50000, 1);

      // Each batch can only have 1 file
      expect(result.batches.length).toBe(5);
      expect(result.batches.every(b => b.length === 1)).toBe(true);
    });
  });
});
