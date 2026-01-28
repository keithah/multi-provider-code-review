/**
 * Core type definitions for the multi-provider code review action.
 */

export type Severity = 'critical' | 'major' | 'minor';

export interface ReviewConfig {
  providers: string[];
  synthesisModel: string;
  fallbackProviders: string[];
  providerAllowlist: string[];
  providerBlocklist: string[];
  providerLimit: number;
  providerRetries: number;
  providerMaxParallel: number;
  openrouterAllowPaid?: boolean;
  quietModeEnabled?: boolean;
  quietMinConfidence?: number;
  quietUseLearning?: boolean;
  learningEnabled?: boolean;
  learningMinFeedbackCount?: number;
  learningLookbackDays?: number;

  inlineMaxComments: number;
  inlineMinSeverity: Severity;
  inlineMinAgreement: number;

  skipLabels: string[];
  skipDrafts: boolean;
  skipBots: boolean;
  minChangedLines: number;
  maxChangedFiles: number;

  diffMaxBytes: number;
  runTimeoutSeconds: number;

  budgetMaxUsd: number;

  enableAstAnalysis: boolean;
  enableSecurity: boolean;
  enableCaching: boolean;
  enableTestHints: boolean;
  enableAiDetection: boolean;

  incrementalEnabled: boolean;
  incrementalCacheTtlDays: number;

  batchMaxFiles?: number;
  providerBatchOverrides?: Record<string, number>;
  enableTokenAwareBatching?: boolean;
  targetTokensPerBatch?: number;

  graphEnabled?: boolean;
  graphCacheEnabled?: boolean;
  graphMaxDepth?: number;
  graphTimeoutSeconds?: number;

  generateFixPrompts?: boolean;
  fixPromptFormat?: string;

  analyticsEnabled?: boolean;
  analyticsMaxReviews?: number;
  analyticsDeveloperRate?: number;
  analyticsManualReviewTime?: number;

  pluginsEnabled?: boolean;
  pluginDir?: string;
  pluginAllowlist?: string[];
  pluginBlocklist?: string[];

  skipTrivialChanges?: boolean;
  skipDependencyUpdates?: boolean;
  skipDocumentationOnly?: boolean;
  skipFormattingOnly?: boolean;
  skipTestFixtures?: boolean;
  skipConfigFiles?: boolean;
  skipBuildArtifacts?: boolean;
  trivialPatterns?: string[];

  pathBasedIntensity?: boolean;
  pathIntensityPatterns?: string; // JSON string of PathPattern[]
  pathDefaultIntensity?: 'thorough' | 'standard' | 'light';

  // Provider selection strategy
  providerSelectionStrategy?: 'reliability' | 'random' | 'round-robin';
  providerExplorationRate?: number;  // 0.0-1.0, default 0.3 (30% exploration)

  // Intensity behavior mappings
  intensityProviderCounts?: {
    thorough: number;
    standard: number;
    light: number;
  };
  intensityTimeouts?: {
    thorough: number;
    standard: number;
    light: number;
  };
  intensityPromptDepth?: {
    thorough: 'detailed' | 'standard' | 'brief';
    standard: 'detailed' | 'standard' | 'brief';
    light: 'detailed' | 'standard' | 'brief';
  };

  dryRun: boolean;
}

export interface TokenUsage {
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
}

export interface ReviewResult {
  content: string;
  usage?: TokenUsage;
  durationSeconds?: number;
  findings?: Finding[];
  aiLikelihood?: number;
  aiReasoning?: string;
}

export interface ProviderResult {
  name: string;
  status: 'success' | 'error' | 'timeout' | 'rate-limited';
  result?: ReviewResult;
  error?: Error;
  durationSeconds: number;
}

export interface Finding {
  file: string;
  line: number;
  severity: Severity;
  title: string;
  message: string;
  suggestion?: string;
  provider?: string;
  providers?: string[];
  confidence?: number;
  category?: string;
  evidence?: EvidenceScore;
  evidenceDetail?: EvidenceDetail;
}

export interface PRContext {
  number: number;
  title: string;
  body: string;
  author: string;
  draft: boolean;
  labels: string[];
  files: FileChange[];
  diff: string;
  additions: number;
  deletions: number;
  baseSha: string;
  headSha: string;
}

export interface FileChange {
  filename: string;
  status: 'added' | 'modified' | 'removed' | 'renamed';
  additions: number;
  deletions: number;
  changes: number;
  patch?: string;
  previousFilename?: string;
  language?: string;
}

