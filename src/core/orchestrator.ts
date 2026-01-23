import { Deduplicator } from '../analysis/deduplicator';
import { ConsensusEngine } from '../analysis/consensus';
import { LLMExecutor } from '../analysis/llm/executor';
import { extractFindings } from '../analysis/llm/parser';
import { summarizeAIDetection } from '../analysis/ai-detector';
import { PromptBuilder } from '../analysis/llm/prompt-builder';
import { ASTAnalyzer } from '../analysis/ast/analyzer';
import { TestCoverageAnalyzer } from '../analysis/test-coverage';
import { SynthesisEngine } from '../analysis/synthesis';
import { ProviderRegistry } from '../providers/registry';
import { PullRequestLoader } from '../github/pr-loader';
import { CommentPoster } from '../github/comment-poster';
import { MarkdownFormatter } from '../output/formatter';
import { MermaidGenerator } from '../output/mermaid';
import { FeedbackFilter } from '../github/feedback';
import { buildJson } from '../output/json';
import { buildSarif } from '../output/sarif';
import { CacheManager } from '../cache/manager';
import { IncrementalReviewer } from '../cache/incremental';
import { CostTracker } from '../cost/tracker';
import { SecurityScanner } from '../security/scanner';
import { RulesEngine } from '../rules/engine';
import { ContextRetriever } from '../analysis/context';
import { EvidenceScorer } from '../analysis/evidence';
import { ImpactAnalyzer } from '../analysis/impact';
import { ReviewConfig, Review, PRContext, RunDetails, Finding, FileChange, UnchangedContext, ProviderResult } from '../types';
import { logger } from '../utils/logger';
import { mapAddedLines } from '../utils/diff';
import * as fs from 'fs/promises';
import path from 'path';

export interface ReviewComponents {
  config: ReviewConfig;
  providerRegistry: ProviderRegistry;
  promptBuilder: PromptBuilder;
  llmExecutor: LLMExecutor;
  deduplicator: Deduplicator;
  consensus: ConsensusEngine;
  synthesis: SynthesisEngine;
  testCoverage: TestCoverageAnalyzer;
  astAnalyzer: ASTAnalyzer;
  cache: CacheManager;
  incrementalReviewer: IncrementalReviewer;
  costTracker: CostTracker;
  security: SecurityScanner;
  rules: RulesEngine;
  prLoader: PullRequestLoader;
  commentPoster: CommentPoster;
  formatter: MarkdownFormatter;
  contextRetriever: ContextRetriever;
  impactAnalyzer: ImpactAnalyzer;
  evidenceScorer: EvidenceScorer;
  mermaidGenerator: MermaidGenerator;
  feedbackFilter: FeedbackFilter;
}

export class ReviewOrchestrator {
  constructor(private readonly components: ReviewComponents) {}

