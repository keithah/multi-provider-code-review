/**
 * Performance benchmarks for multi-provider code review
 *
 * Run with: npm run benchmark
 *
 * Tracks:
 * - Review time per file size
 * - Cost per review by provider mix
 * - Cache hit rate impact
 * - Provider execution time
 */

import { ReviewOrchestrator, ReviewComponents } from '../../src/core/orchestrator';
import { ReviewConfig, PRContext, Finding, ProviderResult, FileChange, ReviewResult, Review } from '../../src/types';
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
import { Provider } from '../../src/providers/base';
import { ContextRetriever } from '../../src/analysis/context';
import { ImpactAnalyzer } from '../../src/analysis/impact';
import { EvidenceScorer } from '../../src/analysis/evidence';
import { MermaidGenerator } from '../../src/output/mermaid';

interface BenchmarkResult {
  name: string;
  durationMs: number;
  cost: number;
  findingsCount: number;
  filesCount: number;
  linesChanged: number;
  cacheHit: boolean;
}

class MockPricingService {
  cache = new Map();
  cacheExpiry = 0;

  async getPricing() {
    return { modelId: 'mock', promptPrice: 0.001, completionPrice: 0.002, isFree: false };
  }

  async refresh() {
    // No-op for mock
  }
}

/**
 * Mock IncrementalReviewer for benchmarks
 * Always returns false to force full review for accurate benchmarking
 */
class MockIncrementalReviewer {
  async shouldUseIncremental(_pr: PRContext): Promise<boolean> {
    return false; // Always do full review in benchmarks
  }

  async getLastReview(_prNumber: number): Promise<null> {
    return null;
  }

  async saveReview(_pr: PRContext, _review: Review): Promise<void> {
    // No-op for benchmarks
  }

  async getChangedFilesSince(_pr: PRContext, _lastCommit: string): Promise<FileChange[]> {
    return [];
  }
}

class MockProvider extends Provider {
  constructor(name: string, private readonly latencyMs: number) {
    super(name);
  }

  async review(_prompt: string, _timeoutMs: number): Promise<ReviewResult> {
    await new Promise(resolve => setTimeout(resolve, this.latencyMs));
    return {
      content: 'Review complete',
      findings: [
        {
          file: 'src/test.ts',
          line: 10,
          severity: 'major' as const,
          title: 'Issue',
          message: 'Found issue',
          category: 'test',
          evidence: { confidence: 0.8, reasoning: 'mock', badge: 'test' },
        },
      ],
      durationSeconds: this.latencyMs / 1000,
    };
  }
}

class BenchmarkLLMExecutor {
  constructor(private readonly providers: Provider[]) {}

  async execute(): Promise<ProviderResult[]> {
    const results = await Promise.all(
      this.providers.map(async (provider) => {
        const start = Date.now();
        try {
          const result = await provider.review('benchmark prompt', 10000);
          return {
            name: provider.name,
            status: 'success' as const,
            result,
            durationSeconds: (Date.now() - start) / 1000,
          };
        } catch (error) {
          return {
            name: provider.name,
            status: 'error' as const,
            error: error as Error,
            durationSeconds: (Date.now() - start) / 1000,
          };
        }
      })
    );
    return results;
  }
}

class BenchmarkProviderRegistry {
  constructor(private readonly providers: Provider[]) {}
  async createProviders(): Promise<Provider[]> {
    return this.providers;
  }
}

class BenchmarkPRLoader {
  constructor(private readonly context: PRContext) {}
  async load(): Promise<PRContext> {
    return this.context;
  }
}

class NoopCommentPoster {
  async postSummary(): Promise<void> {}
  async postInline(): Promise<void> {}
}

class NoopCache extends CacheManager {
  async load(): Promise<Finding[] | null> {
    return null;
  }
  async save(): Promise<void> {}
}

class CacheWithHit extends CacheManager {
  constructor(private readonly findings: Finding[]) {
    super();
  }
  async load(): Promise<Finding[] | null> {
    return this.findings;
  }
  async save(): Promise<void> {}
}

class NoopFeedbackFilter {
  async loadSuppressed(): Promise<Set<string>> {
    return new Set();
  }
  shouldPost(): boolean {
    return true;
  }
}

function createMockPR(fileCount: number, linesPerFile: number): PRContext {
  const files: FileChange[] = [];

  for (let i = 0; i < fileCount; i++) {
    const filename = `src/file${i}.ts`;
    const patch = generatePatch(linesPerFile);

    files.push({
      filename,
      status: 'modified',
      additions: linesPerFile,
      deletions: 0,
      changes: linesPerFile,
      patch,
    });
  }

  return {
    number: 1,
    title: 'Benchmark PR',
    body: '',
    author: 'benchmarker',
    draft: false,
    labels: [],
    files,
    diff: '',
    additions: fileCount * linesPerFile,
    deletions: 0,
    baseSha: 'base',
    headSha: 'head',
  };
}

