import { ReviewOrchestrator, ReviewComponents } from '../../src/core/orchestrator';
import { ReviewConfig, ProviderResult } from '../../src/types';
import { PromptBuilder } from '../../src/analysis/llm/prompt-builder';
import { LLMExecutor } from '../../src/analysis/llm/executor';
import { Deduplicator } from '../../src/analysis/deduplicator';
import { ConsensusEngine } from '../../src/analysis/consensus';
import { SynthesisEngine } from '../../src/analysis/synthesis';
import { TestCoverageAnalyzer } from '../../src/analysis/test-coverage';
import { ASTAnalyzer } from '../../src/analysis/ast/analyzer';
import { CacheManager } from '../../src/cache/manager';
import { CostTracker } from '../../src/cost/tracker';
import { SecurityScanner } from '../../src/security/scanner';
import { RulesEngine } from '../../src/rules/engine';
import { PullRequestLoader } from '../../src/github/pr-loader';
import { CommentPoster } from '../../src/github/comment-poster';
import { MarkdownFormatter } from '../../src/output/formatter';
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
  async review(prompt?: string, timeoutMs?: number): Promise<any> {
    void prompt;
    void timeoutMs;
    return {
      content: 'ok',
      findings: [
        { file: 'src/app.ts', line: 5, severity: 'major', title: 'LLM finding', message: 'llm' },
      ],
    };
  }
}

class StubLLMExecutor extends LLMExecutor {
  constructor() {
    // @ts-expect-error config unused in stub
    super({ providerMaxParallel: 1 });
  }
  async execute(): Promise<ProviderResult[]> {
    const provider = new FakeProvider();
    const result = await provider.review('prompt', 1000);
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

describe('GitHub integration mock (no network)', () => {
  const config: ReviewConfig = {
    providers: ['fake/model'],
    synthesisModel: 'fake/model',
    fallbackProviders: [],
    providerAllowlist: [],
    providerBlocklist: [],
    providerLimit: 0,
    providerRetries: 1,
    providerMaxParallel: 1,
    inlineMaxComments: 2,
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
    dryRun: false,
  };

  it('uses fake octokit client to post summary and inline comments', async () => {
    const fakeOctokit: any = {
      rest: {
        pulls: {
          get: jest.fn().mockResolvedValue({
            data: {
              number: 1,
              title: 'Test PR',
              body: '',
              user: { login: 'dev' },
              draft: false,
              labels: [],
              additions: 2,
              deletions: 0,
              base: { sha: 'base' },
              head: { sha: 'head' },
            },
          }),
          listFiles: jest.fn().mockResolvedValue({
            data: [
              {
                filename: 'src/app.ts',
                status: 'modified',
                additions: 2,
                deletions: 0,
                changes: 2,
                patch: '@@ -1,1 +1,2 @@\n const x = 1;\n+console.log(x);\n',
              },
            ],
          }),
          createReview: jest.fn().mockResolvedValue({}),
        },
        issues: {
          createComment: jest.fn().mockResolvedValue({}),
        },
      },
      request: jest.fn().mockResolvedValue({ data: '@@ diff' }),
    };

    fakeOctokit.issues = fakeOctokit.rest.issues;
    fakeOctokit.pulls = fakeOctokit.rest.pulls;

    const fakeClient = { octokit: fakeOctokit, owner: 'owner', repo: 'repo' } as any;

    const components: ReviewComponents = {
      config,
      providerRegistry: { createProviders: async () => [new FakeProvider()] } as any,
      promptBuilder: new PromptBuilder(config),
      llmExecutor: new StubLLMExecutor() as any,
      deduplicator: new Deduplicator(),
      consensus: new ConsensusEngine({ minAgreement: 1, minSeverity: 'minor', maxComments: 10 }),
      synthesis: new SynthesisEngine(config),
      testCoverage: new TestCoverageAnalyzer(),
      astAnalyzer: new ASTAnalyzer(),
      cache: new CacheManager(),
      costTracker: new CostTracker({ getPricing: async () => ({ modelId: 'fake', promptPrice: 0, completionPrice: 0, isFree: true }) } as any),
      security: new SecurityScanner(),
      rules: new RulesEngine([]),
      prLoader: new PullRequestLoader(fakeClient),
      commentPoster: new CommentPoster(fakeClient),
      formatter: new MarkdownFormatter(),
      contextRetriever: new ContextRetriever(),
      impactAnalyzer: new ImpactAnalyzer(),
      evidenceScorer: new EvidenceScorer(),
      mermaidGenerator: new MermaidGenerator(),
      feedbackFilter: {
        loadSuppressed: async () => new Set(),
        shouldPost: () => true,
      } as unknown as FeedbackFilter,
    };

    const orchestrator = new ReviewOrchestrator(components);
    const review = await orchestrator.execute(1);

    expect(review).toBeTruthy();
    expect(fakeOctokit.issues.createComment).toHaveBeenCalled();
    expect(fakeOctokit.pulls.createReview).toHaveBeenCalled();
  });
});
