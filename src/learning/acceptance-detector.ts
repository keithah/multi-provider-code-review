import { ProviderWeightTracker } from './provider-weights';

/**
 * Represents a detected suggestion acceptance event.
 *
 * Acceptances can come from:
 * - Committed suggestions (via GitHub's "Commit suggestion" button)
 * - Thumbs-up reactions on suggestion comments
 */
export interface SuggestionAcceptance {
  /** File path where suggestion was accepted */
  file: string;
  /** Line number of the accepted suggestion */
  line: number;
  /** Provider that generated the suggestion */
  provider: string;
  /** Commit SHA if detected from commit */
  commitSha?: string;
  /** Comment ID if detected from reaction */
  commentId?: number;
  /** Timestamp of acceptance event */
  timestamp: number;
}

/**
 * Information about a PR commit.
 */
export interface CommitInfo {
  /** Commit SHA */
  sha: string;
  /** Commit message */
  message: string;
  /** Files changed in commit */
  files: string[];
  /** Commit timestamp (epoch milliseconds) */
  timestamp: number;
}

/**
 * Comment with associated reactions.
 */
export interface CommentReaction {
  /** GitHub comment ID */
  commentId: number;
  /** File path of comment */
  file: string;
  /** Line number of comment */
  line: number;
  /** Provider attribution if available */
  provider?: string;
  /** List of reactions on comment */
  reactions: Array<{ user: string; content: string }>;
}

/**
 * Detects suggestion acceptances from PR activity.
 *
 * Tracks two types of acceptances:
 * 1. Committed suggestions: Detected via GitHub's commit message patterns
 * 2. Reaction-based acceptances: Detected via thumbs-up reactions
 *
 * Acceptances are reported as positive feedback to the ProviderWeightTracker
 * to improve provider weights in confidence calculations.
 */
export class AcceptanceDetector {
  /**
   * Patterns matching GitHub's "Commit suggestion" feature.
   *
   * GitHub creates commits with these patterns when users click
   * "Commit suggestion" on review comments.
   */
  private readonly SUGGESTION_COMMIT_PATTERNS = [
    /Apply suggestions? from code review/i,
    /Apply suggestions? from @[\w-]+/i,
    /Apply \d+ suggestions?/i,
  ];

  /**
   * Detect acceptances from PR commits.
   *
   * GitHub's "Commit suggestion" feature creates commits with specific
   * message patterns. This method matches those patterns against PR commits
   * to detect when suggestions were accepted.
   *
   * @param commits - List of commits in the PR
   * @param commentedFiles - Map of file paths to comment metadata
   * @returns List of detected acceptances
   */
  detectFromCommits(
    commits: CommitInfo[],
    commentedFiles: Map<string, Array<{ line: number; provider?: string }>>
  ): SuggestionAcceptance[] {
    const acceptances: SuggestionAcceptance[] = [];

    for (const commit of commits) {
      if (!this.isSuggestionCommit(commit.message)) {
        continue;
      }

      // Match commit files against commented files
      for (const file of commit.files) {
        const comments = commentedFiles.get(file);
        if (!comments) continue;

        for (const comment of comments) {
          acceptances.push({
            file,
            line: comment.line,
            provider: comment.provider || 'unknown',
            commitSha: commit.sha,
            timestamp: commit.timestamp,
          });
        }
      }
    }

    return acceptances;
  }

  /**
   * Detect acceptances from thumbs-up reactions on suggestion comments.
   *
   * When users react with thumbs-up (👍) to a suggestion comment,
   * it's considered an acceptance event.
   *
   * @param commentReactions - List of comments with their reactions
   * @returns List of detected acceptances
   */
  detectFromReactions(commentReactions: CommentReaction[]): SuggestionAcceptance[] {
    const acceptances: SuggestionAcceptance[] = [];

    for (const comment of commentReactions) {
      const hasThumbsUp = comment.reactions.some(r => r.content === '+1');
      if (!hasThumbsUp) continue;

      acceptances.push({
        file: comment.file,
        line: comment.line,
        provider: comment.provider || 'unknown',
        commentId: comment.commentId,
        timestamp: Date.now(),
      });
    }

    return acceptances;
  }

  /**
   * Record acceptances as positive feedback to weight tracker.
   *
   * Each acceptance triggers a positive feedback event (👍) for the
   * associated provider, improving their weight in future confidence
   * calculations.
   *
   * @param acceptances - List of detected acceptances
   * @param weightTracker - Provider weight tracker instance
   */
  async recordAcceptances(
    acceptances: SuggestionAcceptance[],
    weightTracker: ProviderWeightTracker
  ): Promise<void> {
    for (const acceptance of acceptances) {
      if (acceptance.provider && acceptance.provider !== 'unknown') {
        await weightTracker.recordFeedback(acceptance.provider, '👍');
      }
    }
  }

  /**
   * Check if a commit message matches GitHub's suggestion commit patterns.
   *
   * @param message - Commit message to check
   * @returns True if message matches a suggestion pattern
   */
  private isSuggestionCommit(message: string): boolean {
    return this.SUGGESTION_COMMIT_PATTERNS.some(pattern => pattern.test(message));
  }
}
