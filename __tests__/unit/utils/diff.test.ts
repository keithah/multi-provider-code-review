import { filterDiffByFiles } from '../../../src/utils/diff';

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
});
