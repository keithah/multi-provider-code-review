import { GitReader } from '../../../src/cli/git-reader';
import * as childProcess from 'child_process';

jest.mock('child_process');

describe('GitReader', () => {
  let reader: GitReader;

  beforeEach(() => {
    reader = new GitReader();
    jest.clearAllMocks();
  });

  describe('isGitRepo', () => {
    it('returns true when in a git repository', () => {
      (childProcess.execSync as jest.Mock).mockReturnValue('');
      expect(reader.isGitRepo()).toBe(true);
    });

    it('returns false when not in a git repository', () => {
      (childProcess.execSync as jest.Mock).mockImplementation(() => {
        throw new Error('not a git repository');
      });
      expect(reader.isGitRepo()).toBe(false);
    });
  });

  describe('getCurrentBranch', () => {
    it('returns current branch name', () => {
      (childProcess.execSync as jest.Mock).mockReturnValue('feature-branch\n');
      expect(reader.getCurrentBranch()).toBe('feature-branch');
    });

    it('throws error on failure', () => {
      (childProcess.execSync as jest.Mock).mockImplementation(() => {
        throw new Error('git error');
      });
      expect(() => reader.getCurrentBranch()).toThrow('Failed to get current branch');
    });
  });

  describe('getCurrentCommit', () => {
    it('returns current commit SHA', () => {
      (childProcess.execSync as jest.Mock).mockReturnValue('abc123def456\n');
      expect(reader.getCurrentCommit()).toBe('abc123def456');
    });
  });

  describe('parseDiff', () => {
    it('parses simple diff', async () => {
      const diff = `diff --git a/src/test.ts b/src/test.ts
index abc123..def456 100644
--- a/src/test.ts
+++ b/src/test.ts
@@ -1,3 +1,4 @@
 const x = 1;
+const y = 2;
 console.log(x);
`;

      const files = (reader as any).parseDiff(diff);
      expect(files).toHaveLength(1);
      expect(files[0].filename).toBe('src/test.ts');
      expect(files[0].status).toBe('modified');
      expect(files[0].additions).toBe(1);
      expect(files[0].deletions).toBe(0);
    });

    it('parses new file', async () => {
      const diff = `diff --git a/src/new.ts b/src/new.ts
new file mode 100644
index 0000000..abc123
--- /dev/null
+++ b/src/new.ts
@@ -0,0 +1,3 @@
+const x = 1;
+const y = 2;
+console.log(x);
`;

      const files = (reader as any).parseDiff(diff);
      expect(files).toHaveLength(1);
      expect(files[0].filename).toBe('src/new.ts');
      expect(files[0].status).toBe('added');
      expect(files[0].additions).toBe(3);
    });

    it('parses deleted file', async () => {
      const diff = `diff --git a/src/old.ts b/src/old.ts
deleted file mode 100644
index abc123..0000000
--- a/src/old.ts
+++ /dev/null
@@ -1,3 +0,0 @@
-const x = 1;
-const y = 2;
-console.log(x);
`;

      const files = (reader as any).parseDiff(diff);
      expect(files).toHaveLength(1);
      expect(files[0].filename).toBe('src/old.ts');
      expect(files[0].status).toBe('removed');
      expect(files[0].deletions).toBe(3);
    });

    it('parses multiple files', async () => {
      const diff = `diff --git a/src/file1.ts b/src/file1.ts
index abc123..def456 100644
--- a/src/file1.ts
+++ b/src/file1.ts
@@ -1,2 +1,3 @@
 const x = 1;
+const y = 2;
 console.log(x);
diff --git a/src/file2.ts b/src/file2.ts
index ghi789..jkl012 100644
--- a/src/file2.ts
+++ b/src/file2.ts
@@ -1,2 +1,2 @@
-const a = 1;
+const a = 2;
 console.log(a);
`;

      const files = (reader as any).parseDiff(diff);
      expect(files).toHaveLength(2);
      expect(files[0].filename).toBe('src/file1.ts');
      expect(files[1].filename).toBe('src/file2.ts');
    });
  });

  describe('getUncommittedChanges', () => {
    it('returns PR context for uncommitted changes', async () => {
      (childProcess.execSync as jest.Mock)
        .mockReturnValueOnce('feature-branch\n') // getCurrentBranch
        .mockReturnValueOnce('abc123\n') // getCurrentCommit
        .mockReturnValueOnce('Test User\n') // git user.name
        .mockReturnValueOnce(`diff --git a/src/test.ts b/src/test.ts
index abc123..def456 100644
--- a/src/test.ts
+++ b/src/test.ts
@@ -1,2 +1,3 @@
 const x = 1;
+const y = 2;
 console.log(x);
`); // git diff HEAD

      const pr = await reader.getUncommittedChanges();

      expect(pr.number).toBe(0);
      expect(pr.title).toContain('feature-branch');
      expect(pr.files).toHaveLength(1);
      expect(pr.files[0].filename).toBe('src/test.ts');
      expect(pr.additions).toBe(1);
      expect(pr.headSha).toBe('working-directory');
    });
  });

  describe('getCommitChanges', () => {
    it('returns PR context for specific commit', async () => {
      (childProcess.execSync as jest.Mock)
        .mockReturnValueOnce('abc123def456\n') // resolve commit
        .mockReturnValueOnce('parent123\n') // resolve parent
        .mockReturnValueOnce(`diff --git a/src/test.ts b/src/test.ts
index abc123..def456 100644
--- a/src/test.ts
+++ b/src/test.ts
@@ -1,2 +1,3 @@
 const x = 1;
+const y = 2;
 console.log(x);
`) // git diff
        .mockReturnValueOnce('Fix bug\n\nDetailed message\n') // git log
        .mockReturnValueOnce('Test User\n'); // git user.name

      const pr = await reader.getCommitChanges('HEAD~1');

      expect(pr.number).toBe(0);
      expect(pr.title).toContain('abc123d');
      expect(pr.body).toContain('Fix bug');
      expect(pr.files).toHaveLength(1);
      expect(pr.baseSha).toBe('parent123');
      expect(pr.headSha).toBe('abc123def456');
    });
  });

  describe('getBranchChanges', () => {
    it('returns PR context for branch comparison', async () => {
      (childProcess.execSync as jest.Mock)
        .mockReturnValueOnce('main-sha\n') // resolve base
        .mockReturnValueOnce('head-sha\n') // resolve head
        .mockReturnValueOnce(`diff --git a/src/test.ts b/src/test.ts
index abc123..def456 100644
--- a/src/test.ts
+++ b/src/test.ts
@@ -1,2 +1,3 @@
 const x = 1;
+const y = 2;
 console.log(x);
`) // git diff
        .mockReturnValueOnce('Test User\n'); // git user.name

      const pr = await reader.getBranchChanges('main', 'feature');

      expect(pr.number).toBe(0);
      expect(pr.title).toBe('Changes from main to feature');
      expect(pr.files).toHaveLength(1);
      expect(pr.baseSha).toBe('main-sha');
      expect(pr.headSha).toBe('head-sha');
    });
  });
});
