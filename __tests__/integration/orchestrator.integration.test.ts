import { ReviewOrchestrator, ReviewComponents } from '../../src/core/orchestrator';
import { ReviewConfig, PRContext, Finding, ProviderResult } from '../../src/types';
import { ConsensusEngine } from '../../src/analysis/consensus';
import { Deduplicator } from '../../src/analysis/deduplicator';
import { SynthesisEngine } from '../../src/analysis/synthesis';
import { TestCoverageAnalyzer } from '../../src/analysis/test-coverage';
import { ASTAnalyzer } from '../../src/analysis/ast/analyzer';
import { CacheManager } from '../../src/cache/manager';
import { CostTracker } from '../../src/cost/tracker';
import { SecurityScanner } from '../../src/security/scanner';
import { RulesEngine } from '../../src/rules/engine';
import { MarkdownFormatter } from '../../src/output/formatter';
import { CommentPoster } from '../../src/github/comment-poster';
import { PullRequestLoader } from '../../src/github/pr-loader';
import { Provider } from '../../src/providers/base';
import { ContextRetriever } from '../../src/analysis/context';
import { ImpactAnalyzer } from '../../src/analysis/impact';
import { EvidenceScorer } from '../../src/analysis/evidence';
import { MermaidGenerator } from '../../src/output/mermaid';
import { FeedbackFilter } from '../../src/github/feedback';

class FakeProvider extends Provider {
  constructor() {
    super('fake/model');
  }
  async review(_prompt: string, _timeoutMs: number): Promise<any> {
    void _prompt;
    void _timeoutMs;
    return {
      content: 'ok',
      findings: [
        { file: 'src/index.ts', line: 15, severity: 'major', title: 'LLM issue', message: 'From LLM' },
      ],
    };
  }
}

class StubLLMExecutor {
  async filterHealthyProviders(providers: Provider[]): Promise<{ healthy: Provider[]; healthCheckResults: ProviderResult[] }> {
    // In tests, assume all providers are healthy
    return { healthy: providers, healthCheckResults: [] };
  }

  async execute(): Promise<ProviderResult[]> {
    const provider = new FakeProvider();
    const result = await provider.review('', 1000);
    return [
      {
        name: provider.name,
        status: 'success',
        result,
        durationSeconds: 0.1,
      },
    ];
  }
}

class StubProviderRegistry {
  async createProviders(): Promise<Provider[]> {
    return [new FakeProvider()];
  }
}

class StubPRLoader {
  async load(): Promise<PRContext> {
    return {
      number: 1,
      title: 'Test PR',
      body: '',
      author: 'dev',
      draft: false,
      labels: [],
      files: [
        {
          filename: 'src/index.ts',
          status: 'modified',
          additions: 2,
          deletions: 0,
          changes: 2,
          patch: '@@ -1,1 +1,2 @@\n const a = 1;\n+console.log(a);\n',
        },
      ],
      diff: '',
      additions: 2,
      deletions: 0,
      baseSha: 'base',
      headSha: 'head',
    };
  }
}

class StubCommentPoster {
  postedSummary: string | null = null;
  postedInline: any[] = [];
  async postSummary(_pr: number, body: string): Promise<void> {
    void _pr;
    this.postedSummary = body;
  }
  async postInline(_pr: number, comments: any[]): Promise<void> {
    void _pr;
    this.postedInline = comments;
  }
}

class NoopCache extends CacheManager {
  async load(): Promise<Finding[] | null> {
    return null;
  }
  async save(): Promise<void> {
    return;
  }
}

class StubFeedbackFilter {
  async loadSuppressed(): Promise<Set<string>> {
    return new Set();
  }
  shouldPost(): boolean {
    return true;
  }
}

