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
import { PricingService } from './cost/pricing';
import { CostTracker } from './cost/tracker';
import { SecurityScanner } from './security/scanner';
import { RuleLoader } from './rules/loader';
import { PullRequestLoader } from './github/pr-loader';
import { CommentPoster } from './github/comment-poster';
import { GitHubClient } from './github/client';
import { MarkdownFormatter } from './output/formatter';
import { ReviewComponents } from './core/orchestrator';
import { ContextRetriever } from './analysis/context';
import { ImpactAnalyzer } from './analysis/impact';
import { EvidenceScorer } from './analysis/evidence';
import { MermaidGenerator } from './output/mermaid';
import { FeedbackFilter } from './github/feedback';

export function createComponents(config: ReviewConfig, githubToken: string): ReviewComponents {
  const providerRegistry = new ProviderRegistry();
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
  const pricing = new PricingService(process.env.OPENROUTER_API_KEY);
  const costTracker = new CostTracker(pricing);
  const security = new SecurityScanner();
  const rules = RuleLoader.load();
  const githubClient = new GitHubClient(githubToken);
  const prLoader = new PullRequestLoader(githubClient);
  const commentPoster = new CommentPoster(githubClient, config.dryRun);
  const formatter = new MarkdownFormatter();
  const contextRetriever = new ContextRetriever();
  const impactAnalyzer = new ImpactAnalyzer();
  const evidenceScorer = new EvidenceScorer();
  const mermaidGenerator = new MermaidGenerator();
  const feedbackFilter = new FeedbackFilter(githubClient);

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
  };
}