export interface InlineComment {
  path: string;
  line: number;
  side: 'LEFT' | 'RIGHT';
  body: string;
}

export interface ReviewMetrics {
  totalFindings: number;
  critical: number;
  major: number;
  minor: number;
  providersUsed: number;
  providersSuccess: number;
  providersFailed: number;
  totalTokens: number;
  totalCost: number;
  durationSeconds: number;
  cached?: boolean;
}

export interface TestCoverageHint {
  file: string;
  suggestedTestFile: string;
  testPattern: string;
}

export interface AIAnalysis {
  averageLikelihood: number;
  providerEstimates: Record<string, number>;
  consensus: string;
}

export interface Review {
  summary: string;
  findings: Finding[];
  inlineComments: InlineComment[];
  actionItems: string[];
  metrics: ReviewMetrics;
  testHints?: TestCoverageHint[];
  aiAnalysis?: AIAnalysis;
  providerResults?: ProviderResult[];
  runDetails?: RunDetails;
  impactAnalysis?: ImpactAnalysis;
  mermaidDiagram?: string;
}

export interface CostEstimate {
  totalCost: number;
  breakdown: Record<string, number>;
  estimatedTokens: number;
}

export interface CostSummary {
  totalCost: number;
  breakdown: Record<string, number>;
  totalTokens: number;
}

export interface ProviderRunInfo {
  name: string;
  status: ProviderResult['status'];
  durationSeconds: number;
  cost?: number;
  tokens?: number;
  errorMessage?: string;
}

export interface RunDetails {
  providers: ProviderRunInfo[];
  totalCost: number;
  totalTokens: number;
  durationSeconds: number;
  cacheHit: boolean;
  synthesisModel: string;
  providerPoolSize: number;
}

export interface ImpactAnalysis {
  file: string;
  totalAffected: number;
  callers: CodeSnippet[];
  consumers: CodeSnippet[];
  derived: CodeSnippet[];
  dependencies?: CodeSnippet[];
  impactLevel: 'critical' | 'high' | 'medium' | 'low';
  summary: string;
}

export interface EvidenceScore {
  confidence: number; // 0-1
  reasoning: string;
  badge: string;
}

export interface SARIFReport {
  version: '2.1.0';
  $schema: string;
  runs: SARIFRun[];
}

export interface SARIFRun {
  tool: {
    driver: {
      name: string;
      version: string;
      informationUri: string;
      rules: SARIFRule[];
    };
  };
  results: SARIFResult[];
}

export interface SARIFRule {
  id: string;
  shortDescription: { text: string };
  fullDescription: { text: string };
  defaultConfiguration: {
    level: 'error' | 'warning' | 'note';
  };
}

export interface SARIFResult {
  ruleId: string;
  level: 'error' | 'warning' | 'note';
  message: { text: string };
  locations: Array<{
    physicalLocation: {
      artifactLocation: { uri: string };
      region: {
        startLine: number;
        endLine?: number;
        startColumn?: number;
        endColumn?: number;
      };
    };
  }>;
}

export interface CodeSnippet {
  filename: string;
  startLine: number;
  endLine: number;
  code: string;
}

export interface EvidenceDetail {
  changedLines: number[];
  relatedSnippets: CodeSnippet[];
  providerAgreement: number;
  astConfirmed: boolean;
  graphConfirmed: boolean;
}

export interface UnchangedContext {
  file: string;
  relationship: 'caller' | 'consumer' | 'derived' | 'dependency';
  affectedCode: CodeSnippet[];
  impactLevel: ImpactAnalysis['impactLevel'];
  downstreamConsumers: string[];
}

export interface Definition {
  name: string;
  type: 'function' | 'class' | 'variable' | 'interface';
  file: string;
  line: number;
}

export interface CodeGraph {
  definitions: Map<string, Definition>;
  calls: Map<string, string[]>;
  imports: Map<string, string[]>;
  inherits: Map<string, string[]>;
  findCallers(symbol: string): CodeSnippet[];
  findCallees(symbol: string): CodeSnippet[];
  findConsumers(module: string): CodeSnippet[];
  findDerivedClasses(className: string): CodeSnippet[];
  findDependencies(file: string): CodeSnippet[];
  findImpactRadius(file: string): ImpactAnalysis;
}

export type ReviewIntensity = 'thorough' | 'standard' | 'light';