  async execute(prNumber: number): Promise<Review | null> {
    const { config } = this.components;
    const start = Date.now();

    const pr = await this.components.prLoader.load(prNumber);
    const skipReason = this.shouldSkip(pr);
    if (skipReason) {
      logger.info(`Skipping review: ${skipReason}`);
      return null;
    }

    // Check for incremental review
    const useIncremental = await this.components.incrementalReviewer.shouldUseIncremental(pr);
    let filesToReview: FileChange[] = pr.files;
    let lastReviewData = null;

    if (useIncremental) {
      lastReviewData = await this.components.incrementalReviewer.getLastReview(pr.number);
      if (lastReviewData) {
        filesToReview = await this.components.incrementalReviewer.getChangedFilesSince(pr, lastReviewData.lastReviewedCommit);
        logger.info(`Incremental review: reviewing ${filesToReview.length} changed files`);
      }
    }

    const cachedFindings = config.enableCaching ? await this.components.cache.load(pr) : null;

    // Skip LLM execution if no files to review (incremental with no changes)
    let llmFindings: Finding[] = [];
    let providerResults: ProviderResult[] = [];
    let aiAnalysis: ReturnType<typeof summarizeAIDetection> | undefined;
    const providers = await this.components.providerRegistry.createProviders(config);

    if (filesToReview.length === 0) {
      logger.info('No files to review in incremental update, using cached findings only');
    } else {

      // Create a PR context for the files to review with filtered diff
      const reviewPR: PRContext = useIncremental
        ? { ...pr, files: filesToReview, diff: this.filterDiffByFiles(pr.diff, filesToReview) }
        : pr;
      const prompt = this.components.promptBuilder.build(reviewPR);

      await this.ensureBudget(config);

      providerResults = await this.components.llmExecutor.execute(providers, prompt);
      llmFindings = extractFindings(providerResults);
      aiAnalysis = config.enableAiDetection ? summarizeAIDetection(providerResults) : undefined;

      for (const result of providerResults) {
        await this.components.costTracker.record(result.name, result.result?.usage);
      }
    }

    const astFindings = config.enableAstAnalysis ? this.components.astAnalyzer.analyze(filesToReview) : [];
    const ruleFindings = this.components.rules.run(filesToReview);
    const securityFindings = config.enableSecurity ? this.components.security.scan(filesToReview) : [];
    const context = this.components.contextRetriever.findRelatedContext(filesToReview);

    const combinedFindings = [
      ...astFindings,
      ...ruleFindings,
      ...securityFindings,
      ...llmFindings,
      ...(cachedFindings || []),
    ];

    const deduped = this.components.deduplicator.dedupe(combinedFindings);
    const consensus = this.components.consensus.filter(deduped);
    const providerCount = providers.length || 1;
    const enriched = consensus.map(f =>
      this.enrichFinding(f, pr.files, context, providerCount)
    );
    const quietFiltered = this.applyQuietMode(enriched, config);

    const testHints = config.enableTestHints ? this.components.testCoverage.analyze(pr.files) : undefined;
    const impactAnalysis = this.components.impactAnalyzer.analyze(pr.files, context, quietFiltered.length > 0);
    const mermaidDiagram = this.components.mermaidGenerator.generateImpactDiagram(pr.files, context);
    const costSummary = this.components.costTracker.summary();
    const runDetails: RunDetails = {
      providers: providerResults.map(r => ({
        name: r.name,
        status: r.status,
        durationSeconds: r.durationSeconds,
        tokens: r.result?.usage?.totalTokens,
        cost: costSummary.breakdown[r.name],
        errorMessage: r.error?.message,
      })),
      totalCost: costSummary.totalCost,
      totalTokens: costSummary.totalTokens,
      durationSeconds: 0,
      cacheHit: Boolean(cachedFindings),
      synthesisModel: config.synthesisModel,
      providerPoolSize: providers.length,
    };

    const review = this.components.synthesis.synthesize(
      quietFiltered,
      reviewPR,
      testHints,
      aiAnalysis,
      providerResults,
      runDetails,
      impactAnalysis,
      mermaidDiagram
    );

    // Merge with previous review if incremental
    if (useIncremental && lastReviewData) {
      // Merge findings: keep findings from unchanged files, add new findings
      review.findings = this.components.incrementalReviewer.mergeFindings(
        lastReviewData.findings,
        review.findings,
        filesToReview
      );

      // Update summary with incremental note
      review.summary = this.components.incrementalReviewer.generateIncrementalSummary(
        lastReviewData.reviewSummary,
        review.summary,
        filesToReview,
        lastReviewData.lastReviewedCommit,
        pr.headSha
      );

      // Update metrics to reflect total findings
      review.metrics.totalFindings = review.findings.length;
      review.metrics.critical = review.findings.filter(f => f.severity === 'critical').length;
      review.metrics.major = review.findings.filter(f => f.severity === 'major').length;
      review.metrics.minor = review.findings.filter(f => f.severity === 'minor').length;

      logger.info(`Incremental review completed: ${review.findings.length} total findings after merge`);
    }

    review.metrics.totalCost = costSummary.totalCost;
    review.metrics.totalTokens = costSummary.totalTokens;
    review.metrics.providersUsed = providers.length;
    review.metrics.providersSuccess = providerResults.filter(r => r.status === 'success').length;
    review.metrics.providersFailed = providerResults.length - review.metrics.providersSuccess;
    review.metrics.durationSeconds = (Date.now() - start) / 1000;
    if (review.runDetails) {
      review.runDetails.durationSeconds = review.metrics.durationSeconds;
    }
    review.metrics.cached = Boolean(cachedFindings);

    if (config.enableCaching) {
      await this.components.cache.save(pr, review);
    }

    // Save incremental review data
    if (config.incrementalEnabled) {
      await this.components.incrementalReviewer.saveReview(pr, review);
    }

    const markdown = this.components.formatter.format(review);
    const suppressed = await this.components.feedbackFilter.loadSuppressed(pr.number);
    const inlineFiltered = review.inlineComments.filter(c => this.components.feedbackFilter.shouldPost(c, suppressed));

    // Update existing comment for incremental reviews
    await this.components.commentPoster.postSummary(pr.number, markdown, useIncremental);
    await this.components.commentPoster.postInline(pr.number, inlineFiltered, pr.files);

    await this.writeReports(review);

    return review;
  }

