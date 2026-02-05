import { filterDiffByFiles, isRangeWithinSingleHunk } from '../../../src/utils/diff';

const sampleDiff = `diff --git a/src/old.ts b/src/new.ts
similarity index 88%
rename from src/old.ts
rename to src/new.ts
index 123..456 100644
--- a/src/old.ts
+++ b/src/new.ts
@@
+added line
diff --git a/src/keep.ts b/src/keep.ts
index 111..222 100644
--- a/src/keep.ts
+++ b/src/keep.ts
@@
-old
+new
diff --git a/src/remove.ts b/src/remove.ts
deleted file mode 100644
index abc..000 100644
--- a/src/remove.ts
+++ /dev/null
@@
-gone
`;

describe('filterDiffByFiles', () => {
  it('returns only chunks for requested files including renames', () => {
    const result = filterDiffByFiles(sampleDiff, [
      { filename: 'src/new.ts' },
      { filename: 'src/keep.ts' },
    ]);

    expect(result).toContain('diff --git a/src/old.ts b/src/new.ts');
    expect(result).toContain('rename to src/new.ts');
    expect(result).toContain('diff --git a/src/keep.ts b/src/keep.ts');
    expect(result).not.toContain('src/remove.ts');
  });

  it('returns empty string when no files are requested', () => {
    const result = filterDiffByFiles(sampleDiff, []);
    expect(result).toBe('');
  });

  it('includes deletion hunks when the deleted file is requested', () => {
    const result = filterDiffByFiles(sampleDiff, [{ filename: 'src/remove.ts' }]);
    expect(result).toContain('deleted file mode');
    expect(result).toContain('diff --git a/src/remove.ts b/src/remove.ts');
  });

  it('handles paths with spaces and binary diffs', () => {
    const diff = `diff --git a/docs/My File.md b/docs/My File.md
Binary files a/docs/My File.md and b/docs/My File.md differ
diff --git a/img/logo.png b/img/logo.png
Binary files a/img/logo.png and b/img/logo.png differ
`;

    const result = filterDiffByFiles(diff, [{ filename: 'docs/My File.md' }]);
    expect(result).toContain('docs/My File.md');
    expect(result).not.toContain('img/logo.png');
  });

  it('is robust to unusual whitespace in diff headers', () => {
    const diff = `diff --git   a/src/weird.ts\tb/src/weird.ts
--- a/src/weird.ts
+++ b/src/weird.ts
@@
`;
    const result = filterDiffByFiles(diff, [{ filename: 'src/weird.ts' }]);
    expect(result).toContain('src/weird.ts');
  });
});

describe('isRangeWithinSingleHunk', () => {
  describe('single hunk patches', () => {
    const singleHunkPatch = `@@ -1,3 +1,5 @@
 context
+line 2
+line 3
+line 4
 more context`;

    it('returns true for range within single hunk', () => {
      expect(isRangeWithinSingleHunk(2, 4, singleHunkPatch)).toBe(true);
    });

    it('returns true for range at start of hunk', () => {
      expect(isRangeWithinSingleHunk(1, 2, singleHunkPatch)).toBe(true);
    });

    it('returns true for range at end of hunk', () => {
      expect(isRangeWithinSingleHunk(4, 5, singleHunkPatch)).toBe(true);
    });

    it('returns true for single-line range within hunk', () => {
      expect(isRangeWithinSingleHunk(3, 3, singleHunkPatch)).toBe(true);
    });
  });

  describe('multiple non-contiguous hunks', () => {
    const multiHunkPatch = `@@ -1,3 +1,4 @@
 context
+added at line 2
 more context
 line 4
@@ -10,3 +11,4 @@
 distant context
+added at line 12
 more distant`;

    it('returns true for range within first hunk', () => {
      expect(isRangeWithinSingleHunk(1, 4, multiHunkPatch)).toBe(true);
    });

    it('returns true for range within second hunk', () => {
      expect(isRangeWithinSingleHunk(11, 13, multiHunkPatch)).toBe(true);
    });

    it('returns false for range crossing hunks', () => {
      expect(isRangeWithinSingleHunk(4, 12, multiHunkPatch)).toBe(false);
    });

    it('returns false for range spanning from first to second hunk', () => {
      expect(isRangeWithinSingleHunk(2, 11, multiHunkPatch)).toBe(false);
    });
  });

  describe('edge cases', () => {
    it('returns false for undefined patch', () => {
      expect(isRangeWithinSingleHunk(1, 5, undefined)).toBe(false);
    });

    it('returns false for empty patch', () => {
      expect(isRangeWithinSingleHunk(1, 5, '')).toBe(false);
    });

    it('returns false for range where lines exist but span different hunks', () => {
      const multiHunk = `@@ -1,2 +1,3 @@
 line 1
+added line 2
 line 3
@@ -20,2 +21,3 @@
 line 21
+added line 22
 line 23`;
      expect(isRangeWithinSingleHunk(2, 22, multiHunk)).toBe(false);
    });

    it('handles patch with no newline marker correctly', () => {
      const patchWithMarker = `@@ -1,2 +1,3 @@
 line 1
+added
 line 2
\\ No newline at end of file`;
      expect(isRangeWithinSingleHunk(1, 3, patchWithMarker)).toBe(true);
    });
  });
});
