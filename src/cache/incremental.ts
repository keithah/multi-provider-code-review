import { PRContext, Finding, Review, FileChange } from '../types';
import { CacheStorage } from './storage';
import { logger } from '../utils/logger';
import { execSync } from 'child_process';

interface IncrementalCacheData {
  prNumber: number;
  lastReviewedCommit: string;
  timestamp: number;
  findings: Finding[];
  reviewSummary: string;
}

export interface IncrementalConfig {
  enabled: boolean;
  cacheTtlDays: number;
}

export class IncrementalReviewer {
  private static readonly CACHE_KEY_PREFIX = 'incremental-review-pr-';
  private static readonly DEFAULT_TTL_DAYS = 7;

  constructor(
    private readonly storage = new CacheStorage(),
    private readonly config: IncrementalConfig = { enabled: true, cacheTtlDays: 7 }
  ) {}

  /**
   * Check if incremental review should be used for this PR
   */
  async shouldUseIncremental(pr: PRContext): Promise<boolean> {
    if (!this.config.enabled) {
      logger.debug('Incremental review disabled by configuration');
      return false;
    }

    const lastReview = await this.getLastReview(pr.number);
    if (!lastReview) {
      logger.debug('No previous review found, running full review');
      return false;
    }

    // Check if cache is expired
    const ageMs = Date.now() - lastReview.timestamp;
    const ttlMs = this.config.cacheTtlDays * 24 * 60 * 60 * 1000;
    if (ageMs > ttlMs) {
      logger.debug(`Cache expired (age: ${Math.round(ageMs / 1000 / 60)} minutes, TTL: ${this.config.cacheTtlDays} days)`);
      return false;
    }

    // Check if the commit is still reachable
    if (lastReview.lastReviewedCommit === pr.headSha) {
      logger.debug('PR head SHA unchanged since last review');
      return false; // No changes, skip review entirely
    }

    logger.info(`Incremental review available from ${lastReview.lastReviewedCommit.substring(0, 7)} to ${pr.headSha.substring(0, 7)}`);
    return true;
  }

  /**
   * Get the last review data for a PR
   */
  async getLastReview(prNumber: number): Promise<IncrementalCacheData | null> {
    const key = this.buildCacheKey(prNumber);
    const raw = await this.storage.read(key);
    if (!raw) return null;

    try {
      const data = JSON.parse(raw) as IncrementalCacheData;
      return data;
    } catch (error) {
      logger.warn('Failed to parse incremental cache', error as Error);
      return null;
    }
  }

  /**
   * Save review data for incremental updates
   */
  async saveReview(pr: PRContext, review: Review): Promise<void> {
    const key = this.buildCacheKey(pr.number);
    const data: IncrementalCacheData = {
      prNumber: pr.number,
      lastReviewedCommit: pr.headSha,
      timestamp: Date.now(),
      findings: review.findings,
      reviewSummary: review.summary,
    };

    await this.storage.write(key, JSON.stringify(data));
    logger.info(`Saved incremental review data for PR #${pr.number} at commit ${pr.headSha.substring(0, 7)}`);
  }

  /**
   * Get list of files changed since the last review
   */
  async getChangedFilesSince(pr: PRContext, lastCommit: string): Promise<FileChange[]> {
    try {
      // Get the diff between last reviewed commit and current HEAD
      const diffCommand = `git diff --name-status ${lastCommit}...${pr.headSha}`;
      logger.debug(`Running: ${diffCommand}`);

      const output = execSync(diffCommand, {
        encoding: 'utf8',
        cwd: process.cwd(),
        stdio: ['pipe', 'pipe', 'pipe'],
      });

      const changedFiles: FileChange[] = [];
      const lines = output.trim().split('\n').filter(Boolean);

      for (const line of lines) {
        const [status, ...pathParts] = line.split('\t');
        const filename = pathParts.join('\t'); // Handle filenames with tabs

        // Find this file in the PR files list to get full details
        const prFile = pr.files.find(f => f.filename === filename);
        if (prFile) {
          changedFiles.push(prFile);
        } else {
          // File not in PR files (possibly deleted or outside PR scope)
          logger.debug(`File ${filename} in diff but not in PR files`);
        }
      }

      logger.info(`Found ${changedFiles.length} changed files since ${lastCommit.substring(0, 7)}`);
      return changedFiles;
    } catch (error) {
      logger.error('Failed to get changed files from git diff', error as Error);
      // On error, return all PR files (fallback to full review)
      return pr.files;
    }
  }

  /**
   * Merge findings from previous review with new findings
   *
   * Strategy:
   * 1. Keep findings from unchanged files
   * 2. Remove findings from changed files (they'll be replaced by new review)
   * 3. Add new findings from current review
   */
  mergeFindings(
    previousFindings: Finding[],
    newFindings: Finding[],
    changedFiles: FileChange[]
  ): Finding[] {
    const changedFilenames = new Set(changedFiles.map(f => f.filename));

    // Keep findings from unchanged files
    const keptFindings = previousFindings.filter(f => !changedFilenames.has(f.file));

    // Add new findings
    const merged = [...keptFindings, ...newFindings];

    logger.info(
      `Merged findings: ${keptFindings.length} kept from unchanged files, ` +
      `${newFindings.length} new from review, total ${merged.length}`
    );

    return merged;
  }

  /**
   * Generate incremental review summary
   */
  generateIncrementalSummary(
    previousSummary: string,
    newSummary: string,
    changedFiles: FileChange[],
    lastCommit: string,
    currentCommit: string
  ): string {
    const incrementalNote = `
## 🔄 Incremental Review

This is an incremental review covering changes from \`${lastCommit.substring(0, 7)}\` to \`${currentCommit.substring(0, 7)}\`.

**Files reviewed in this update:** ${changedFiles.length}
${changedFiles.map(f => `- ${f.filename}`).join('\n')}

---

${newSummary}

<details>
<summary>Previous Review Summary</summary>

${previousSummary}

</details>
`;

    return incrementalNote;
  }

  private buildCacheKey(prNumber: number): string {
    return `${IncrementalReviewer.CACHE_KEY_PREFIX}${prNumber}`;
  }
}
