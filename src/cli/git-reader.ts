import { execFileSync } from 'child_process';
import { createHash } from 'crypto';
import { PRContext, FileChange } from '../types';
import { logger } from '../utils/logger';

/**
 * Reads git diffs from local repository for CLI mode
 */
export class GitReader {
  // Git's empty tree SHA for repos with no commits
  private static readonly EMPTY_TREE_SHA = '4b825dc642cb6eb9a060e54bf8d69288fbee4904';
  private static readonly MAX_BUFFER = 10 * 1024 * 1024; // 10MB

  /**
   * Get current branch name
   */
  getCurrentBranch(): string {
    try {
      return execFileSync('git', ['rev-parse', '--abbrev-ref', 'HEAD'], { encoding: 'utf8' }).trim();
    } catch (error) {
      throw new Error(`Failed to get current branch: ${error}`);
    }
  }

  /**
   * Get current commit SHA, or null if no commits exist yet
   */
  getCurrentCommit(): string | null {
    try {
      return execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim();
    } catch (error) {
      // HEAD doesn't exist in brand-new repos with no commits
      return null;
    }
  }

  /**
   * Get base commit for comparison
   */
  getBaseCommit(target?: string): string {
    try {
      if (target) {
        // If target specified (e.g., HEAD~1, main), resolve it
        return execFileSync('git', ['rev-parse', target], { encoding: 'utf8' }).trim();
      }

      // Default: compare against main/master branch
      const defaultBranch = this.getDefaultBranch();
      return execFileSync('git', ['rev-parse', defaultBranch], { encoding: 'utf8' }).trim();
    } catch (error) {
      throw new Error(`Failed to get base commit: ${error}`);
    }
  }

  /**
   * Get default branch name (main or master)
   */
  private getDefaultBranch(): string {
    try {
      // Try to get remote default branch
      const result = execFileSync('git', ['symbolic-ref', 'refs/remotes/origin/HEAD'], { encoding: 'utf8' }).trim();
      return result.replace('refs/remotes/origin/', '');
    } catch {
      // Fallback: check if main exists, otherwise use master
      try {
        execFileSync('git', ['rev-parse', '--verify', 'main'], { encoding: 'utf8' });
        return 'main';
      } catch {
        return 'master';
      }
    }
  }

  /**
   * Get uncommitted changes (working directory + staged)
   */
  async getUncommittedChanges(): Promise<PRContext> {
    logger.info('Reading uncommitted changes');

    const currentBranch = this.getCurrentBranch();
    const currentCommit = this.getCurrentCommit();

    // Handle repos with no commits - diff against empty tree
    const baseSha = currentCommit || GitReader.EMPTY_TREE_SHA;
    const diffTarget = currentCommit ? 'HEAD' : GitReader.EMPTY_TREE_SHA;

    // Get diff for uncommitted changes
    const diff = this.executeGitDiff(['diff', diffTarget]);
    const files = this.parseDiff(diff);

    // Generate stable ID from branch + base commit for incremental cache
    const contextId = this.generateContextId(`uncommitted:${currentBranch}:${baseSha}`);

    return {
      number: contextId,
      title: `Local changes on ${currentBranch}`,
      body: 'Uncommitted changes',
      author: this.getGitUser(),
      draft: false,
      labels: [],
      files,
      diff,
      additions: files.reduce((sum, f) => sum + f.additions, 0),
      deletions: files.reduce((sum, f) => sum + f.deletions, 0),
      baseSha,
      headSha: 'working-directory',
    };
  }

  /**
   * Get changes for a specific commit
   */
  async getCommitChanges(commitRef: string): Promise<PRContext> {
    logger.info(`Reading changes for commit ${commitRef}`);

    const commitSha = execFileSync('git', ['rev-parse', commitRef], { encoding: 'utf8' }).trim();

    // Try to get parent commit - initial commits have no parent
    let parentSha: string;
    let isInitialCommit = false;

    try {
      parentSha = execFileSync('git', ['rev-parse', `${commitRef}^`], { encoding: 'utf8' }).trim();
    } catch (error) {
      // No parent - this is the initial commit
      parentSha = GitReader.EMPTY_TREE_SHA;
      isInitialCommit = true;
      logger.debug('Processing initial commit (no parent)');
    }

    // Get diff for this commit
    // For initial commits, diff against empty tree
    const diff = this.executeGitDiff(['diff', parentSha, commitSha]);
    const files = this.parseDiff(diff);

    // Get commit message
    const message = execFileSync('git', ['log', '-1', '--pretty=%B', commitSha], { encoding: 'utf8' }).trim();

    // Generate stable ID from commit SHA for incremental cache
    const contextId = this.generateContextId(`commit:${commitSha}`);

    return {
      number: contextId,
      title: `Commit ${commitSha.substring(0, 7)}${isInitialCommit ? ' (initial)' : ''}`,
      body: message,
      author: this.getGitUser(),
      draft: false,
      labels: [],
      files,
      diff,
      additions: files.reduce((sum, f) => sum + f.additions, 0),
      deletions: files.reduce((sum, f) => sum + f.deletions, 0),
      baseSha: parentSha,
      headSha: commitSha,
    };
  }

