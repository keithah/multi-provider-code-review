import { mapAddedLines, trimDiff } from '../../src/utils/diff';

describe('mapAddedLines', () => {
  it('maps added lines to absolute new-file line numbers', () => {
    const patch = `@@ -1,3 +1,4 @@\n line1\n+addedA\n line2\n@@ -10,2 +11,3 @@\n old\n+addedB\n+addedC\n`;

    const lines = mapAddedLines(patch);
    expect(lines).toEqual([
      { line: 2, content: 'addedA' },
      { line: 12, content: 'addedB' },
      { line: 13, content: 'addedC' },
    ]);
  });
});

describe('trimDiff', () => {
  it('returns full diff when under size limit', () => {
    const diff = 'diff --git a/file1.ts b/file1.ts\n+added line';
    const result = trimDiff(diff, 1000);
    expect(result).toBe(diff);
  });

  it('keeps complete files and truncates remaining files', () => {
    const file1 = 'diff --git a/file1.ts b/file1.ts\nindex abc..def\n--- a/file1.ts\n+++ b/file1.ts\n@@ -1,1 +1,2 @@\n line1\n+added1';
    const file2 = 'diff --git a/file2.ts b/file2.ts\nindex ghi..jkl\n--- a/file2.ts\n+++ b/file2.ts\n@@ -1,1 +1,2 @@\n line2\n+added2';
    const file3 = 'diff --git a/file3.ts b/file3.ts\nindex mno..pqr\n--- a/file3.ts\n+++ b/file3.ts\n@@ -1,1 +1,2 @@\n line3\n+added3';

    const diff = [file1, file2, file3].join('\n');
    const maxBytes = Buffer.byteLength(file1 + '\n' + file2, 'utf8') + 100; // Fit 2 files

    const result = trimDiff(diff, maxBytes);

    // Should include first 2 files completely
    expect(result).toContain('file1.ts');
    expect(result).toContain('file2.ts');
    expect(result).toContain('added1');
    expect(result).toContain('added2');

    // Should NOT include third file (prevents false positives)
    expect(result).not.toContain('file3.ts');
    expect(result).not.toContain('added3');

    // Should include truncation marker
    expect(result).toMatch(/1 file\(s\) truncated/);
  });

  it('preserves complete file chunks without splitting', () => {
    const file1 = 'diff --git a/small.ts b/small.ts\n+line';
    const file2 = 'diff --git a/large.ts b/large.ts\n' + 'x'.repeat(1000);

    const diff = [file1, file2].join('\n');
    const result = trimDiff(diff, 200);

    // Should include complete small file
    expect(result).toContain('diff --git a/small.ts b/small.ts');
    expect(result).toContain('+line');

    // Should NOT include large file (would be partial)
    expect(result).not.toContain('large.ts');
  });
});
