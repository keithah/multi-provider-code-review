import { InlineComment, FileChange, Severity, ReviewConfig } from '../types';
import { GitHubClient } from './client';
import { logger } from '../utils/logger';
import { mapLinesToPositions } from '../utils/diff';
import { withRetry } from '../utils/retry';
import { extractCodeSnippet, createEnhancedCommentBody } from '../utils/code-snippet';
import { isSuggestionLineValid, validateSuggestionRange, isDeletionOnlyFile } from '../utils/suggestion-validator';
import { validateSyntax, shouldPostSuggestion, calculateConfidence, ConfidenceSignals } from '../validation';
import { SuppressionTracker } from '../learning/suppression-tracker';
import { ProviderWeightTracker } from '../learning/provider-weights';
import { detectLanguage } from '../analysis/ast/parsers';

export class CommentPoster {
  private static readonly MAX_COMMENT_SIZE = 60_000;
  private static readonly BOT_COMMENT_MARKER = '<!-- multi-provider-code-review-bot -->';

  constructor(
    private readonly client: GitHubClient,
    private readonly dryRun: boolean = false,
    private readonly config?: Partial<ReviewConfig>,
    private readonly suppressionTracker?: SuppressionTracker,
    private readonly providerWeightTracker?: ProviderWeightTracker
  ) {}

