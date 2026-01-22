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
import { PromptBuilder } from '../../src/analysis/llm/prompt-builder';
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
  };

  it('merges AST/security/static with LLM findings and respects inline limit only for inline comments', async () => {
    const components: ReviewComponents = {
      config,
      providerRegistry: new StubProviderRegistry() as any,
      promptBuilder: new PromptBuilder(config),
      llmExecutor: new StubLLMExecutor() as any,
      deduplicator: new Deduplicator(),
      consensus: new ConsensusEngine({ minAgreement: 1, minSeverity: 'minor', maxComments: 100 }),
      synthesis: new SynthesisEngine(config),
      testCoverage: new TestCoverageAnalyzer(),
      astAnalyzer: new ASTAnalyzer(),
      cache: new NoopCache(),
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
    expect(review?.findings.length).toBeGreaterThanOrEqual(2); // AST + LLM at minimum
    expect(review?.inlineComments.length).toBe(1);
    expect((components.commentPoster as unknown as StubCommentPoster).postedSummary).toBeTruthy();
  });
});
