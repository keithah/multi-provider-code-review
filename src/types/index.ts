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