function generatePatch(lines: number): string {
  let patch = `@@ -1,1 +1,${lines + 1} @@\n const x = 1;\n`;
  for (let i = 0; i < lines; i++) {
    patch += `+console.log('Line ${i}');\n`;
  }
  return patch;
}

async function runBenchmark(
  name: string,
  providers: Provider[],
  prContext: PRContext,
  cache?: CacheManager
): Promise<BenchmarkResult> {
  const config: ReviewConfig = {
    providers: providers.map(p => p.name),
    synthesisModel: 'mock/model',
    fallbackProviders: [],
    providerAllowlist: [],
    providerBlocklist: [],
    providerLimit: 0,
    providerRetries: 1,
    providerMaxParallel: 5,
    inlineMaxComments: 10,
    inlineMinSeverity: 'minor',
    inlineMinAgreement: 1,
    skipLabels: [],
    skipDrafts: false,
    skipBots: false,
    minChangedLines: 0,
    maxChangedFiles: 0,
    diffMaxBytes: 500000,
    runTimeoutSeconds: 60,
    budgetMaxUsd: 10,
    enableAstAnalysis: true,
    enableSecurity: true,
    enableCaching: !!cache,
    enableTestHints: false,
    enableAiDetection: false,
    incrementalEnabled: false,
    incrementalCacheTtlDays: 7,
    dryRun: false,
  };

  const components: ReviewComponents = {
    config,
    providerRegistry: new BenchmarkProviderRegistry(providers) as unknown as ReviewComponents['providerRegistry'],
    promptBuilder: new PromptBuilder(config),
    llmExecutor: new BenchmarkLLMExecutor(providers) as unknown as ReviewComponents['llmExecutor'],
    deduplicator: new Deduplicator(),
    consensus: new ConsensusEngine({ minAgreement: 1, minSeverity: 'minor', maxComments: 100 }),
    synthesis: new SynthesisEngine(config),
    testCoverage: new TestCoverageAnalyzer(),
    astAnalyzer: new ASTAnalyzer(),
    cache: cache || new NoopCache(),
    costTracker: new CostTracker(new MockPricingService() as any),
    security: new SecurityScanner(),
    rules: new RulesEngine([]),
    prLoader: new BenchmarkPRLoader(prContext) as unknown as ReviewComponents['prLoader'],
    commentPoster: new NoopCommentPoster() as unknown as ReviewComponents['commentPoster'],
    formatter: new MarkdownFormatter(),
    contextRetriever: new ContextRetriever(),
    impactAnalyzer: new ImpactAnalyzer(),
    evidenceScorer: new EvidenceScorer(),
    mermaidGenerator: new MermaidGenerator(),
    feedbackFilter: new NoopFeedbackFilter() as unknown as ReviewComponents['feedbackFilter'],
    incrementalReviewer: new MockIncrementalReviewer() as unknown as ReviewComponents['incrementalReviewer'],
  };

  const orchestrator = new ReviewOrchestrator(components);

  const start = Date.now();
  const review = await orchestrator.execute(1);
  const duration = Date.now() - start;

  return {
    name,
    durationMs: duration,
    cost: review?.runDetails?.totalCost || 0,
    findingsCount: review?.findings.length || 0,
    filesCount: prContext.files.length,
    linesChanged: prContext.additions,
    cacheHit: review?.runDetails?.cacheHit || false,
  };
}

function formatResults(results: BenchmarkResult[]): string {
  let output = '\n' + '='.repeat(80) + '\n';
  output += '  PERFORMANCE BENCHMARK RESULTS\n';
  output += '='.repeat(80) + '\n\n';

  for (const result of results) {
    output += `${result.name}\n`;
    output += `  Duration:     ${result.durationMs.toFixed(0)}ms\n`;
    output += `  Cost:         $${result.cost.toFixed(6)}\n`;
    output += `  Findings:     ${result.findingsCount}\n`;
    output += `  Files:        ${result.filesCount}\n`;
    output += `  Lines:        ${result.linesChanged}\n`;
    output += `  Cache Hit:    ${result.cacheHit ? 'Yes' : 'No'}\n`;
    output += `  Per File:     ${(result.durationMs / result.filesCount).toFixed(0)}ms\n`;
    output += `  Per Line:     ${(result.durationMs / result.linesChanged).toFixed(2)}ms\n`;
    output += '\n';
  }

  output += '='.repeat(80) + '\n';
  return output;
}

