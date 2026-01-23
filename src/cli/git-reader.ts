import { execSync } from 'child_process';
import { PRContext, FileChange } from '../types';
import { logger } from '../utils/logger';

/**
 * Reads git diffs from local repository for CLI mode
 */
export class GitReader {
  /**
   * Get current branch name
   */
  getCurrentBranch(): string {
    try {
      return execSync('git rev-parse --abbrev-ref HEAD', { encoding: 'utf8' }).trim();
    } catch (error) {
      throw new Error(`Failed to get current branch: ${error}`);
    }
  }

  /**
   * Get current commit SHA
   */
  getCurrentCommit(): string {
    try {
      return execSync('git rev-parse HEAD', { encoding: 'utf8' }).trim();
    } catch (error) {
      throw new Error(`Failed to get current commit: ${error}`);
    }
  }

  /**
   * Get base commit for comparison
   */
  getBaseCommit(target?: string): string {
    try {
      if (target) {
        // If target specified (e.g., HEAD~1, main), resolve it
        return execSync(`git rev-parse ${target}`, { encoding: 'utf8' }).trim();
      }

      // Default: compare against main/master branch
      const defaultBranch = this.getDefaultBranch();
      return execSync(`git rev-parse ${defaultBranch}`, { encoding: 'utf8' }).trim();
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
      const result = execSync('git symbolic-ref refs/remotes/origin/HEAD', { encoding: 'utf8' }).trim();
      return result.replace('refs/remotes/origin/', '');
    } catch {
      // Fallback: check if main exists, otherwise use master
      try {
        execSync('git rev-parse --verify main', { encoding: 'utf8' });
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

    // Get diff for uncommitted changes
    const diff = execSync('git diff HEAD', { encoding: 'utf8' });
    const files = this.parseDiff(diff);

    const currentBranch = this.getCurrentBranch();
    const currentCommit = this.getCurrentCommit();

    return {
      number: 0, // CLI mode has no PR number
      title: `Local changes on ${currentBranch}`,
      body: 'Uncommitted changes',
      author: this.getGitUser(),
      draft: false,
      labels: [],
      files,
      diff,
      additions: files.reduce((sum, f) => sum + f.additions, 0),
      deletions: files.reduce((sum, f) => sum + f.deletions, 0),
      baseSha: currentCommit,
      headSha: 'working-directory',
    };
  }

  /**
   * Get changes for a specific commit
   */
  async getCommitChanges(commitRef: string): Promise<PRContext> {
    logger.info(`Reading changes for commit ${commitRef}`);

    const commitSha = execSync(`git rev-parse ${commitRef}`, { encoding: 'utf8' }).trim();
    const parentSha = execSync(`git rev-parse ${commitRef}^`, { encoding: 'utf8' }).trim();

    // Get diff for this commit
    const diff = execSync(`git diff ${parentSha} ${commitSha}`, { encoding: 'utf8' });
    const files = this.parseDiff(diff);

    // Get commit message
    const message = execSync(`git log -1 --pretty=%B ${commitSha}`, { encoding: 'utf8' }).trim();

    return {
      number: 0,
      title: `Commit ${commitSha.substring(0, 7)}`,
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
    const headSha = head ? execSync(`git rev-parse ${head}`, { encoding: 'utf8' }).trim() : this.getCurrentCommit();

    logger.info(`Reading changes from ${baseSha.substring(0, 7)} to ${headSha.substring(0, 7)}`);

    // Get diff between commits
    const diff = execSync(`git diff ${baseSha} ${headSha}`, { encoding: 'utf8' });
    const files = this.parseDiff(diff);

    return {
      number: 0,
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
   * Parse git diff output into FileChange objects
   */
  private parseDiff(diff: string): FileChange[] {
    const files: FileChange[] = [];
    const fileRegex = /^diff --git a\/(.*?) b\/(.*?)$/gm;
    const statsRegex = /^@@ -(\d+)(?:,(\d+))? \+(\d+)(?:,(\d+))? @@/;

    const patches = diff.split(/^diff --git /m).filter(Boolean);

    for (const patch of patches) {
      const lines = patch.split('\n');
      const firstLine = `diff --git ${lines[0]}`;
      const match = fileRegex.exec(firstLine);

      if (!match) continue;

      const filename = match[2];
      let status: FileChange['status'] = 'modified';
      let additions = 0;
      let deletions = 0;

      // Detect file status
      if (patch.includes('new file mode')) {
        status = 'added';
      } else if (patch.includes('deleted file mode')) {
        status = 'removed';
      } else if (patch.includes('rename from')) {
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
      return execSync('git config user.name', { encoding: 'utf8' }).trim();
    } catch {
      return 'unknown';
    }
  }

  /**
   * Check if we're in a git repository
   */
  isGitRepo(): boolean {
    try {
      execSync('git rev-parse --git-dir', { encoding: 'utf8' });
      return true;
    } catch {
      return false;
    }
  }
}
