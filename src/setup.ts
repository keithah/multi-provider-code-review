import { ReviewConfig } from './types';
import { ProviderRegistry } from './providers/registry';
import { PromptBuilder } from './analysis/llm/prompt-builder';
import { LLMExecutor } from './analysis/llm/executor';
import { Deduplicator } from './analysis/deduplicator';
import { ConsensusEngine } from './analysis/consensus';
import { SynthesisEngine } from './analysis/synthesis';
import { TestCoverageAnalyzer } from './analysis/test-coverage';
import { ASTAnalyzer } from './analysis/ast/analyzer';
import { CacheManager } from './cache/manager';
import { IncrementalReviewer } from './cache/incremental';
import { CacheStorage } from './cache/storage';
import { PricingService } from './cost/pricing';
import { CostTracker } from './cost/tracker';
import { SecurityScanner } from './security/scanner';
import { RuleLoader } from './rules/loader';
import { PullRequestLoader } from './github/pr-loader';
import { CommentPoster } from './github/comment-poster';
import { GitHubClient } from './github/client';
import { MarkdownFormatter } from './output/formatter';
import { MarkdownFormatterV2 } from './output/formatter-v2';
import { ReviewComponents } from './core/orchestrator';
import { ContextRetriever } from './analysis/context';
import { ImpactAnalyzer } from './analysis/impact';
import { EvidenceScorer } from './analysis/evidence';
import { MermaidGenerator } from './output/mermaid';
import { FeedbackFilter } from './github/feedback';
import { ConfigLoader } from './config/loader';
import { FeedbackTracker } from './learning/feedback-tracker';
import { QuietModeFilter } from './learning/quiet-mode';
import { CodeGraphBuilder } from './analysis/context/graph-builder';
import { PromptGenerator } from './autofix/prompt-generator';
import { ReliabilityTracker } from './providers/reliability-tracker';
import { MetricsCollector } from './analytics/metrics-collector';
import { PluginLoader } from './plugins';

export interface SetupOptions {
  cliMode?: boolean;
  dryRun?: boolean;
  githubToken?: string;
  config?: ReviewConfig;
}

/**
 * Setup components for CLI mode (no GitHub dependencies)
 */
export async function setupComponents(options: SetupOptions = {}): Promise<ReviewComponents> {
  const config = options.config || ConfigLoader.load();

  // Override dry run if specified
  if (options.dryRun !== undefined) {
    config.dryRun = options.dryRun;
  }

  // In CLI mode, we don't need GitHub components
  if (options.cliMode) {
    return await createComponentsForCLI(config);
  }

  // GitHub Action mode requires token
  if (!options.githubToken) {
    throw new Error('GitHub token required for Action mode');
  }

  return await createComponents(config, options.githubToken);
}

/**
 * Create components for CLI mode (no GitHub API)
 */
async function createComponentsForCLI(config: ReviewConfig): Promise<ReviewComponents> {
  // Initialize plugins if enabled
  const pluginLoader = config.pluginsEnabled
    ? new PluginLoader({
        pluginDir: config.pluginDir || './plugins',
        enabled: config.pluginsEnabled,
        allowlist: config.pluginAllowlist,
        blocklist: config.pluginBlocklist,
      })
    : undefined;

  if (pluginLoader) {
    await pluginLoader.loadPlugins();
  }

  const providerRegistry = new ProviderRegistry(pluginLoader);
  const promptBuilder = new PromptBuilder(config);
  const llmExecutor = new LLMExecutor(config);
  const deduplicator = new Deduplicator();
  const consensus = new ConsensusEngine({
    minAgreement: config.inlineMinAgreement,
    minSeverity: config.inlineMinSeverity,
    maxComments: config.inlineMaxComments,
  });
  const synthesis = new SynthesisEngine(config);
  const testCoverage = new TestCoverageAnalyzer();
  const astAnalyzer = new ASTAnalyzer();
  const cache = new CacheManager();
  const incrementalReviewer = new IncrementalReviewer(new CacheStorage(), {
    enabled: config.incrementalEnabled,
    cacheTtlDays: config.incrementalCacheTtlDays,
  });
  const pricing = new PricingService(process.env.OPENROUTER_API_KEY);
  const costTracker = new CostTracker(pricing);
  const security = new SecurityScanner();
  const rules = RuleLoader.load();
  const contextRetriever = new ContextRetriever();
  const impactAnalyzer = new ImpactAnalyzer();
  const evidenceScorer = new EvidenceScorer();
  const mermaidGenerator = new MermaidGenerator();

  // Learning and auto-fix components
  const cacheStorage = new CacheStorage();
  const feedbackTracker = config.learningEnabled ? new FeedbackTracker(cacheStorage, config.learningMinFeedbackCount) : undefined;
  const quietModeFilter = config.quietModeEnabled
    ? new QuietModeFilter(
        {
          enabled: config.quietModeEnabled,
          minConfidence: config.quietMinConfidence || 0.5,
          useLearning: config.quietUseLearning || false,
        },
        feedbackTracker
      )
    : undefined;
  const graphBuilder = config.graphEnabled
    ? new CodeGraphBuilder(config.graphMaxDepth || 5, (config.graphTimeoutSeconds || 10) * 1000)
    : undefined;
  const promptGenerator = new PromptGenerator('plain');
  const reliabilityTracker = new ReliabilityTracker(cacheStorage);
  const metricsCollector = config.analyticsEnabled
    ? new MetricsCollector(cacheStorage, config)
    : undefined;

  // Mock GitHub components for CLI mode
  const mockGitHubClient = {} as GitHubClient;
  const prLoader = new PullRequestLoader(mockGitHubClient);
  const commentPoster = new CommentPoster(mockGitHubClient, true); // Always dry-run in CLI
  const formatter = new MarkdownFormatterV2();
  const feedbackFilter = {} as FeedbackFilter;

  return {
    config,
    providerRegistry,
    promptBuilder,
    llmExecutor,
    deduplicator,
    consensus,
    synthesis,
    testCoverage,
    astAnalyzer,
    cache,
    incrementalReviewer,
    costTracker,
    security,
    rules,
    prLoader,
    commentPoster,
    formatter,
    contextRetriever,
    impactAnalyzer,
    evidenceScorer,
    mermaidGenerator,
    feedbackFilter,
    feedbackTracker,
    quietModeFilter,
    graphBuilder,
    promptGenerator,
    reliabilityTracker,
    metricsCollector,
  };
}