describe('Performance Benchmarks', () => {
  // Increase timeout for CI environments where benchmarks may run slower
  jest.setTimeout(300000); // 5 minute timeout for benchmarks

  it('benchmarks small PR (5 files, 100 lines)', async () => {
    const providers = [new MockProvider('fast-provider', 50)];
    const pr = createMockPR(5, 20); // 5 files, 20 lines each = 100 total

    const result = await runBenchmark('Small PR (5 files, 100 lines)', providers, pr);

    expect(result.durationMs).toBeLessThan(10000); // Should complete in <10s
    expect(result.findingsCount).toBeGreaterThan(0);

    console.log(formatResults([result]));
  });

  it('benchmarks medium PR (20 files, 500 lines)', async () => {
    const providers = [new MockProvider('fast-provider', 50)];
    const pr = createMockPR(20, 25); // 20 files, 25 lines each = 500 total

    const result = await runBenchmark('Medium PR (20 files, 500 lines)', providers, pr);

    expect(result.durationMs).toBeLessThan(30000); // Should complete in <30s
    expect(result.findingsCount).toBeGreaterThan(0);

    console.log(formatResults([result]));
  });

  it('benchmarks large PR (100 files, 2000 lines)', async () => {
    const providers = [new MockProvider('fast-provider', 50)];
    const pr = createMockPR(100, 20); // 100 files, 20 lines each = 2000 total

    const result = await runBenchmark('Large PR (100 files, 2000 lines)', providers, pr);

    expect(result.durationMs).toBeLessThan(90000); // Should complete in <90s
    expect(result.findingsCount).toBeGreaterThan(0);

    console.log(formatResults([result]));
  });

  it('benchmarks parallel provider execution', async () => {
    const providers = [
      new MockProvider('provider-1', 100),
      new MockProvider('provider-2', 100),
      new MockProvider('provider-3', 100),
    ];
    const pr = createMockPR(10, 10); // 10 files, 100 lines

    const result = await runBenchmark('Parallel Providers (3 providers)', providers, pr);

    // With parallel execution, should be closer to 100ms than 300ms
    expect(result.durationMs).toBeLessThan(5000);

    console.log(formatResults([result]));
  });

  it('benchmarks cache hit performance', async () => {
    const providers = [new MockProvider('provider', 50)];
    const pr = createMockPR(20, 25); // 20 files, 500 lines

    // Run without cache
    const noCacheResult = await runBenchmark('No Cache (20 files)', providers, pr);

    // Run with cache hit
    const cachedFindings: Finding[] = [
      { file: 'src/cached.ts', line: 1, severity: 'major', title: 'Cached', message: 'From cache' },
    ];
    const cache = new CacheWithHit(cachedFindings);
    const cacheResult = await runBenchmark('With Cache (20 files)', providers, pr, cache);

    expect(cacheResult.cacheHit).toBe(true);
    expect(cacheResult.durationMs).toBeLessThan(noCacheResult.durationMs);

    const speedup = ((noCacheResult.durationMs - cacheResult.durationMs) / noCacheResult.durationMs * 100).toFixed(1);

    console.log(formatResults([noCacheResult, cacheResult]));
    console.log(`Cache speedup: ${speedup}%\n`);
  });

  it('benchmarks cost per review by provider count', async () => {
    const pr = createMockPR(10, 10); // Small PR for cost comparison

    const results: BenchmarkResult[] = [];

    // 1 provider
    const oneProvider = [new MockProvider('provider-1', 50)];
    results.push(await runBenchmark('1 Provider', oneProvider, pr));

    // 3 providers
    const threeProviders = [
      new MockProvider('provider-1', 50),
      new MockProvider('provider-2', 50),
      new MockProvider('provider-3', 50),
    ];
    results.push(await runBenchmark('3 Providers', threeProviders, pr));

    // 5 providers
    const fiveProviders = [
      new MockProvider('provider-1', 50),
      new MockProvider('provider-2', 50),
      new MockProvider('provider-3', 50),
      new MockProvider('provider-4', 50),
      new MockProvider('provider-5', 50),
    ];
    results.push(await runBenchmark('5 Providers', fiveProviders, pr));

    console.log(formatResults(results));

    // Verify duration is reasonable for all provider counts
    expect(results[0].durationMs).toBeGreaterThan(0);
    expect(results[1].durationMs).toBeGreaterThan(0);
    expect(results[2].durationMs).toBeGreaterThan(0);

    // With parallel execution, adding more providers shouldn't linearly increase duration
    expect(results[2].durationMs).toBeLessThan(results[0].durationMs * 5);
  });
});