  /**
   * Cleanup resources after review to prevent memory leaks in long-running processes
   */
  async dispose(): Promise<void> {
    // Clear cost tracker accumulated data
    this.components.costTracker.reset();

    // Clear any cached data that might hold large objects
    // Note: Cache storage is file-based, so no in-memory cleanup needed
    // For in-memory caches, would call cache.clear() here

    logger.debug('Orchestrator resources disposed');
  }

  private shouldSkip(pr: PRContext): string | null {
    const { config } = this.components;

    if (config.skipDrafts && pr.draft) return 'PR is a draft';
    if (config.skipBots && this.isBot(pr.author)) return `Author ${pr.author} is a bot`;

    if (config.skipLabels.length > 0) {
      for (const label of pr.labels) {
        if (config.skipLabels.includes(label)) {
          return `Label ${label} triggers skip`;
        }
      }
    }

    const totalLines = pr.additions + pr.deletions;
    if (config.minChangedLines > 0 && totalLines < config.minChangedLines) {
      return `Change size ${totalLines} below minimum ${config.minChangedLines}`;
    }
    if (config.maxChangedFiles > 0 && pr.files.length > config.maxChangedFiles) {
      return `File count ${pr.files.length} exceeds max ${config.maxChangedFiles}`;
    }
    return null;
  }

  private isBot(author: string): boolean {
    const lower = author.toLowerCase();
    return ['bot', 'dependabot', 'renovate', 'github-actions', '[bot]'].some(p => lower.includes(p));
  }

  private async ensureBudget(config: ReviewConfig): Promise<void> {
    if (config.budgetMaxUsd <= 0) return;
    // Budget pre-check is skipped; cost is tracked after execution.
  }

  private estimateTokens(text: string): number {
    return Math.ceil(Buffer.byteLength(text, 'utf8') / 4);
  }

  /**
   * Filter diff to only include files that changed
   * Used for incremental reviews to send only relevant diffs to LLMs
   */
  private filterDiffByFiles(diff: string, files: FileChange[]): string {
    if (files.length === 0) return '';

    const fileNames = new Set(files.map(f => f.filename));
    const diffChunks: string[] = [];
    const chunks = diff.split(/^diff --git /m).filter(Boolean);

    for (const chunk of chunks) {
      // Extract filename from chunk (format: "a/file.ts b/file.ts")
      const firstLine = chunk.split('\n')[0];
      const bIndex = firstLine.indexOf(' b/');
      if (bIndex !== -1) {
        const filename = firstLine.substring(bIndex + 3).trim();
        if (fileNames.has(filename)) {
          diffChunks.push('diff --git ' + chunk);
        }
      }
    }

    return diffChunks.join('');
  }

  private enrichFinding(
    finding: Finding,
    files: FileChange[],
    context: UnchangedContext[],
    providerCount: number
  ): Finding {
    const file = files.find(f => f.filename === finding.file);
    const changedLines = mapAddedLines(file?.patch);
    const hasDirectEvidence = changedLines.some(l => l.line === finding.line);
    const astConfirmed = Boolean(finding.providers?.includes('ast') || finding.provider === 'ast');
    const graphConfirmed = context.some(ctx => ctx.file === finding.file);
    const relatedSnippets = context
      .filter(ctx => ctx.file === finding.file)
      .flatMap(ctx => ctx.affectedCode);

    const evidence = this.components.evidenceScorer.score(
      finding,
      providerCount,
      astConfirmed,
      graphConfirmed,
      hasDirectEvidence
    );

    return {
      ...finding,
      evidence,
      evidenceDetail: {
        changedLines: changedLines.map(c => c.line),
        relatedSnippets,
        providerAgreement: providerCount > 0 ? (finding.providers?.length || 0) / providerCount : 0,
        astConfirmed,
        graphConfirmed,
      },
    };
  }

  private applyQuietMode(findings: Finding[], config: ReviewConfig): Finding[] {
    if (!config.quietModeEnabled) return findings;
    const threshold = config.quietMinConfidence ?? 0.5;
    return findings.filter(f => (f.evidence?.confidence ?? 1) >= threshold);
  }

  private async writeReports(review: Review): Promise<void> {
    const base = process.env.REPORT_BASENAME || 'multi-provider-review';
    const sarifPath = path.join(process.cwd(), `${base}.sarif`);
    const jsonPath = path.join(process.cwd(), `${base}.json`);

    await fs.writeFile(sarifPath, JSON.stringify(buildSarif(review.findings), null, 2), 'utf8');
    await fs.writeFile(jsonPath, buildJson(review), 'utf8');
    logger.info(`Wrote reports: ${sarifPath}, ${jsonPath}`);
  }
}