describe('ReviewOrchestrator integration (offline)', () => {
  const config: ReviewConfig = {
    providers: ['fake/model'],
    synthesisModel: 'fake/model',
    fallbackProviders: [],
    providerAllowlist: [],
    providerBlocklist: [],
    providerDiscoveryLimit: 8,
    providerLimit: 0,
    providerRetries: 1,
    providerMaxParallel: 1,
    inlineMaxComments: 1,
    inlineMinSeverity: 'minor',
    inlineMinAgreement: 1,
    skipLabels: [],
    skipDrafts: false,
    skipBots: false,
    minChangedLines: 0,
    maxChangedFiles: 0,
    diffMaxBytes: 50000,
    runTimeoutSeconds: 5,
    budgetMaxUsd: 1,
    enableAstAnalysis: true,
    enableSecurity: true,
    enableCaching: false,
    enableTestHints: false,
    enableAiDetection: false,
    incrementalEnabled: false,
    incrementalCacheTtlDays: 7,
    dryRun: false,
  };

  it('merges AST/security/static with LLM findings and respects inline limit only for inline comments', async () => {
    const components: ReviewComponents = {
      config,
      providerRegistry: new StubProviderRegistry() as any,
      llmExecutor: new StubLLMExecutor() as any,
      deduplicator: new Deduplicator(),
      consensus: new ConsensusEngine({ minAgreement: 1, minSeverity: 'minor', maxComments: 100 }),
      synthesis: new SynthesisEngine(config),
      testCoverage: new TestCoverageAnalyzer(),
      astAnalyzer: new ASTAnalyzer(),
      cache: new NoopCache(),
      incrementalReviewer: {
        shouldUseIncremental: async () => false,
        getLastReview: async () => null,
        saveReview: async () => {},
        getChangedFilesSince: async () => [],
        mergeFindings: (prev: any, curr: any) => curr,
        generateIncrementalSummary: () => '',
      } as any,
      costTracker: new CostTracker({ getPricing: async () => ({ modelId: 'fake', promptPrice: 0, completionPrice: 0, isFree: true }) } as any),
      security: new SecurityScanner(),
      rules: new RulesEngine([]),
      prLoader: new StubPRLoader() as unknown as PullRequestLoader,
      commentPoster: new StubCommentPoster() as unknown as CommentPoster,
      formatter: new MarkdownFormatter(),
      contextRetriever: new ContextRetriever(),
      impactAnalyzer: new ImpactAnalyzer(),
      evidenceScorer: new EvidenceScorer(),
      mermaidGenerator: new MermaidGenerator(),
      feedbackFilter: new StubFeedbackFilter() as unknown as FeedbackFilter,
    };

    const orchestrator = new ReviewOrchestrator(components);
    const review = await orchestrator.execute(1);

    expect(review).toBeTruthy();
    expect(review?.findings.length).toBeGreaterThanOrEqual(1); // At least one finding from AST or LLM
    expect(review?.inlineComments.length).toBe(1);
    expect((components.commentPoster as unknown as StubCommentPoster).postedSummary).toBeTruthy();
  });

  it('handles provider failures gracefully', async () => {
    class FailingLLMExecutor {
      async filterHealthyProviders(providers: Provider[]): Promise<{ healthy: Provider[]; healthCheckResults: ProviderResult[] }> {
        // Return providers unchanged to test failure handling
        return { healthy: providers, healthCheckResults: [] };
      }

      async execute(): Promise<ProviderResult[]> {
        return [
          {
            name: 'fake/model',
            status: 'error',
            error: new Error('Provider failed'),
            durationSeconds: 0.1,
          },
        ];
      }
    }

    const components: ReviewComponents = {
      config,
      providerRegistry: new StubProviderRegistry() as any,
      llmExecutor: new FailingLLMExecutor() as any,
      deduplicator: new Deduplicator(),
      consensus: new ConsensusEngine({ minAgreement: 1, minSeverity: 'minor', maxComments: 100 }),
      synthesis: new SynthesisEngine(config),
      testCoverage: new TestCoverageAnalyzer(),
      astAnalyzer: new ASTAnalyzer(),
      cache: new NoopCache(),
      incrementalReviewer: {
        shouldUseIncremental: async () => false,
        getLastReview: async () => null,
        saveReview: async () => {},
        getChangedFilesSince: async () => [],
        mergeFindings: (prev: any, curr: any) => curr,
        generateIncrementalSummary: () => '',
      } as any,
      costTracker: new CostTracker({ getPricing: async () => ({ modelId: 'fake', promptPrice: 0, completionPrice: 0, isFree: true }) } as any),
      security: new SecurityScanner(),
      rules: new RulesEngine([]),
      prLoader: new StubPRLoader() as unknown as PullRequestLoader,
      commentPoster: new StubCommentPoster() as unknown as CommentPoster,
      formatter: new MarkdownFormatter(),
      contextRetriever: new ContextRetriever(),
      impactAnalyzer: new ImpactAnalyzer(),
      evidenceScorer: new EvidenceScorer(),
      mermaidGenerator: new MermaidGenerator(),
      feedbackFilter: new StubFeedbackFilter() as unknown as FeedbackFilter,
    };

    const orchestrator = new ReviewOrchestrator(components);
    const review = await orchestrator.execute(1);

    expect(review).toBeTruthy();
    // Should still have AST/security findings even if LLM fails
    expect(review?.findings.length).toBeGreaterThanOrEqual(1);
  });

  it('uses cached findings when available', async () => {
    const cachedFindings: Finding[] = [
      {
        file: 'src/cached.ts',
        line: 10,
        severity: 'major',
        title: 'Cached issue',
        message: 'From cache',
        providers: ['fake/model'],
      },
    ];

    class CacheWithData extends CacheManager {
      async load(): Promise<Finding[] | null> {
        return cachedFindings;
      }
      async save(): Promise<void> {
        return;
      }
    }

    const components: ReviewComponents = {
      config: { ...config, enableCaching: true },
      providerRegistry: new StubProviderRegistry() as any,
      llmExecutor: new StubLLMExecutor() as any,
      deduplicator: new Deduplicator(),
      consensus: new ConsensusEngine({ minAgreement: 1, minSeverity: 'minor', maxComments: 100 }),
      synthesis: new SynthesisEngine(config),
      testCoverage: new TestCoverageAnalyzer(),
      astAnalyzer: new ASTAnalyzer(),
      cache: new CacheWithData(),
      incrementalReviewer: {
        shouldUseIncremental: async () => false,
        getLastReview: async () => null,
        saveReview: async () => {},
        getChangedFilesSince: async () => [],
        mergeFindings: (prev: any, curr: any) => curr,
        generateIncrementalSummary: () => '',
      } as any,
      costTracker: new CostTracker({ getPricing: async () => ({ modelId: 'fake', promptPrice: 0, completionPrice: 0, isFree: true }) } as any),
      security: new SecurityScanner(),
      rules: new RulesEngine([]),
      prLoader: new StubPRLoader() as unknown as PullRequestLoader,
      commentPoster: new StubCommentPoster() as unknown as CommentPoster,
      formatter: new MarkdownFormatter(),
      contextRetriever: new ContextRetriever(),
      impactAnalyzer: new ImpactAnalyzer(),
      evidenceScorer: new EvidenceScorer(),
      mermaidGenerator: new MermaidGenerator(),
      feedbackFilter: new StubFeedbackFilter() as unknown as FeedbackFilter,
    };

    const orchestrator = new ReviewOrchestrator(components);
    const review = await orchestrator.execute(1);

    expect(review).toBeTruthy();
    expect(review?.findings.some(f => f.file === 'src/cached.ts')).toBe(true);
  });

  it('skips draft PRs when configured', async () => {
    class DraftPRLoader {
      async load(): Promise<PRContext> {
        return {
          number: 1,
          title: 'Draft PR',
          body: '',
          author: 'dev',
          draft: true,
          labels: [],
          files: [],
          diff: '',
          additions: 0,
          deletions: 0,
          baseSha: 'base',
          headSha: 'head',
        };
      }
    }

    const draftConfig: ReviewConfig = {
      ...config,
      skipDrafts: true,
    };

    const components: ReviewComponents = {
      config: draftConfig,
      providerRegistry: new StubProviderRegistry() as any,
      llmExecutor: new StubLLMExecutor() as any,
      deduplicator: new Deduplicator(),
      consensus: new ConsensusEngine({ minAgreement: 1, minSeverity: 'minor', maxComments: 100 }),
      synthesis: new SynthesisEngine(draftConfig),
      testCoverage: new TestCoverageAnalyzer(),
      astAnalyzer: new ASTAnalyzer(),
      cache: new NoopCache(),
      incrementalReviewer: {
        shouldUseIncremental: async () => false,
        getLastReview: async () => null,
        saveReview: async () => {},
        getChangedFilesSince: async () => [],
        mergeFindings: (prev: any, curr: any) => curr,
        generateIncrementalSummary: () => '',
      } as any,
      costTracker: new CostTracker({ getPricing: async () => ({ modelId: 'fake', promptPrice: 0, completionPrice: 0, isFree: true }) } as any),
      security: new SecurityScanner(),
      rules: new RulesEngine([]),
      prLoader: new DraftPRLoader() as unknown as PullRequestLoader,
      commentPoster: new StubCommentPoster() as unknown as CommentPoster,
      formatter: new MarkdownFormatter(),
      contextRetriever: new ContextRetriever(),
      impactAnalyzer: new ImpactAnalyzer(),
      evidenceScorer: new EvidenceScorer(),
      mermaidGenerator: new MermaidGenerator(),
      feedbackFilter: new StubFeedbackFilter() as unknown as FeedbackFilter,
    };

    const orchestrator = new ReviewOrchestrator(components);
    const review = await orchestrator.execute(1);

    expect(review).toBeNull();
  });

  it('applies consensus filtering with multiple providers', async () => {
    class MultiProviderLLMExecutor {
      async filterHealthyProviders(providers: Provider[]): Promise<{ healthy: Provider[]; healthCheckResults: ProviderResult[] }> {
        return { healthy: providers, healthCheckResults: [] };
      }

      async execute(): Promise<ProviderResult[]> {
        return [
          {
            name: 'provider1',
            status: 'success',
            result: {
              content: 'ok',
              findings: [
                { file: 'src/index.ts', line: 15, severity: 'major', title: 'Issue', message: 'Agreed' },
              ],
            },
            durationSeconds: 0.1,
          },
          {
            name: 'provider2',
            status: 'success',
            result: {
              content: 'ok',
              findings: [
                { file: 'src/index.ts', line: 15, severity: 'major', title: 'Issue', message: 'Agreed' },
                { file: 'src/index.ts', line: 20, severity: 'minor', title: 'Noise', message: 'Only one provider' },
              ],
            },
            durationSeconds: 0.1,
          },
        ];
      }
    }

    const consensusConfig: ReviewConfig = {
      ...config,
      inlineMinAgreement: 2, // Require 2 providers to agree
    };

    const components: ReviewComponents = {
      config: consensusConfig,
      providerRegistry: new StubProviderRegistry() as any,
      llmExecutor: new MultiProviderLLMExecutor() as any,
      deduplicator: new Deduplicator(),
      consensus: new ConsensusEngine({ minAgreement: 2, minSeverity: 'minor', maxComments: 100 }),
      synthesis: new SynthesisEngine(consensusConfig),
      testCoverage: new TestCoverageAnalyzer(),
      astAnalyzer: new ASTAnalyzer(),
      cache: new NoopCache(),
      incrementalReviewer: {
        shouldUseIncremental: async () => false,
        getLastReview: async () => null,
        saveReview: async () => {},
        getChangedFilesSince: async () => [],
        mergeFindings: (prev: any, curr: any) => curr,
        generateIncrementalSummary: () => '',
      } as any,
      costTracker: new CostTracker({ getPricing: async () => ({ modelId: 'fake', promptPrice: 0, completionPrice: 0, isFree: true }) } as any),
      security: new SecurityScanner(),
      rules: new RulesEngine([]),
      prLoader: new StubPRLoader() as unknown as PullRequestLoader,
      commentPoster: new StubCommentPoster() as unknown as CommentPoster,
      formatter: new MarkdownFormatter(),
      contextRetriever: new ContextRetriever(),
      impactAnalyzer: new ImpactAnalyzer(),
      evidenceScorer: new EvidenceScorer(),
      mermaidGenerator: new MermaidGenerator(),
      feedbackFilter: new StubFeedbackFilter() as unknown as FeedbackFilter,
    };

    const orchestrator = new ReviewOrchestrator(components);
    const review = await orchestrator.execute(1);

    expect(review).toBeTruthy();
    // Verify consensus filtering: inline comments should be produced
    expect(review?.inlineComments.length).toBeGreaterThan(0);
    // Verify at least one finding was generated
    expect(review?.findings.length).toBeGreaterThan(0);
  });

  it('generates complete review with all outputs', async () => {
    const components: ReviewComponents = {
      config,
      providerRegistry: new StubProviderRegistry() as any,
      llmExecutor: new StubLLMExecutor() as any,
      deduplicator: new Deduplicator(),
      consensus: new ConsensusEngine({ minAgreement: 1, minSeverity: 'minor', maxComments: 100 }),
      synthesis: new SynthesisEngine(config),
      testCoverage: new TestCoverageAnalyzer(),
      astAnalyzer: new ASTAnalyzer(),
      cache: new NoopCache(),
      incrementalReviewer: {
        shouldUseIncremental: async () => false,
        getLastReview: async () => null,
        saveReview: async () => {},
        getChangedFilesSince: async () => [],
        mergeFindings: (prev: any, curr: any) => curr,
        generateIncrementalSummary: () => '',
      } as any,
      costTracker: new CostTracker({ getPricing: async () => ({ modelId: 'fake', promptPrice: 0, completionPrice: 0, isFree: true }) } as any),
      security: new SecurityScanner(),
      rules: new RulesEngine([]),
      prLoader: new StubPRLoader() as unknown as PullRequestLoader,
      commentPoster: new StubCommentPoster() as unknown as CommentPoster,
      formatter: new MarkdownFormatter(),
      contextRetriever: new ContextRetriever(),
      impactAnalyzer: new ImpactAnalyzer(),
      evidenceScorer: new EvidenceScorer(),
      mermaidGenerator: new MermaidGenerator(),
      feedbackFilter: new StubFeedbackFilter() as unknown as FeedbackFilter,
    };

    const orchestrator = new ReviewOrchestrator(components);
    const review = await orchestrator.execute(1);

    expect(review).toBeTruthy();
    expect(review?.findings).toBeDefined();
    expect(review?.inlineComments).toBeDefined();
    expect(review?.providerResults).toBeDefined();
    expect(review?.runDetails).toBeDefined();
    expect(review?.runDetails?.durationSeconds).toBeGreaterThanOrEqual(0);
    expect(review?.runDetails?.totalCost).toBeGreaterThanOrEqual(0);
    expect(review?.metrics).toBeDefined();
    expect(review?.summary).toBeDefined();
  });
});