export async function createComponents(config: ReviewConfig, githubToken: string): Promise<ReviewComponents> {
  // Initialize plugins if enabled
  const pluginLoader = config.pluginsEnabled
    ? new PluginLoader({
        pluginDir: config.pluginDir || './plugins',
        enabled: config.pluginsEnabled,
        allowlist: config.pluginAllowlist,
        blocklist: config.pluginBlocklist,
      })
    : undefined;

  if (pluginLoader) {
    await pluginLoader.loadPlugins();
  }

  const providerRegistry = new ProviderRegistry(pluginLoader);
  const promptBuilder = new PromptBuilder(config);
  const llmExecutor = new LLMExecutor(config);
  const deduplicator = new Deduplicator();
  const consensus = new ConsensusEngine({
    minAgreement: config.inlineMinAgreement,
    minSeverity: config.inlineMinSeverity,
    maxComments: config.inlineMaxComments,
  });
  const synthesis = new SynthesisEngine(config);
  const testCoverage = new TestCoverageAnalyzer();
  const astAnalyzer = new ASTAnalyzer();
  const cache = new CacheManager();
  const incrementalReviewer = new IncrementalReviewer(new CacheStorage(), {
    enabled: config.incrementalEnabled,
    cacheTtlDays: config.incrementalCacheTtlDays,
  });
  const pricing = new PricingService(process.env.OPENROUTER_API_KEY);
  const costTracker = new CostTracker(pricing);
  const security = new SecurityScanner();
  const rules = RuleLoader.load();
  const githubClient = new GitHubClient(githubToken);
  const prLoader = new PullRequestLoader(githubClient);
  const commentPoster = new CommentPoster(githubClient, config.dryRun);
  const formatter = new MarkdownFormatterV2();
  const contextRetriever = new ContextRetriever();
  const impactAnalyzer = new ImpactAnalyzer();
  const evidenceScorer = new EvidenceScorer();
  const mermaidGenerator = new MermaidGenerator();
  const feedbackFilter = new FeedbackFilter(githubClient);

  // Learning and auto-fix components
  const cacheStorage = new CacheStorage();
  const feedbackTracker = config.learningEnabled ? new FeedbackTracker(cacheStorage, config.learningMinFeedbackCount) : undefined;
  const quietModeFilter = config.quietModeEnabled
    ? new QuietModeFilter(
        {
          enabled: config.quietModeEnabled,
          minConfidence: config.quietMinConfidence || 0.5,
          useLearning: config.quietUseLearning || false,
        },
        feedbackTracker
      )
    : undefined;
  const graphBuilder = config.graphEnabled
    ? new CodeGraphBuilder(config.graphMaxDepth || 5, (config.graphTimeoutSeconds || 10) * 1000)
    : undefined;
  const promptGenerator = new PromptGenerator('plain');
  const reliabilityTracker = new ReliabilityTracker(cacheStorage);
  const metricsCollector = config.analyticsEnabled
    ? new MetricsCollector(cacheStorage, config)
    : undefined;

  return {
    config,
    providerRegistry,
    promptBuilder,
    llmExecutor,
    deduplicator,
    consensus,
    synthesis,
    testCoverage,
    astAnalyzer,
    cache,
    incrementalReviewer,
    costTracker,
    security,
    rules,
    prLoader,
    commentPoster,
    formatter,
    contextRetriever,
    impactAnalyzer,
    evidenceScorer,
    mermaidGenerator,
    feedbackFilter,
    feedbackTracker,
    quietModeFilter,
    graphBuilder,
    promptGenerator,
    reliabilityTracker,
    metricsCollector,
  };
}
