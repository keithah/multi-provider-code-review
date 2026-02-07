import { ReviewOrchestrator, ReviewComponents } from '../../../src/core/orchestrator';
import { ReviewConfig, PRContext, Finding, FileChange, ProviderResult } from '../../../src/types';
import { Provider } from '../../../src/providers/base';
import { DEFAULT_CONFIG } from '../../../src/config/defaults';

// Minimal helpers
const emptyReview: any = {
  summary: '',
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
    durationSeconds: 0,
  },
  runDetails: {
    providers: [],
    totalCost: 0,
    totalTokens: 0,
    durationSeconds: 0,
    cacheHit: false,
    synthesisModel: '',
    providerPoolSize: 0,
  },
};

function makeOrchestrator(overrides: Partial<ReviewComponents & { config: ReviewConfig }>) {
  const providers: Provider[] = [{
    name: 'p1',
    review: jest.fn(),
    healthCheck: jest.fn(),
  } as unknown as Provider];

  const config: ReviewConfig = {
    ...DEFAULT_CONFIG,
    dryRun: true,
    enableCaching: false,
    analyticsEnabled: false,
    graphEnabled: false,
    providers: [],
    fallbackProviders: [],
    providerLimit: 4,
  };

  const components: ReviewComponents = {
    config,
    providerRegistry: {
      createProviders: jest.fn().mockResolvedValue(providers),
      discoverAdditionalFreeProviders: jest.fn().mockResolvedValue([]),
    } as any,
    llmExecutor: {
      filterHealthyProviders: jest.fn(),
      execute: jest.fn(() => { throw new Error('execute should not be called when no healthy providers'); }),
    } as any,
    deduplicator: { dedupe: (f: Finding[]) => f } as any,
    consensus: { filter: (f: Finding[]) => f } as any,
    synthesis: { synthesize: jest.fn().mockReturnValue(emptyReview) } as any,
    testCoverage: { analyze: jest.fn().mockReturnValue(undefined) } as any,
    astAnalyzer: { analyze: jest.fn().mockReturnValue([]) } as any,
    cache: { load: jest.fn().mockResolvedValue(null), save: jest.fn() } as any,
    incrementalReviewer: {
      shouldUseIncremental: jest.fn().mockResolvedValue(false),
      getLastReview: jest.fn(),
      mergeFindings: jest.fn(),
      generateIncrementalSummary: jest.fn(),
      saveReview: jest.fn(),
      getChangedFilesSince: jest.fn(),
    } as any,
    costTracker: { record: jest.fn(), summary: jest.fn().mockReturnValue({ totalCost: 0, totalTokens: 0, breakdown: {} }), reset: jest.fn() } as any,
    security: { scan: jest.fn().mockReturnValue([]) } as any,
    rules: { run: jest.fn().mockReturnValue([]) } as any,
    prLoader: { load: jest.fn() } as any,
    commentPoster: { postSummary: jest.fn(), postInline: jest.fn() } as any,
    formatter: { format: jest.fn().mockReturnValue('') } as any,
    contextRetriever: { findRelatedContext: jest.fn().mockReturnValue([]) } as any,
    impactAnalyzer: { analyze: jest.fn().mockReturnValue([]) } as any,
    evidenceScorer: { score: jest.fn().mockReturnValue({ confidence: 1 }) } as any,
    mermaidGenerator: { generateImpactDiagram: jest.fn().mockReturnValue('') } as any,
    feedbackFilter: { loadSuppressed: jest.fn().mockResolvedValue([]), shouldPost: jest.fn().mockReturnValue(true) } as any,
    reliabilityTracker: {
      isCircuitOpen: jest.fn().mockResolvedValue(false),
      rankProviders: jest.fn().mockResolvedValue([]),
      recordResult: jest.fn(),
    } as any,
    promptGenerator: { generateFixPrompts: jest.fn().mockReturnValue([]), saveToFile: jest.fn() } as any,
    quietModeFilter: undefined,
    graphBuilder: undefined,
    feedbackTracker: undefined,
    metricsCollector: undefined,
    batchOrchestrator: undefined,
    githubClient: undefined,
  } as any;

  Object.assign(components, overrides);
  return new ReviewOrchestrator(components);
}

function makePR(files: FileChange[]): PRContext {
  return {
    number: 1,
    title: 't',
    author: 'a',
    draft: false,
    labels: [],
    additions: 0,
    deletions: 0,
    files,
    diff: '',
    baseSha: 'b',
    headSha: 'h',
    body: '',
  };
}

describe('ReviewOrchestrator health check guard rails', () => {
  it('short-circuits LLM execution when no healthy providers and records reliability', async () => {
    const healthResults: ProviderResult[] = [{ name: 'p1', status: 'timeout', durationSeconds: 0 } as any];

    const orchestrator = makeOrchestrator({
      llmExecutor: {
        filterHealthyProviders: jest.fn().mockResolvedValue({ healthy: [], healthCheckResults: healthResults }),
        execute: jest.fn(),
      } as any,
    });

    const pr = makePR([{ filename: 'a.ts', status: 'modified', additions: 1, deletions: 0, changes: 1 }]);

    const review = await orchestrator.executeReview(pr);

    expect(review).toBeTruthy();
    expect((orchestrator as any).components.llmExecutor.execute).not.toHaveBeenCalled();
    expect((orchestrator as any).components.reliabilityTracker.recordResult).toHaveBeenCalledWith('p1', false, 0, undefined);
  });
});
