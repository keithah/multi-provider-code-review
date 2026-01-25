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
import { MarkdownFormatterV2 } from '../output/formatter-v2';
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
import { FeedbackTracker } from '../learning/feedback-tracker';
import { QuietModeFilter } from '../learning/quiet-mode';
import { CodeGraphBuilder, CodeGraph } from '../analysis/context/graph-builder';
import { PromptGenerator } from '../autofix/prompt-generator';
import { ReliabilityTracker } from '../providers/reliability-tracker';
import { MetricsCollector } from '../analytics/metrics-collector';
import { TrivialDetector } from '../analysis/trivial-detector';
import { PathMatcher, createDefaultPathMatcherConfig, PathPattern } from '../analysis/path-matcher';
import { z } from 'zod';
import { Provider } from '../providers/base';
import { createQueue } from '../utils/parallel';
import { ReviewConfig, Review, PRContext, RunDetails, Finding, FileChange, UnchangedContext, ProviderResult } from '../types';
import { logger } from '../utils/logger';
import { mapAddedLines, filterDiffByFiles } from '../utils/diff';
import { BatchOrchestrator } from './batch-orchestrator';
import { ProgressTracker } from '../github/progress-tracker';
import { GitHubClient } from '../github/client';
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
  formatter: MarkdownFormatter | MarkdownFormatterV2;
  contextRetriever: ContextRetriever;
  impactAnalyzer: ImpactAnalyzer;
  evidenceScorer: EvidenceScorer;
  mermaidGenerator: MermaidGenerator;
  feedbackFilter: FeedbackFilter;
  feedbackTracker?: FeedbackTracker;
  quietModeFilter?: QuietModeFilter;
  graphBuilder?: CodeGraphBuilder;
  promptGenerator?: PromptGenerator;
  reliabilityTracker?: ReliabilityTracker;
  metricsCollector?: MetricsCollector;
  batchOrchestrator?: BatchOrchestrator;
  githubClient?: GitHubClient;
}

export class ReviewOrchestrator {
  constructor(private readonly components: ReviewComponents) {}

  async execute(prNumber: number): Promise<Review | null> {
    const pr = await this.components.prLoader.load(prNumber);
    const skipReason = this.shouldSkip(pr);
    if (skipReason) {
      logger.info(`Skipping review: ${skipReason}`);
      return null;
    }

    return this.executeReview(pr);
  }

