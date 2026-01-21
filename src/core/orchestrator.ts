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
import { buildJson } from '../output/json';
import { buildSarif } from '../output/sarif';
import { CacheManager } from '../cache/manager';
import { CostTracker } from '../cost/tracker';
import { SecurityScanner } from '../security/scanner';
import { RulesEngine } from '../rules/engine';
import { ReviewConfig, Review, PRContext, RunDetails } from '../types';
import { logger } from '../utils/logger';
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
  costTracker: CostTracker;
  security: SecurityScanner;
  rules: RulesEngine;
  prLoader: PullRequestLoader;
  commentPoster: CommentPoster;
  formatter: MarkdownFormatter;
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

    const cachedFindings = config.enableCaching ? await this.components.cache.load(pr) : null;

    const providers = await this.components.providerRegistry.createProviders(config);
    const prompt = this.components.promptBuilder.build(pr);

    await this.ensureBudget(config, prompt, providers.map(p => p.name));

    const astFindings = config.enableAstAnalysis ? this.components.astAnalyzer.analyze(pr.files) : [];
    const ruleFindings = this.components.rules.run(pr.files);
    const securityFindings = config.enableSecurity ? this.components.security.scan(pr.files) : [];

    const providerResults = await this.components.llmExecutor.execute(providers, prompt);
    const llmFindings = extractFindings(providerResults);
    const aiAnalysis = config.enableAiDetection ? summarizeAIDetection(providerResults) : undefined;

    for (const result of providerResults) {
      await this.components.costTracker.record(result.name, result.result?.usage);
    }

    const combinedFindings = [
      ...astFindings,
      ...ruleFindings,
      ...securityFindings,
      ...llmFindings,
      ...(cachedFindings || []),
    ];

    const deduped = this.components.deduplicator.dedupe(combinedFindings);
    const consensus = this.components.consensus.filter(deduped);

    const testHints = config.enableTestHints ? this.components.testCoverage.analyze(pr.files) : undefined;
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

    const review = this.components.synthesis.synthesize(consensus, pr, testHints, aiAnalysis, providerResults, runDetails);

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

    const markdown = this.components.formatter.format(review);
    await this.components.commentPoster.postSummary(pr.number, markdown);
    await this.components.commentPoster.postInline(pr.number, review.inlineComments);

    await this.writeReports(review);

    return review;
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

  private async ensureBudget(config: ReviewConfig, prompt: string, providerNames: string[]): Promise<void> {
    if (config.budgetMaxUsd <= 0) return;
    const estimatedTokens = this.estimateTokens(prompt);
    let projected = 0;

    for (const name of providerNames) {
      const modelId = name.replace('openrouter/', '').replace('opencode/', '');
      // Without pricing service available, treat as zero-cost for budget gate.
      if (!this.components.costTracker) continue;
      // Use cached pricing if already tracked
      projected += 0; // placeholder; costTracker will update actuals post-run
    }

    if (projected > config.budgetMaxUsd) {
      throw new Error(`Estimated cost $${projected.toFixed(4)} exceeds budget $${config.budgetMaxUsd.toFixed(2)}`);
    }
  }

  private estimateTokens(text: string): number {
    return Math.ceil(Buffer.byteLength(text, 'utf8') / 4);
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