  /**
   * Get changes between two commits/branches
   */
  async getBranchChanges(base: string, head?: string): Promise<PRContext> {
    const baseSha = this.getBaseCommit(base);
    const headSha = head
      ? execFileSync('git', ['rev-parse', head], { encoding: 'utf8' }).trim()
      : this.getCurrentCommit() || GitReader.EMPTY_TREE_SHA;

    logger.info(`Reading changes from ${baseSha.substring(0, 7)} to ${headSha.substring(0, 7)}`);

    // Get diff between commits
    const diff = this.executeGitDiff(['diff', baseSha, headSha]);
    const files = this.parseDiff(diff);

    // Generate stable ID from base and head SHAs for incremental cache
    const contextId = this.generateContextId(`range:${baseSha}:${headSha}`);

    return {
      number: contextId,
      title: `Changes from ${base} to ${head || 'HEAD'}`,
      body: `Comparing ${base}..${head || 'HEAD'}`,
      author: this.getGitUser(),
      draft: false,
      labels: [],
      files,
      diff,
      additions: files.reduce((sum, f) => sum + f.additions, 0),
      deletions: files.reduce((sum, f) => sum + f.deletions, 0),
      baseSha,
      headSha,
    };
  }

  /**
   * Execute git diff command with proper error handling for large diffs
   */
  private executeGitDiff(args: string[]): string {
    try {
      return execFileSync('git', args, {
        encoding: 'utf8',
        maxBuffer: GitReader.MAX_BUFFER,
      });
    } catch (error: any) {
      if (error.code === 'ERR_CHILD_PROCESS_STDIO_MAXBUFFER') {
        const sizeInMB = Math.round(GitReader.MAX_BUFFER / 1024 / 1024);
        throw new Error(
          `Diff exceeds maximum size of ${sizeInMB}MB. ` +
          `Consider reviewing smaller changes or increasing MAX_BUFFER.`
        );
      }
      throw error;
    }
  }

  /**
   * Parse git diff output into FileChange objects
   * Uses string operations instead of complex regex to avoid ReDoS
   */
  private parseDiff(diff: string): FileChange[] {
    // Limit diff size to prevent ReDoS attacks
    const MAX_DIFF_SIZE = 10 * 1024 * 1024; // 10MB
    if (diff.length > MAX_DIFF_SIZE) {
      logger.warn(`Diff size ${diff.length} exceeds max ${MAX_DIFF_SIZE}, truncating`);
      diff = diff.substring(0, MAX_DIFF_SIZE);
    }

    const files: FileChange[] = [];
    const patches = diff.split(/^diff --git /m).filter(Boolean);

    for (const patch of patches) {
      const lines = patch.split('\n');
      if (lines.length === 0) continue;

      // Parse filename using string operations instead of regex to avoid ReDoS
      const firstLine = lines[0];
      const aIndex = firstLine.indexOf('a/');
      const bIndex = firstLine.indexOf(' b/', aIndex);

      if (aIndex === -1 || bIndex === -1) continue;

      const filename = firstLine.substring(bIndex + 3).trim();
      let status: FileChange['status'] = 'modified';
      let additions = 0;
      let deletions = 0;

      // Detect file status using simple string checks
      const patchText = patch;
      if (patchText.includes('new file mode')) {
        status = 'added';
      } else if (patchText.includes('deleted file mode')) {
        status = 'removed';
      } else if (patchText.includes('rename from')) {
        status = 'renamed';
      }

      // Count additions and deletions
      for (const line of lines) {
        if (line.startsWith('+') && !line.startsWith('+++')) {
          additions++;
        } else if (line.startsWith('-') && !line.startsWith('---')) {
          deletions++;
        }
      }

      files.push({
        filename,
        status,
        additions,
        deletions,
        changes: additions + deletions,
        patch: lines.join('\n'),
      });
    }

    return files;
  }

  /**
   * Get git user name
   */
  private getGitUser(): string {
    try {
      return execFileSync('git', ['config', 'user.name'], { encoding: 'utf8' }).trim();
    } catch {
      return 'unknown';
    }
  }

  /**
   * Get git repository root path
   */
  private getRepoRoot(): string {
    try {
      return execFileSync('git', ['rev-parse', '--show-toplevel'], { encoding: 'utf8' }).trim();
    } catch {
      return process.cwd();
    }
  }

  /**
   * Generate a stable numeric ID for CLI contexts
   * Uses hash of repo path + target identifier to avoid collisions with incremental cache
   */
  private generateContextId(identifier: string): number {
    const repoRoot = this.getRepoRoot();
    const input = `${repoRoot}:${identifier}`;
    const hash = createHash('sha256').update(input).digest('hex');
    // Convert first 8 hex chars to positive integer (0 to 4294967295)
    return parseInt(hash.substring(0, 8), 16);
  }

  /**
   * Check if we're in a git repository
   */
  isGitRepo(): boolean {
    try {
      execFileSync('git', ['rev-parse', '--git-dir'], { encoding: 'utf8' });
      return true;
    } catch {
      return false;
    }
  }
}
