import { ProviderWeightTracker } from './provider-weights';

export interface SuggestionAcceptance {
  file: string;
  line: number;
  provider: string;
  commitSha?: string;       // If detected from commit
  commentId?: number;       // If detected from reaction
  timestamp: number;
}

export interface CommitInfo {
  sha: string;
  message: string;
  files: string[];          // Files changed in commit
  timestamp: number;
}

export interface CommentReaction {
  commentId: number;
  file: string;
  line: number;
  provider?: string;        // Provider attribution if available
  reactions: Array<{ user: string; content: string }>;
}

export class AcceptanceDetector {
  private readonly SUGGESTION_COMMIT_PATTERNS = [
    /Apply suggestions? from code review/i,
    /Apply suggestions? from @[\w-]+/i,
    /Apply \d+ suggestions?/i,
  ];

  /**
   * Detect acceptances from PR commits.
   * GitHub's "Commit suggestion" creates commits with specific patterns.
   */
  detectFromCommits(
    commits: CommitInfo[],
    commentedFiles: Map<string, Array<{ line: number; provider?: string }>>
  ): SuggestionAcceptance[] {
    const acceptances: SuggestionAcceptance[] = [];

    for (const commit of commits) {
      const isSuggestionCommit = this.SUGGESTION_COMMIT_PATTERNS.some(p => p.test(commit.message));
      if (!isSuggestionCommit) continue;

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
}