  async postSummary(prNumber: number, body: string, updateExisting = true): Promise<void> {
    const chunks = this.chunk(body);

    if (this.dryRun) {
      logger.info(`[DRY RUN] Would post ${chunks.length} summary comment(s) to PR #${prNumber}`);
      for (let i = 0; i < chunks.length; i++) {
        const header = chunks.length > 1 ? `## Review Summary (Part ${i + 1}/${chunks.length})\n\n` : '';
        const content = header + chunks[i];
        logger.info(`[DRY RUN] Summary comment ${i + 1}:\n${content.substring(0, 500)}...`);
      }
      return;
    }

    const { octokit, owner, repo } = this.client;

    // Try to find and update existing comments if incremental review
    if (updateExisting) {
      const existingComments = await this.findBotComments(prNumber);
      if (existingComments.length > 0) {
        logger.info(`Found ${existingComments.length} existing review comment(s), updating in place`);
        const updates = Math.min(existingComments.length, chunks.length);

        // Update comments that already exist
        for (let i = 0; i < updates; i++) {
          const header = chunks.length > 1 ? `## Review Summary (Part ${i + 1}/${chunks.length})\n\n` : '';
          const markedBody = CommentPoster.BOT_COMMENT_MARKER + '\n\n' + header + chunks[i];
          await withRetry(
            () => octokit.rest.issues.updateComment({
              owner,
              repo,
              comment_id: existingComments[i].id,
              body: markedBody,
            }),
            { retries: 2, minTimeout: 1000, maxTimeout: 5000 }
          );
        }

        // Delete extra stale comments if we reduced chunk count
        if (existingComments.length > chunks.length) {
          const stale = existingComments.slice(chunks.length);
          for (const comment of stale) {
            await withRetry(
              () => octokit.rest.issues.deleteComment({ owner, repo, comment_id: comment.id }),
              { retries: 2, minTimeout: 1000, maxTimeout: 5000 }
            );
          }
        }

        // Add new comments if chunk count grew
        for (let i = existingComments.length; i < chunks.length; i++) {
          const header = chunks.length > 1 ? `## Review Summary (Part ${i + 1}/${chunks.length})\n\n` : '';
          const markedBody = CommentPoster.BOT_COMMENT_MARKER + '\n\n' + header + chunks[i];
          await withRetry(
            () => octokit.rest.issues.createComment({ owner, repo, issue_number: prNumber, body: markedBody }),
            { retries: 2, minTimeout: 1000, maxTimeout: 5000 }
          );
          await new Promise(resolve => setTimeout(resolve, 1000));
        }

        return;
      }
    }

    // Create new comment(s)
    for (let i = 0; i < chunks.length; i++) {
      const header = chunks.length > 1 ? `## Review Summary (Part ${i + 1}/${chunks.length})\n\n` : '';
      const markedBody = CommentPoster.BOT_COMMENT_MARKER + '\n\n' + header + chunks[i];
      await withRetry(
        () => octokit.rest.issues.createComment({ owner, repo, issue_number: prNumber, body: markedBody }),
        { retries: 2, minTimeout: 1000, maxTimeout: 5000 }
      );
      if (i < chunks.length - 1) {
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }
  }

  /**
   * Find the bot's review comment on a PR
   */
  private async findBotComment(prNumber: number): Promise<{ id: number; body: string } | null> {
    const comments = await this.findBotComments(prNumber);
    return comments[0] || null;
  }

  private async findBotComments(prNumber: number): Promise<Array<{ id: number; body: string }>> {
    const { octokit, owner, repo } = this.client;

    try {
      const comments = await withRetry(
        () => octokit.rest.issues.listComments({ owner, repo, issue_number: prNumber, per_page: 100 }),
        { retries: 2, minTimeout: 1000, maxTimeout: 5000 }
      );

      // Find comment with our marker
      return comments.data
        .filter(comment => comment.body?.includes(CommentPoster.BOT_COMMENT_MARKER))
        .map(comment => ({ id: comment.id, body: comment.body ?? '' }));
    } catch (error) {
      logger.warn('Failed to find existing bot comment', error as Error);
      return [];
    }
  }

  /**
   * Validate and filter suggestions through quality pipeline.
   * Reads pre-computed hasConsensus from Finding (set during aggregation).
   */
  private async validateAndFilterSuggestion(
    comment: InlineComment & {
      suggestion?: string;
      category?: string;
      severity?: Severity;
      provider?: string;
      hasConsensus?: boolean;  // Pre-computed during aggregation
      confidence?: number;
    },
    prNumber: number
  ): Promise<{ valid: boolean; reason?: string; hasConsensus?: boolean }> {
    if (!comment.suggestion) {
      return { valid: true }; // No suggestion to validate
    }

    // Check suppression first (fast path)
    if (this.suppressionTracker) {
      const suppressed = await this.suppressionTracker.shouldSuppress(
        { category: comment.category || 'unknown', file: comment.path, line: comment.line },
        prNumber
      );
      if (suppressed) {
        logger.debug(`Suggestion suppressed for ${comment.path}:${comment.line} (similar suggestion dismissed)`);
        return { valid: false, reason: 'Similar suggestion was dismissed' };
      }
    }

    // Syntax validation (if enabled)
    let syntaxValid = true;
    if (this.config?.suggestionSyntaxValidation !== false) {
      const language = detectLanguage(comment.path);
      if (language !== 'unknown') {
        const syntaxResult = validateSyntax(comment.suggestion, language);
        if (!syntaxResult.isValid && !syntaxResult.skipped) {
          logger.debug(`Suggestion syntax invalid for ${comment.path}:${comment.line}: ${syntaxResult.errors.length} error(s)`);
          syntaxValid = false;
          // Don't return early - check consensus which might override
        }
      }
    }

    // Read consensus from Finding (set during aggregation, NOT computed here)
    // Consensus checking requires per-provider suggestions which aren't available at comment-posting time
    const hasConsensus = comment.hasConsensus ?? false;
    if (hasConsensus) {
      logger.debug(`Consensus detected for ${comment.path}:${comment.line} (providers agreed during aggregation)`);
    }

    // If syntax invalid and no consensus to override, reject
    if (!syntaxValid && !hasConsensus) {
      return { valid: false, reason: 'Syntax validation failed', hasConsensus: false };
    }

    // Confidence threshold check
    if (comment.severity && this.config) {
      // Get provider weight for reliability signal
      let providerReliability = 1.0;
      if (this.providerWeightTracker && comment.provider) {
        providerReliability = await this.providerWeightTracker.getWeight(comment.provider);
      }

      const signals: ConfidenceSignals = {
        llmConfidence: comment.confidence,
        syntaxValid,
        hasConsensus,
        providerReliability
      };
      const confidence = calculateConfidence(signals);

      // Create minimal Finding object for shouldPostSuggestion
      const minimalFinding = {
        file: comment.path,
        line: comment.line,
        severity: comment.severity,
        title: '',
        message: '',
        providers: comment.provider ? [comment.provider] : [],
        hasConsensus
      };

      if (!shouldPostSuggestion(
        minimalFinding,
        confidence,
        {
          min_confidence: this.config.minConfidence,
          confidence_threshold: this.config.confidenceThreshold,
          consensus: {
            required_for_critical: this.config.consensusRequiredForCritical ?? true,
            min_agreement: this.config.consensusMinAgreement ?? 2
          }
        }
      )) {
        logger.debug(`Suggestion below confidence threshold for ${comment.path}:${comment.line} (confidence: ${confidence.toFixed(2)})`);
        return { valid: false, reason: 'Below confidence threshold', hasConsensus };
      }
    }

    return { valid: true, hasConsensus };
  }

  async postInline(prNumber: number, comments: InlineComment[], files: FileChange[], headSha?: string): Promise<void> {
    if (comments.length === 0) return;

    // Filter out deletion-only files (no suggestions possible)
    const filesWithAdditions = files.filter(f => !isDeletionOnlyFile(f));
    const filesWithAdditionsSet = new Set(filesWithAdditions.map(f => f.filename));

    // Build a map from file path to line->position mapping
    const positionMaps = new Map<string, Map<number, number>>();
    for (const file of files) {
      positionMaps.set(file.filename, mapLinesToPositions(file.patch));
    }

    // Sort comments for optimal batch commit UX (top-to-bottom per file)
    const sortedComments = [...comments].sort((a, b) => {
      const pathCompare = a.path.localeCompare(b.path);
      if (pathCompare !== 0) return pathCompare;
      return a.line - b.line;
    });

    // Fetch file contents and enhance comments with code snippets (if headSha provided)
    const fileContentCache = new Map<string, string | null>();

    const enhancedComments = await Promise.all(
      sortedComments.map(async (c) => {
        let enhancedBody = c.body;

        // Try to add code snippet if we have the commit SHA
        if (headSha) {
          // Check cache first
          let fileContent = fileContentCache.get(c.path);

          if (fileContent === undefined) {
            // Not in cache, fetch it
            fileContent = await this.client.getFileContent(c.path, headSha);
            fileContentCache.set(c.path, fileContent);
          }

          if (fileContent) {
            const snippet = extractCodeSnippet(fileContent, c.line, 3);
            if (snippet) {
              enhancedBody = createEnhancedCommentBody(c.body, snippet, c.path);
            }
          }
        }

        return { ...c, body: enhancedBody };
      })
    );

    // Convert comments to GitHub API format, filtering out those without valid positions
    const apiComments = (await Promise.all(enhancedComments
      .map(async c => {
        const posMap = positionMaps.get(c.path);
        const position = posMap?.get(c.line);
        if (!position) {
          logger.warn(`Cannot find diff position for ${c.path}:${c.line}, skipping inline comment`);
          return null;
        }

        // Validate suggestions can be applied at this line/range
        if (c.body.includes('```suggestion')) {
          const file = files.find(f => f.filename === c.path);

          // Skip suggestions for deletion-only files
          if (!filesWithAdditionsSet.has(c.path)) {
            logger.debug(`Skipping suggestion for deletion-only file: ${c.path}`);
            c.body = c.body.replace(/```suggestion[\s\S]*?```/g, '_Suggestion not available (file has no additions)_');
          } else if (file?.patch) {
            // Check if this is a multi-line suggestion (has start_line)
            const startLine = (c as any).start_line;
            if (startLine !== undefined && startLine !== c.line) {
              // Multi-line suggestion - validate range
              const validation = validateSuggestionRange(startLine, c.line, file.patch);
              if (!validation.isValid) {
                logger.debug(`Multi-line suggestion invalid at ${c.path}:${startLine}-${c.line}: ${validation.reason}`);
                c.body = c.body.replace(/```suggestion[\s\S]*?```/g, `_Suggestion not available: ${validation.reason}_`);
              }
            } else {
              // Single-line suggestion - use existing validation
              if (!isSuggestionLineValid(c.line, file.patch)) {
                logger.debug(`Suggestion line ${c.path}:${c.line} not valid in diff, posting without suggestion block`);
                c.body = c.body.replace(/```suggestion[\s\S]*?```/g, '_Suggestion not available for this line_');
              }
            }
          }

          // Quality gate validation (syntax, suppression, confidence)
          // Extract suggestion content for validation
          const suggestionMatch = c.body.match(/```suggestion\n([\s\S]*?)```/);
          if (suggestionMatch && !c.body.includes('_Suggestion not available')) {
            const suggestionContent = suggestionMatch[1];
            const qualityValidation = await this.validateAndFilterSuggestion(
              {
                ...c,
                suggestion: suggestionContent,
                category: (c as any).category,
                severity: (c as any).severity,
                provider: (c as any).provider,
                hasConsensus: (c as any).hasConsensus,
                confidence: (c as any).confidence
              },
              prNumber
            );
            if (!qualityValidation.valid) {
              c.body = c.body.replace(/```suggestion[\s\S]*?```/g, `_Suggestion not available: ${qualityValidation.reason}_`);
            }
          }
        }

        const apiComment: any = { path: c.path, position, body: c.body };
        const startLine = (c as any).start_line;
        if (startLine !== undefined && startLine !== c.line) {
          // Multi-line: use line-based parameters instead of position
          apiComment.start_line = startLine;
          apiComment.line = c.line;
          apiComment.start_side = 'RIGHT';
          apiComment.side = 'RIGHT';
          delete apiComment.position; // Can't use both position and line
        }
        return apiComment;
      })
    )).filter((c): c is { path: string; position: number; body: string } => c !== null);

    if (apiComments.length === 0) {
      logger.info('No inline comments with valid diff positions to post');
      return;
    }

    if (this.dryRun) {
      logger.info(`[DRY RUN] Would post ${apiComments.length} inline comment(s) to PR #${prNumber}`);
      for (const comment of apiComments) {
        logger.info(`[DRY RUN] Inline comment at ${comment.path}:${comment.position}:\n${comment.body.substring(0, 200)}...`);
      }
      return;
    }

    const { octokit, owner, repo } = this.client;
    await withRetry(
      () => octokit.rest.pulls.createReview({
        owner,
        repo,
        pull_number: prNumber,
        event: 'COMMENT',
        comments: apiComments,
      }),
      { retries: 2, minTimeout: 1000, maxTimeout: 5000 }
    );
  }

  private chunk(content: string): string[] {
    const paragraphs = content.split('\n\n');
    const chunks: string[] = [];
    let current = '';

    for (const para of paragraphs) {
      if (Buffer.byteLength(current + para, 'utf8') > CommentPoster.MAX_COMMENT_SIZE) {
        if (current) {
          chunks.push(current.trim());
          current = '';
        }
        if (Buffer.byteLength(para, 'utf8') > CommentPoster.MAX_COMMENT_SIZE) {
          const lines = para.split('\n');
          let lineChunk = '';
          for (const line of lines) {
            if (Buffer.byteLength(lineChunk + line + '\n', 'utf8') > CommentPoster.MAX_COMMENT_SIZE) {
              chunks.push(lineChunk.trim());
              lineChunk = '';
            }
            lineChunk += line + '\n';
          }
          current = lineChunk + '\n\n';
        } else {
          current = para + '\n\n';
        }
      } else {
        current += para + '\n\n';
      }
    }

    if (current.trim()) chunks.push(current.trim());
    logger.info(`Prepared ${chunks.length} comment chunk(s)`);
    return chunks;
  }
}