  /**
   * Execute review on a given PR context
   * Can be called directly with a PRContext from CLI or GitHub
   *
   * IMMUTABILITY GUARANTEE: This function does not mutate the input `pr` parameter.
   * When filtering or transforming the PR context, a new object is created with spread syntax.
   * Tests verify that pr.files array is not modified by this function.
   */
  async executeReview(pr: PRContext): Promise<Review> {
    const { config } = this.components;
    const start = Date.now();
    const progressTracker = await this.initProgressTracker(pr);
    progressTracker?.addItem('graph', 'Build code graph');
    progressTracker?.addItem('llm', 'LLM review (batched)');
    progressTracker?.addItem('static', 'Static analysis & rules');
    progressTracker?.addItem('synthesis', 'Synthesize & report');
    let review: Review | null = null;
    let success = false;
    try {

    // Build code graph if enabled
    let codeGraph: CodeGraph | undefined;
    let contextRetriever = this.components.contextRetriever;
    if (config.graphEnabled && this.components.graphBuilder) {
      try {
        const graphStart = Date.now();
        codeGraph = await this.components.graphBuilder.buildGraph(pr.files);
        const graphTime = Date.now() - graphStart;
        logger.info(`Code graph built in ${graphTime}ms: ${codeGraph.getStats().definitions} definitions, ${codeGraph.getStats().imports} imports`);
        await progressTracker?.updateProgress('graph', 'completed', `Built in ${graphTime}ms`);

        // Create new context retriever with graph for this review (don't mutate shared component)
        if (codeGraph) {
          contextRetriever = new ContextRetriever(codeGraph);
        }
      } catch (error) {
        logger.warn('Failed to build code graph, falling back to regex-based context', error as Error);
        await progressTracker?.updateProgress('graph', 'failed', 'Graph build failed, using regex context');
      }
    }

    // Check for trivial changes (dependency locks, docs, config files, test fixtures)
    let reviewContext = pr;
    if (config.skipTrivialChanges) {
      const trivialDetector = new TrivialDetector({
        enabled: true,
        skipDependencyUpdates: config.skipDependencyUpdates ?? true,
        skipDocumentationOnly: config.skipDocumentationOnly ?? true,
        skipFormattingOnly: config.skipFormattingOnly ?? false,
        skipTestFixtures: config.skipTestFixtures ?? true,
        skipConfigFiles: config.skipConfigFiles ?? true,
        skipBuildArtifacts: config.skipBuildArtifacts ?? true,
        customTrivialPatterns: config.trivialPatterns ?? [],
      });

      const trivialResult = trivialDetector.detect(pr.files);

      if (trivialResult.isTrivial) {
        // Entire PR is trivial - post simple comment and skip review
        logger.info(`Skipping review: ${trivialResult.reason}`);
        const trivialReview = this.createTrivialReview(trivialResult.reason!, pr.files.length, start);
        const markdown = this.components.formatter.format(trivialReview);
        await this.components.commentPoster.postSummary(pr.number, markdown, false);

        // Record metrics for trivial review (shows cost/time saved)
        if (config.analyticsEnabled && this.components.metricsCollector) {
          try {
            await this.components.metricsCollector.recordReview(trivialReview, pr.number);
            logger.debug(`Recorded trivial review metrics for PR #${pr.number}`);
          } catch (error) {
            logger.warn('Failed to record trivial review metrics', error as Error);
          }
        }

        review = trivialReview;
        success = true;
        return trivialReview;
      }

      // Some files are trivial - filter them out before review (create new context, don't mutate)
      if (trivialResult.trivialFiles.length > 0) {
        logger.info(`Filtering ${trivialResult.trivialFiles.length} trivial files from review: ${trivialResult.trivialFiles.join(', ')}`);
        const nonTrivialFiles = pr.files.filter(f => trivialResult.nonTrivialFiles.includes(f.filename));
        reviewContext = {
          ...pr,
          files: nonTrivialFiles,
          diff: filterDiffByFiles(pr.diff, nonTrivialFiles),
        };
      }
    }

    // Determine review intensity based on file paths (after trivial filtering)
    // NOTE: Currently logs intensity but doesn't apply it to review behavior
    // TODO: Wire intensity into PromptBuilder, provider selection, or analysis depth
    if (config.pathBasedIntensity) {
      let patterns: PathPattern[] = [];
      if (config.pathIntensityPatterns) {
        try {
          const parsed = JSON.parse(config.pathIntensityPatterns);

          // Validate that parsed result is an array
          if (!Array.isArray(parsed)) {
            logger.warn('pathIntensityPatterns is not an array, using defaults');
            patterns = createDefaultPathMatcherConfig().patterns;
          } else {
            // Validate each pattern object against schema
            const PathPatternSchema = z.object({
              pattern: z.string(),
              intensity: z.enum(['thorough', 'standard', 'light'] as const),
              description: z.string().optional(),
            });

            const validPatterns: PathPattern[] = [];
            for (const item of parsed) {
              const result = PathPatternSchema.safeParse(item);
              if (result.success) {
                validPatterns.push(result.data);
              } else {
                logger.warn(`Invalid path pattern object, skipping: ${JSON.stringify(item)}`);
              }
            }

            if (validPatterns.length === 0) {
              logger.warn('No valid path patterns found, using defaults');
              patterns = createDefaultPathMatcherConfig().patterns;
            } else {
              patterns = validPatterns;
            }
          }
        } catch (error) {
          logger.warn('Failed to parse pathIntensityPatterns, using defaults', error as Error);
          // Fallback to default patterns on parse failure
          patterns = createDefaultPathMatcherConfig().patterns;
        }
      } else {
        // No patterns configured, use defaults
        patterns = createDefaultPathMatcherConfig().patterns;
      }

      const pathMatcher = new PathMatcher({
        enabled: true,
        defaultIntensity: config.pathDefaultIntensity ?? 'standard',
        patterns,
      });

      const intensityResult = pathMatcher.determineIntensity(reviewContext.files);
      logger.info(`Review intensity: ${intensityResult.intensity} - ${intensityResult.reason}`);

      if (intensityResult.matchedPaths.length > 0) {
        logger.debug(`Matched paths: ${intensityResult.matchedPaths.join(', ')}`);
      }
    }

    // Check for incremental review (use reviewContext which may have filtered trivial files)
    const useIncremental = await this.components.incrementalReviewer.shouldUseIncremental(reviewContext);
    let filesToReview: FileChange[] = reviewContext.files;
    let lastReviewData = null;

    if (useIncremental) {
      lastReviewData = await this.components.incrementalReviewer.getLastReview(reviewContext.number);
      if (lastReviewData) {
        filesToReview = await this.components.incrementalReviewer.getChangedFilesSince(reviewContext, lastReviewData.lastReviewedCommit);
        logger.info(`Incremental review: reviewing ${filesToReview.length} changed files`);

        // Update graph incrementally if available
        if (codeGraph && this.components.graphBuilder) {
          try {
            codeGraph = await this.components.graphBuilder.updateGraph(codeGraph, filesToReview);
            logger.debug('Code graph updated incrementally');
          } catch (error) {
            logger.warn('Failed to update code graph incrementally', error as Error);
          }
        }
      }
    }

    const cachedFindings = config.enableCaching ? await this.components.cache.load(reviewContext) : null;

    // Create a PR context for the files to review with filtered diff
    const reviewPR: PRContext = useIncremental
      ? { ...reviewContext, files: filesToReview, diff: filterDiffByFiles(reviewContext.diff, filesToReview) }
      : reviewContext;

    // Skip LLM execution if no files to review (incremental with no changes)
    const llmFindings: Finding[] = [];
    let providerResults: ProviderResult[] = [];
    let aiAnalysis: ReturnType<typeof summarizeAIDetection> | undefined;
    let providers = await this.components.providerRegistry.createProviders(config);
    providers = await this.applyReliabilityFilters(providers);
    if (providers.length === 0) {
      logger.warn('All providers filtered out by circuit breakers/reliability; skipping LLM execution');
      await progressTracker?.updateProgress('llm', 'failed', 'No available providers after reliability filtering');
    }

    const batchOrchestrator =
      this.components.batchOrchestrator ||
      new BatchOrchestrator({
        defaultBatchSize: config.batchMaxFiles || 30,
        providerOverrides: config.providerBatchOverrides,
      });

    if (filesToReview.length === 0) {
      logger.info('No files to review in incremental update, using cached findings only');
    } else {
      await this.ensureBudget(config);

      // Health check providers once before batching
      const healthCheckTimeout = 30000; // 30 seconds
      const { healthy, healthCheckResults } = await this.components.llmExecutor.filterHealthyProviders(
        providers,
        healthCheckTimeout
      );

      if (healthy.length === 0) {
        logger.warn('No healthy providers available after health checks');
        providerResults = healthCheckResults;
        await this.recordReliability(providerResults);
        await progressTracker?.updateProgress('llm', 'failed', 'No healthy providers after health checks');
      } else {
        const batchSize = batchOrchestrator.getBatchSize(healthy.map(p => p.name));
        let batches: FileChange[][];
        try {
          batches = batchOrchestrator.createBatches(filesToReview, batchSize);
        } catch (error) {
          logger.warn(
            `Invalid batch size ${batchSize} computed from providers (${healthy.map(p => p.name).join(', ')}) - falling back to size 1`,
            error as Error
          );
          batches = batchOrchestrator.createBatches(filesToReview, 1);
        }

        const batchQueue = createQueue(Math.max(1, Number(config.providerMaxParallel) || 1));

        logger.info(`Processing ${batches.length} batch(es) with size ${batchSize}`);

        const batchPromises: Promise<ProviderResult[]>[] = batches.map(batch =>
          batchQueue.add(async () => {
            const batchDiff = filterDiffByFiles(reviewContext.diff, batch);
            const batchContext: PRContext = { ...reviewContext, files: batch, diff: batchDiff };
            const prompt = this.components.promptBuilder.build(batchContext);

            try {
              const results = await this.components.llmExecutor.execute(healthy, prompt);

              for (const result of results) {
                await this.components.costTracker.record(result.name, result.result?.usage, config.budgetMaxUsd);
              }

              return results;
            } catch (error) {
              logger.error('Batch execution failed', error as Error);
              return healthy.map(provider => ({
                name: provider.name,
                status: 'error' as const,
                error: error as Error,
                durationSeconds: 0,
              }));
            }
          }) as Promise<ProviderResult[]>
        );

        const batchResults: ProviderResult[] = [];
        try {
          const settled = await Promise.allSettled(batchPromises);
          for (const result of settled) {
            if (result.status === 'fulfilled') {
              batchResults.push(...result.value);
            } else {
              logger.error('Batch promise rejected', result.reason as Error);
              batchResults.push({
                name: 'batch',
                status: 'error',
                error: result.reason as Error,
                durationSeconds: 0,
              });
            }
          }
        } finally {
          await batchQueue.onIdle();
          if (typeof (batchQueue as any).clear === 'function') {
            (batchQueue as any).clear();
          } else {
            // Best-effort cleanup for older p-queue versions
            batchQueue.pause();
            batchQueue.removeAllListeners();
          }
        }
        llmFindings.push(...extractFindings(batchResults));
        providerResults = batchResults;
        await this.recordReliability([...healthCheckResults, ...batchResults]);
        aiAnalysis = config.enableAiDetection ? summarizeAIDetection(providerResults) : undefined;
        await progressTracker?.updateProgress('llm', 'completed', `Batches: ${batches.length}, size: ${batchSize}`);
      }
    }

    const astFindings = config.enableAstAnalysis ? this.components.astAnalyzer.analyze(filesToReview) : [];
    const ruleFindings = this.components.rules.run(filesToReview);
    const securityFindings = config.enableSecurity ? this.components.security.scan(filesToReview) : [];
    const context = contextRetriever.findRelatedContext(filesToReview);

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
      this.enrichFinding(f, pr.files, context, providerCount, codeGraph)
    );
    const quietFiltered = await this.applyQuietMode(enriched, config);
    await progressTracker?.updateProgress('static', 'completed', 'AST, security, and rules processed');

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

    review = this.components.synthesis.synthesize(
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

    // Generate fix prompts if enabled
    if (config.generateFixPrompts && this.components.promptGenerator) {
      const fixPrompts = this.components.promptGenerator.generateFixPrompts(review.findings);
      if (fixPrompts.length > 0) {
        // Sanitize REPORT_BASENAME to prevent path traversal
        const basename = this.sanitizeFilename(process.env.REPORT_BASENAME || 'multi-provider-review');
        const fixPromptsPath = path.join(process.cwd(), `${basename}-fix-prompts.md`);
        const format = (config.fixPromptFormat as 'cursor' | 'copilot' | 'plain') || 'plain';
        await this.components.promptGenerator.saveToFile(fixPrompts, fixPromptsPath, format);
        logger.info(`Generated ${fixPrompts.length} fix prompts: ${fixPromptsPath}`);
      }
    }

    if (config.enableCaching) {
      await this.components.cache.save(pr, review);
    }

    // Save incremental review data
    if (config.incrementalEnabled) {
      await this.components.incrementalReviewer.saveReview(pr, review);
    }

    // Record review metrics for analytics
    if (config.analyticsEnabled && this.components.metricsCollector) {
      try {
        await this.components.metricsCollector.recordReview(review, pr.number);
        logger.debug(`Recorded review metrics for PR #${pr.number}`);
      } catch (error) {
        logger.warn('Failed to record review metrics', error as Error);
      }
    }

    const markdown = this.components.formatter.format(review);
    const suppressed = await this.components.feedbackFilter.loadSuppressed(pr.number);
    const inlineFiltered = review.inlineComments.filter(c => this.components.feedbackFilter.shouldPost(c, suppressed));

    // Update existing comment for incremental reviews
    await this.components.commentPoster.postSummary(pr.number, markdown, useIncremental);
    await this.components.commentPoster.postInline(pr.number, inlineFiltered, pr.files, pr.headSha);

    await this.writeReports(review);
    await progressTracker?.updateProgress('synthesis', 'completed');
        success = true;
        return review;
      } catch (error) {
        await progressTracker?.updateProgress('synthesis', 'failed', (error as Error).message);
        throw error;
      } finally {
        if (progressTracker) {
          try {
            progressTracker.setTotalCost(this.components.costTracker.summary().totalCost);
            await progressTracker.finalize(success);
          } catch (err) {
            logger.warn('Failed to finalize progress tracker', err as Error);
          }
        }
      }
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

  private async applyReliabilityFilters(providers: Provider[]): Promise<Provider[]> {
    const tracker = this.components.reliabilityTracker;
    if (!tracker || providers.length === 0) return providers;

    const available: Provider[] = [];
    for (const provider of providers) {
      const open = await tracker.isCircuitOpen(provider.name);
      if (open) {
        logger.warn(`Skipping provider ${provider.name} (circuit open)`);
        continue;
      }
      available.push(provider);
    }

    if (available.length === 0) {
      logger.warn('All providers are currently tripped by circuit breakers; skipping review run');
      return [];
    }

    const rankings = await tracker.rankProviders(available.map(p => p.name));
    const scoreMap = new Map(rankings.map(r => [r.providerId, r.score]));
    return [...available].sort((a, b) => (scoreMap.get(b.name) ?? 0.5) - (scoreMap.get(a.name) ?? 0.5));
  }

  private async recordReliability(results: ProviderResult[]): Promise<void> {
    if (!this.components.reliabilityTracker) return;
    for (const result of results) {
      await this.components.reliabilityTracker.recordResult(
        result.name,
        result.status === 'success',
        result.durationSeconds * 1000,
        result.error?.message
      );
    }
  }

  private async initProgressTracker(pr: PRContext): Promise<ProgressTracker | undefined> {
    if (!this.components.githubClient || this.components.config.dryRun) return undefined;

    try {
      const tracker = new ProgressTracker(this.components.githubClient.octokit, {
        owner: this.components.githubClient.owner,
        repo: this.components.githubClient.repo,
        prNumber: pr.number,
        updateStrategy: 'milestone',
      });
      await tracker.initialize();
      return tracker;
    } catch (error) {
      logger.warn('Failed to initialize progress tracker', error as Error);
      return undefined;
    }
  }

  private async ensureBudget(config: ReviewConfig): Promise<void> {
    if (config.budgetMaxUsd <= 0) return;

    // Pre-flight guardrail: refuse to run when no budget remains based on cached totals
    const projected = this.components.costTracker.summary().totalCost;
    if (projected >= config.budgetMaxUsd) {
      throw new Error(
        `Budget exhausted: current recorded cost $${projected.toFixed(4)} exceeds or equals cap $${config.budgetMaxUsd.toFixed(2)}`
      );
    }
  }

  private estimateTokens(text: string): number {
    return Math.ceil(Buffer.byteLength(text, 'utf8') / 4);
  }

  /**
   * Sanitize filename to prevent path traversal attacks
   * Removes directory separators, path traversal sequences, and absolute paths
   */
  private sanitizeFilename(filename: string): string {
    // Check for path traversal patterns
    if (filename.includes('..') || filename.includes('/') || filename.includes('\\')) {
      logger.warn(`Detected path traversal attempt in filename: ${filename}`);
      // Use only the basename (last component)
      filename = path.basename(filename);
    }

    // Check for absolute paths
    if (path.isAbsolute(filename)) {
      logger.warn(`Detected absolute path in filename: ${filename}`);
      filename = path.basename(filename);
    }

    // Remove all non-alphanumeric characters except dash and underscore
    const sanitized = filename
      .replace(/[^a-zA-Z0-9_-]/g, '-')
      .substring(0, 50);

    // Ensure we don't end up with an empty string
    return sanitized || 'multi-provider-review';
  }

  /**
   * Filter diff to only include files that changed
   * Used for incremental reviews to send only relevant diffs to LLMs
   * Uses indexOf instead of regex to avoid ReDoS and improve memory efficiency
   */
  private enrichFinding(
    finding: Finding,
    files: FileChange[],
    context: UnchangedContext[],
    providerCount: number,
    codeGraph?: CodeGraph
  ): Finding {
    const file = files.find(f => f.filename === finding.file);
    const changedLines = mapAddedLines(file?.patch);
    const hasDirectEvidence = changedLines.some(l => l.line === finding.line);
    const astConfirmed = Boolean(finding.providers?.includes('ast') || finding.provider === 'ast');

    // Enhanced graph confirmation using code graph
    let graphConfirmed = context.some(ctx => ctx.file === finding.file);
    if (codeGraph && !graphConfirmed) {
      // Check if the file has dependents (is used elsewhere)
      const dependents = codeGraph.getDependents(finding.file);
      graphConfirmed = dependents.length > 0;
    }

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

  private async applyQuietMode(findings: Finding[], config: ReviewConfig): Promise<Finding[]> {
    if (!config.quietModeEnabled) return findings;

    // Use quiet mode filter with learning if available
    if (this.components.quietModeFilter) {
      const filtered = await this.components.quietModeFilter.filterByConfidence(findings);
      const filterStats = await this.components.quietModeFilter.getFilterStats(findings);
      logger.info(`Quiet mode: filtered ${filterStats.filtered}/${filterStats.total} findings (${filterStats.filterRate.toFixed(1)}% reduction)`);
      return filtered;
    }

    // Fallback to simple threshold filtering
    const threshold = config.quietMinConfidence ?? 0.5;
    return findings.filter(f => (f.evidence?.confidence ?? 1) >= threshold);
  }

  /**
   * Create a simple review result for trivial PRs that don't need full analysis
   * Tracks time saved and cost avoided
   */
  private createTrivialReview(reason: string, fileCount: number, startTime: number): Review {
    const durationSeconds = Math.max(0.001, (Date.now() - startTime) / 1000);

    return {
      summary: `This PR contains only trivial changes that don't require detailed review.\n\n**Reason:** ${reason}\n\n**Files changed:** ${fileCount}\n\n**Cost savings:** Skipped LLM analysis, saving estimated $0.01-0.05 in API costs.\n\nThese types of changes are automatically filtered to save review time and API costs. If you believe this should have been reviewed, you can disable trivial change detection in the configuration.`,
      findings: [],
      inlineComments: [],
      actionItems: [],
      metrics: {
        totalFindings: 0,
        critical: 0,
        major: 0,
        minor: 0,
        providersUsed: 0,
        providersSuccess: 0,
        providersFailed: 0,
        totalTokens: 0,
        totalCost: 0,
        durationSeconds,
      },
      runDetails: {
        providers: [],
        totalCost: 0,
        totalTokens: 0,
        durationSeconds,
        cacheHit: false,
        synthesisModel: '',
        providerPoolSize: 0,
      },
    };
  }

  private async writeReports(review: Review): Promise<void> {
    // Sanitize REPORT_BASENAME to prevent path traversal
    const base = this.sanitizeFilename(process.env.REPORT_BASENAME || 'multi-provider-review');
    const sarifPath = path.join(process.cwd(), `${base}.sarif`);
    const jsonPath = path.join(process.cwd(), `${base}.json`);

    await fs.writeFile(sarifPath, JSON.stringify(buildSarif(review.findings), null, 2), 'utf8');
    await fs.writeFile(jsonPath, buildJson(review), 'utf8');
    logger.info(`Wrote reports: ${sarifPath}, ${jsonPath}`);
  }
}
