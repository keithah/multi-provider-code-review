# Multi-Provider Code Review - Complete Implementation Guide
## The Single Source of Truth for TypeScript Rewrite

**Version**: 2.0  
**Date**: 2026-01-21  
**Purpose**: Complete specification for building best-in-class multi-provider code review tool

---

## Table of Contents

1. [Executive Summary](#executive-summary)
2. [Complete Feature List](#complete-feature-list)
3. [Technology Stack](#technology-stack)
4. [Project Structure](#project-structure)
5. [Core Module Specifications](#core-module-specifications)
6. [Implementation Roadmap](#implementation-roadmap)
7. [Testing Requirements](#testing-requirements)
8. [Deployment Guide](#deployment-guide)

---

## Executive Summary

### What We're Building

**The world's best open-source multi-provider code review tool** combining:
- ✨ **Ensemble AI** - Multiple providers with consensus voting (unique advantage)
- 🎯 **Hybrid Analysis** - AST + LLM for maximum accuracy
- 💰 **Cost Optimization** - Smart caching, budget controls, free-tier focus
- 🔧 **Team Customization** - Custom rules, hierarchical config
- 🚀 **Performance** - Incremental analysis, parallel execution, smart caching
- 🔒 **Security-First** - SAST, secrets detection, OWASP patterns
- 📊 **Full Observability** - Cost tracking, AI detection, SARIF export

### Core Differentiators

```
No competitor offers ALL of these:
✓ Multi-provider synthesis (3-7 providers → 1 review)
✓ Consensus-based inline comments (only post when N providers agree)
✓ Hybrid AST + LLM analysis (fast + accurate)
✓ Built-in cost optimization (free-tier, caching, budget guards)
✓ MIT license (truly open source)
```

### Success Criteria

After implementation, the tool must:
- ✅ Review a typical PR in <30 seconds
- ✅ Cost <$0.01 per review (with caching: <$0.002)
- ✅ Achieve <10% false positive rate (vs ~30% current)
- ✅ Support 30+ programming languages
- ✅ Have >80% test coverage
- ✅ Pass GitHub Marketplace quality bar

---

## Complete Feature List

### ✅ Core Features (Must Have - Week 1-6)

| # | Feature | Source | Priority | Week |
|---|---------|--------|----------|------|
| 1 | **Multi-provider execution** | Current + Enhanced | P0 | 2-3 |
| 2 | **Synthesis engine** | Current + Enhanced | P0 | 3 |
| 3 | **Consensus inline comments** | Current + Enhanced | P0 | 3 |
| 4 | **YAML configuration** | Current + Enhanced | P0 | 1 |
| 5 | **Parallel execution** | Current + Enhanced | P0 | 2 |
| 6 | **Retry logic** | Current + Enhanced | P0 | 2 |
| 7 | **GitHub API integration** | Current + Enhanced | P0 | 4 |
| 8 | **SARIF export** | Current + Enhanced | P0 | 4 |
| 9 | **JSON reports** | Current + Enhanced | P0 | 4 |
| 10 | **Chunked comment posting** | PR #2 | P0 | 4 |
| 11 | **Skip filters** | PR #2 | P0 | 1 |
| 12 | **Cost tracking** | Current + PR #2 | P0 | 5 |
| 13 | **Rate limit tracking** | PR #2 | P0 | 5 |
| 14 | **OpenRouter pricing API** | PR #2 | P0 | 5 |
| 15 | **Budget guards** | PR #2 | P0 | 5 |

### 🆕 Advanced Features (Should Have - Week 7-10)

| # | Feature | Source | Priority | Week |
|---|---------|--------|----------|------|
| 16 | **AST analysis** | Kodus-inspired | P1 | 7 |
| 17 | **Smart caching** | CodeRabbit-inspired | P1 | 8 |
| 18 | **Incremental analysis** | CodeRabbit-inspired | P1 | 8 |
| 19 | **Diff compression** | PR-Agent-inspired | P1 | 8 |
| 20 | **Custom rules engine** | New | P1 | 9 |
| 21 | **Security scanning** | Semgrep-inspired | P1 | 9 |
| 22 | **AI code detection** | PR #2 | P1 | 10 |
| 23 | **Test coverage hints** | PR #2 | P1 | 10 |
| 24 | **Provider rotation** | PR #2 | P2 | 10 |

### 🚀 Future Features (Nice to Have - Post v2.0)

| # | Feature | Source | Priority | Week |
|---|---------|--------|----------|------|
| 25 | **Hierarchical config** | PR-Agent-inspired | P2 | Future |
| 26 | **CLI mode** | New | P2 | Future |
| 27 | **GitHub App mode** | New | P2 | Future |
| 28 | **Webhook support** | New | P3 | Future |
| 29 | **Context learning** | CodeRabbit-inspired | P3 | Future |
| 30 | **Tech debt tracking** | Kodus-inspired | P3 | Future |

---

## Technology Stack

### Core Runtime
```json
{
  "runtime": "Node.js 20+",
  "language": "TypeScript 5.3+",
  "buildTool": "esbuild (fast, single bundle)",
  "packageManager": "npm"
}
```

### Required Dependencies
```json
{
  "dependencies": {
    "@actions/core": "^1.10.1",
    "@actions/github": "^6.0.0",
    "@octokit/rest": "^20.0.2",
    "@actions/cache": "^3.2.4",
    "js-yaml": "^4.1.0",
    "zod": "^3.22.4",
    "tree-sitter": "^0.21.0",
    "tree-sitter-typescript": "^0.21.0",
    "tree-sitter-python": "^0.21.0",
    "p-queue": "^8.0.1",
    "p-retry": "^6.2.0"
  },
  "devDependencies": {
    "typescript": "^5.3.3",
    "@types/node": "^20.10.0",
    "@types/js-yaml": "^4.0.9",
    "esbuild": "^0.19.11",
    "jest": "^29.7.0",
    "@types/jest": "^29.5.11",
    "ts-jest": "^29.1.1",
    "eslint": "^8.56.0",
    "@typescript-eslint/parser": "^6.18.1",
    "@typescript-eslint/eslint-plugin": "^6.18.1",
    "prettier": "^3.1.1"
  }
}
```

---

## Project Structure

```
multi-provider-review/
├── src/
│   ├── main.ts                          # Entry point
│   │
│   ├── core/
│   │   ├── orchestrator.ts              # Main workflow coordinator
│   │   └── pipeline.ts                  # Analysis pipeline
│   │
│   ├── config/
│   │   ├── loader.ts                    # Config from file/env
│   │   ├── schema.ts                    # Zod validation schemas
│   │   └── defaults.ts                  # Default values
│   │
│   ├── providers/
│   │   ├── base.ts                      # Provider interface
│   │   ├── registry.ts                  # Provider factory
│   │   ├── openrouter.ts                # OpenRouter implementation
│   │   ├── opencode.ts                  # OpenCode CLI wrapper
│   │   └── rate-limiter.ts              # Rate limit tracking
│   │
│   ├── analysis/
│   │   ├── ast/
│   │   │   ├── analyzer.ts              # AST coordinator
│   │   │   ├── parsers.ts               # Tree-sitter parsers
│   │   │   └── patterns.ts              # Pattern detection
│   │   ├── llm/
│   │   │   ├── executor.ts              # Multi-provider execution
│   │   │   ├── prompt-builder.ts        # Prompt construction
│   │   │   └── parser.ts                # Parse LLM responses
│   │   ├── synthesis.ts                 # Merge findings
│   │   ├── consensus.ts                 # Voting logic
│   │   ├── deduplicator.ts              # Remove duplicates
│   │   ├── ai-detector.ts               # AI code detection
│   │   └── test-coverage.ts             # Test hints
│   │
│   ├── rules/
│   │   ├── engine.ts                    # Rules executor
│   │   ├── loader.ts                    # Load from config
│   │   ├── pattern.ts                   # AST patterns
│   │   └── builtin/                     # Built-in rules
│   │       ├── security.ts
│   │       ├── performance.ts
│   │       └── style.ts
│   │
│   ├── cache/
│   │   ├── manager.ts                   # Cache coordinator
│   │   ├── storage.ts                   # GitHub Cache API
│   │   └── key-builder.ts               # Cache keys
│   │
│   ├── cost/
│   │   ├── pricing.ts                   # OpenRouter pricing API
│   │   ├── estimator.ts                 # Cost estimation
│   │   └── tracker.ts                   # Usage tracking
│   │
│   ├── security/
│   │   ├── scanner.ts                   # Security coordinator
│   │   ├── secrets.ts                   # Secret detection
│   │   └── owasp.ts                     # OWASP patterns
│   │
│   ├── github/
│   │   ├── client.ts                    # GitHub API wrapper
│   │   ├── pr-loader.ts                 # Load PR context
│   │   └── comment-poster.ts            # Post with chunking
│   │
│   ├── output/
│   │   ├── formatter.ts                 # Format output
│   │   ├── markdown.ts                  # Markdown generation
│   │   ├── sarif.ts                     # SARIF generation
│   │   └── json.ts                      # JSON reports
│   │
│   ├── utils/
│   │   ├── retry.ts                     # Retry with backoff
│   │   ├── timeout.ts                   # Timeout wrapper
│   │   ├── logger.ts                    # Structured logging
│   │   └── diff.ts                      # Diff compression
│   │
│   └── types/
│       ├── index.ts                     # Core types
│       ├── config.ts                    # Config types
│       ├── providers.ts                 # Provider types
│       └── findings.ts                  # Finding types
│
├── __tests__/
│   ├── unit/                            # Unit tests
│   ├── integration/                     # Integration tests
│   └── fixtures/                        # Test data
│
├── action.yml                           # GitHub Action def
├── package.json
├── tsconfig.json
├── jest.config.js
└── README.md
```

---

## Core Module Specifications

### 1. Main Entry Point

**File**: `src/main.ts`

```typescript
import * as core from '@actions/core';
import { ReviewOrchestrator } from './core/orchestrator';
import { ConfigLoader } from './config/loader';
import { createComponents } from './di-container';

async function run(): Promise<void> {
  try {
    // Load configuration
    const config = ConfigLoader.load();
    core.info(`Loaded config: ${config.providers.length} providers`);
    
    // Create all components
    const components = await createComponents(config);
    
    // Create orchestrator
    const orchestrator = new ReviewOrchestrator(components);
    
    // Get PR number from context
    const prNumber = parseInt(core.getInput('PR_NUMBER') || 
                              process.env.PR_NUMBER || 
                              '0', 10);
    
    if (!prNumber) {
      throw new Error('PR_NUMBER not provided');
    }
    
    // Execute review
    core.info(`Starting review for PR #${prNumber}`);
    const result = await orchestrator.execute(prNumber);
    
    if (!result) {
      core.info('Review skipped');
      return;
    }
    
    // Set outputs
    core.setOutput('findings_count', result.findings.length);
    core.setOutput('critical_count', result.metrics.critical);
    core.setOutput('cost_usd', result.metrics.totalCost.toFixed(4));
    
    core.info('✅ Review completed successfully');
  } catch (error) {
    core.setFailed(`Review failed: ${(error as Error).message}`);
    throw error;
  }
}

run();
```

---

### 2. Type Definitions

**File**: `src/types/index.ts`

```typescript
/**
 * Core types for multi-provider code review
 */

// Configuration
export interface ReviewConfig {
  // Providers
  providers: string[];
  synthesisModel: string;
  fallbackProviders: string[];
  providerAllowlist: string[];
  providerBlocklist: string[];
  providerLimit: number;
  providerRetries: number;
  providerMaxParallel: number;
  
  // Inline comments
  inlineMaxComments: number;
  inlineMinSeverity: 'critical' | 'major' | 'minor';
  inlineMinAgreement: number;
  
  // Skip filters
  skipLabels: string[];
  skipDrafts: boolean;
  skipBots: boolean;
  minChangedLines: number;
  maxChangedFiles: number;
  
  // Performance
  diffMaxBytes: number;
  runTimeoutSeconds: number;
  
  // Cost
  budgetMaxUsd: number;
  
  // Features
  enableAstAnalysis: boolean;
  enableSecurity: boolean;
  enableCaching: boolean;
  enableTestHints: boolean;
  enableAiDetection: boolean;
}

// Provider results
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

// Findings
export type Severity = 'critical' | 'major' | 'minor';

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

// PR Context
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
}

// Output
export interface InlineComment {
  path: string;
  line: number;
  side: 'LEFT' | 'RIGHT';
  body: string;
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

// Cost tracking
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

// SARIF
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
```

---

### 3. Configuration System

**File**: `src/config/schema.ts`

```typescript
import { z } from 'zod';

export const ReviewConfigSchema = z.object({
  // Providers
  providers: z.array(z.string()).optional(),
  synthesis_model: z.string().optional(),
  fallback_providers: z.array(z.string()).optional(),
  provider_allowlist: z.array(z.string()).optional(),
  provider_blocklist: z.array(z.string()).optional(),
  provider_limit: z.number().int().min(0).optional(),
  provider_retries: z.number().int().min(1).optional(),
  provider_max_parallel: z.number().int().min(1).optional(),
  
  // Inline comments
  inline_max_comments: z.number().int().min(0).optional(),
  inline_min_severity: z.enum(['critical', 'major', 'minor']).optional(),
  inline_min_agreement: z.number().int().min(1).optional(),
  
  // Skip filters
  skip_labels: z.array(z.string()).optional(),
  skip_drafts: z.boolean().optional(),
  skip_bots: z.boolean().optional(),
  min_changed_lines: z.number().int().min(0).optional(),
  max_changed_files: z.number().int().min(0).optional(),
  
  // Performance
  diff_max_bytes: z.number().int().min(0).optional(),
  run_timeout_seconds: z.number().int().min(1).optional(),
  
  // Cost
  budget_max_usd: z.number().min(0).optional(),
  
  // Features
  enable_ast_analysis: z.boolean().optional(),
  enable_security: z.boolean().optional(),
  enable_caching: z.boolean().optional(),
  enable_test_hints: z.boolean().optional(),
  enable_ai_detection: z.boolean().optional(),
});

export type ReviewConfigFile = z.infer<typeof ReviewConfigSchema>;
```

**File**: `src/config/loader.ts`

```typescript
import * as fs from 'fs';
import * as path from 'path';
import * as yaml from 'js-yaml';
import { ReviewConfig } from '../types';
import { ReviewConfigSchema, ReviewConfigFile } from './schema';
import { DEFAULT_CONFIG } from './defaults';

export class ConfigLoader {
  private static readonly CONFIG_PATHS = [
    '.github/multi-review.yml',
    '.github/multi-review.yaml',
    '.multi-review.yml',
    '.multi-review.yaml',
  ];
  
  static load(): ReviewConfig {
    const fileConfig = this.loadFromFile();
    const envConfig = this.loadFromEnv();
    
    return this.merge(DEFAULT_CONFIG, fileConfig, envConfig);
  }
  
  private static loadFromFile(): Partial<ReviewConfig> {
    // Try each config path
    for (const configPath of this.CONFIG_PATHS) {
      const fullPath = path.join(process.cwd(), configPath);
      
      if (fs.existsSync(fullPath)) {
        try {
          const content = fs.readFileSync(fullPath, 'utf8');
          const data = yaml.load(content) as Record<string, any>;
          
          // Validate with Zod
          const validated = ReviewConfigSchema.parse(data);
          
          console.log(`✅ Loaded config from ${configPath}`);
          return this.normalizeKeys(validated);
        } catch (error) {
          console.warn(`Failed to load ${configPath}:`, error);
        }
      }
    }
    
    return {};
  }
  
  private static loadFromEnv(): Partial<ReviewConfig> {
    const env = process.env;
    
    return {
      providers: this.parseArray(env.REVIEW_PROVIDERS),
      synthesisModel: env.SYNTHESIS_MODEL,
      fallbackProviders: this.parseArray(env.FALLBACK_PROVIDERS),
      providerAllowlist: this.parseArray(env.PROVIDER_ALLOWLIST),
      providerBlocklist: this.parseArray(env.PROVIDER_BLOCKLIST),
      providerLimit: this.parseNumber(env.PROVIDER_LIMIT),
      providerRetries: this.parseNumber(env.PROVIDER_RETRIES),
      providerMaxParallel: this.parseNumber(env.PROVIDER_MAX_PARALLEL),
      
      inlineMaxComments: this.parseNumber(env.INLINE_MAX_COMMENTS),
      inlineMinSeverity: this.parseSeverity(env.INLINE_MIN_SEVERITY),
      inlineMinAgreement: this.parseNumber(env.INLINE_MIN_AGREEMENT),
      
      skipLabels: this.parseArray(env.SKIP_LABELS),
      skipDrafts: this.parseBoolean(env.SKIP_DRAFTS),
      skipBots: this.parseBoolean(env.SKIP_BOTS),
      minChangedLines: this.parseNumber(env.MIN_CHANGED_LINES),
      maxChangedFiles: this.parseNumber(env.MAX_CHANGED_FILES),
      
      diffMaxBytes: this.parseNumber(env.DIFF_MAX_BYTES),
      runTimeoutSeconds: this.parseNumber(env.RUN_TIMEOUT_SECONDS),
      
      budgetMaxUsd: this.parseFloat(env.BUDGET_MAX_USD),
      
      enableAstAnalysis: this.parseBoolean(env.ENABLE_AST_ANALYSIS),
      enableSecurity: this.parseBoolean(env.ENABLE_SECURITY),
      enableCaching: this.parseBoolean(env.ENABLE_CACHING),
      enableTestHints: this.parseBoolean(env.ENABLE_TEST_HINTS),
      enableAiDetection: this.parseBoolean(env.ENABLE_AI_DETECTION),
    };
  }
  
  private static merge(
    ...configs: Partial<ReviewConfig>[]
  ): ReviewConfig {
    const merged = { ...configs[0] };
    
    for (const config of configs.slice(1)) {
      for (const [key, value] of Object.entries(config)) {
        if (value !== undefined && value !== null) {
          (merged as any)[key] = value;
        }
      }
    }
    
    return merged as ReviewConfig;
  }
  
  private static normalizeKeys(config: ReviewConfigFile): Partial<ReviewConfig> {
    return {
      providers: config.providers,
      synthesisModel: config.synthesis_model,
      fallbackProviders: config.fallback_providers,
      providerAllowlist: config.provider_allowlist,
      providerBlocklist: config.provider_blocklist,
      providerLimit: config.provider_limit,
      providerRetries: config.provider_retries,
      providerMaxParallel: config.provider_max_parallel,
      
      inlineMaxComments: config.inline_max_comments,
      inlineMinSeverity: config.inline_min_severity,
      inlineMinAgreement: config.inline_min_agreement,
      
      skipLabels: config.skip_labels,
      skipDrafts: config.skip_drafts,
      skipBots: config.skip_bots,
      minChangedLines: config.min_changed_lines,
      maxChangedFiles: config.max_changed_files,
      
      diffMaxBytes: config.diff_max_bytes,
      runTimeoutSeconds: config.run_timeout_seconds,
      
      budgetMaxUsd: config.budget_max_usd,
      
      enableAstAnalysis: config.enable_ast_analysis,
      enableSecurity: config.enable_security,
      enableCaching: config.enable_caching,
      enableTestHints: config.enable_test_hints,
      enableAiDetection: config.enable_ai_detection,
    };
  }
  
  // Helper parsers
  private static parseArray(value?: string): string[] | undefined {
    if (!value) return undefined;
    return value.split(',').map(s => s.trim()).filter(Boolean);
  }
  
  private static parseNumber(value?: string): number | undefined {
    if (!value) return undefined;
    const num = parseInt(value, 10);
    return isNaN(num) ? undefined : num;
  }
  
  private static parseFloat(value?: string): number | undefined {
    if (!value) return undefined;
    const num = parseFloat(value);
    return isNaN(num) ? undefined : num;
  }
  
  private static parseBoolean(value?: string): boolean | undefined {
    if (!value) return undefined;
    return value.toLowerCase() === 'true';
  }
  
  private static parseSeverity(
    value?: string
  ): 'critical' | 'major' | 'minor' | undefined {
    if (!value) return undefined;
    const lower = value.toLowerCase();
    if (lower === 'critical' || lower === 'major' || lower === 'minor') {
      return lower;
    }
    return undefined;
  }
}
```

**File**: `src/config/defaults.ts`

```typescript
import { ReviewConfig } from '../types';

export const DEFAULT_CONFIG: ReviewConfig = {
  // Providers
  providers: [
    'openrouter/google/gemini-2.0-flash-exp:free',
    'openrouter/mistralai/devstral-2512:free',
    'openrouter/xiaomi/mimo-v2-flash:free',
  ],
  synthesisModel: 'openrouter/mistralai/devstral-2512:free',
  fallbackProviders: [
    'opencode/big-pickle',
    'opencode/grok-code',
    'opencode/minimax-m2.1-free',
  ],
  providerAllowlist: [],
  providerBlocklist: [],
  providerLimit: 0,
  providerRetries: 2,
  providerMaxParallel: 3,
  
  // Inline comments
  inlineMaxComments: 5,
  inlineMinSeverity: 'major',
  inlineMinAgreement: 2,
  
  // Skip filters
  skipLabels: [],
  skipDrafts: false,
  skipBots: true,
  minChangedLines: 0,
  maxChangedFiles: 0,
  
  // Performance
  diffMaxBytes: 120000,
  runTimeoutSeconds: 600,
  
  // Cost
  budgetMaxUsd: 0,
  
  // Features
  enableAstAnalysis: true,
  enableSecurity: true,
  enableCaching: true,
  enableTestHints: true,
  enableAiDetection: true,
};
```

---

### 4. Orchestrator (Main Controller)

**File**: `src/core/orchestrator.ts`

```typescript
import { ReviewConfig, PRContext, Review, ReviewMetrics } from '../types';
import { GitHubClient } from '../github/client';
import { CacheManager } from '../cache/manager';
import { ASTAnalyzer } from '../analysis/ast/analyzer';
import { LLMExecutor } from '../analysis/llm/executor';
import { SynthesisEngine } from '../analysis/synthesis';
import { SecurityScanner } from '../security/scanner';
import { TestCoverageAnalyzer } from '../analysis/test-coverage';
import { CostEstimator } from '../cost/estimator';

export interface OrchestratorComponents {
  config: ReviewConfig;
  github: GitHubClient;
  cache: CacheManager;
  astAnalyzer: ASTAnalyzer;
  llmExecutor: LLMExecutor;
  synthesis: SynthesisEngine;
  security: SecurityScanner;
  testCoverage: TestCoverageAnalyzer;
  costEstimator: CostEstimator;
}

export class ReviewOrchestrator {
  constructor(private components: OrchestratorComponents) {}
  
  async execute(prNumber: number): Promise<Review | null> {
    const startTime = Date.now();
    const { config, github, cache, astAnalyzer, llmExecutor, synthesis, security, testCoverage, costEstimator } = this.components;
    
    // 1. Load PR context
    console.log(`📥 Loading PR #${prNumber}...`);
    const pr = await github.loadPRContext(prNumber);
    
    // 2. Check skip conditions
    const skipReason = this.shouldSkip(pr);
    if (skipReason) {
      console.log(`⏭️  Skipping: ${skipReason}`);
      await github.postComment(
        pr.number,
        `ℹ️ **Review Skipped**\n\n${skipReason}`
      );
      return null;
    }
    
    // 3. Estimate cost and check budget
    if (config.budgetMaxUsd > 0) {
      const estimate = await costEstimator.estimateCost(
        llmExecutor.providers,
        this.estimatePromptTokens(pr.diff)
      );
      
      console.log(`💰 Estimated cost: $${estimate.totalCost.toFixed(4)}`);
      
      if (estimate.totalCost > config.budgetMaxUsd) {
        throw new Error(
          `Estimated cost ($${estimate.totalCost.toFixed(4)}) exceeds budget ($${config.budgetMaxUsd})`
        );
      }
    }
    
    // 4. Check cache for unchanged files
    const cachedReviews = config.enableCaching
      ? await cache.getCachedReviews(pr)
      : new Map();
    
    const changedFiles = pr.files.filter(
      f => !cachedReviews.has(f.filename)
    );
    
    console.log(
      `📦 Cache: ${cachedReviews.size} cached, ${changedFiles.length} new`
    );
    
    // 5. Fast path: AST analysis (always run, very fast)
    const astFindings = config.enableAstAnalysis
      ? await astAnalyzer.analyze(changedFiles)
      : [];
    
    console.log(`🌳 AST: Found ${astFindings.length} issues`);
    
    // 6. Determine which files need LLM analysis
    const needsLLM = this.filterForLLM(changedFiles, astFindings);
    
    console.log(`🤖 LLM: ${needsLLM.length} files need deep analysis`);
    
    // 7. Slow path: Multi-provider LLM (if needed)
    const llmFindings = needsLLM.length > 0
      ? await llmExecutor.analyze(needsLLM, pr.diff)
      : [];
    
    console.log(`🤖 LLM: Found ${llmFindings.length} issues`);
    
    // 8. Security scan (optional, in parallel with LLM)
    const securityFindings = config.enableSecurity
      ? await security.scan(changedFiles)
      : [];
    
    console.log(`🔒 Security: Found ${securityFindings.length} issues`);
    
    // 9. Test coverage hints
    const testHints = config.enableTestHints
      ? testCoverage.analyze(changedFiles)
      : [];
    
    console.log(`🧪 Test: ${testHints.length} files missing tests`);
    
    // 10. Merge all findings
    const allFindings = [
      ...astFindings,
      ...llmFindings,
      ...securityFindings,
      ...Array.from(cachedReviews.values()).flat(),
    ];
    
    console.log(`📊 Total: ${allFindings.length} findings`);
    
    // 11. Synthesize into final review
    const review = await synthesis.synthesize(allFindings, pr, testHints);
    
    // 12. Calculate metrics
    review.metrics.durationSeconds = (Date.now() - startTime) / 1000;
    
    // 13. Cache results
    if (config.enableCaching) {
      await cache.saveResults(pr, review);
    }
    
    // 14. Post to GitHub
    await github.postReview(pr, review);
    
    console.log(`✅ Review completed in ${review.metrics.durationSeconds}s`);
    
    return review;
  }
  
  private shouldSkip(pr: PRContext): string | null {
    const { config } = this.components;
    
    // Skip if draft PR
    if (config.skipDrafts && pr.draft) {
      return 'PR is in draft status';
    }
    
    // Skip if bot PR
    if (config.skipBots && this.isBotAuthor(pr.author)) {
      return `PR author is a bot (${pr.author})`;
    }
    
    // Skip based on labels
    if (config.skipLabels && config.skipLabels.length > 0) {
      for (const label of pr.labels) {
        if (config.skipLabels.includes(label)) {
          return `PR has skip label: ${label}`;
        }
      }
    }
    
    // Skip if too small
    if (config.minChangedLines > 0) {
      const totalLines = pr.additions + pr.deletions;
      if (totalLines < config.minChangedLines) {
        return `Changes (${totalLines} lines) below minimum (${config.minChangedLines})`;
      }
    }
    
    // Skip if too large
    if (config.maxChangedFiles > 0) {
      if (pr.files.length > config.maxChangedFiles) {
        return `Files changed (${pr.files.length}) exceeds maximum (${config.maxChangedFiles})`;
      }
    }
    
    return null;
  }
  
  private isBotAuthor(author: string): boolean {
    const botPatterns = [
      'bot',
      'dependabot',
      'renovate',
      'github-actions',
      '[bot]',
    ];
    
    const lowerAuthor = author.toLowerCase();
    return botPatterns.some(pattern => lowerAuthor.includes(pattern));
  }
  
  private filterForLLM(
    files: FileChange[],
    astFindings: Finding[]
  ): FileChange[] {
    return files.filter(file => {
      // Skip trivial changes
      if (file.additions + file.deletions < 5) return false;
      
      // Skip test files (AST handles most)
      if (file.filename.includes('.test.') || file.filename.includes('.spec.')) {
        return false;
      }
      
      // Skip docs
      if (file.filename.endsWith('.md') || file.filename.endsWith('.txt')) {
        return false;
      }
      
      // Skip if AST found critical issues (no point in LLM)
      const criticalAST = astFindings.filter(
        f => f.file === file.filename && f.severity === 'critical'
      );
      if (criticalAST.length > 5) return false;
      
      return true;
    });
  }
  
  private estimatePromptTokens(diff: string): number {
    // Rough estimate: 1 token ≈ 4 characters
    return Math.ceil(diff.length / 4);
  }
}
```

---

### 5. Provider System

**File**: `src/providers/base.ts`

```typescript
import { ReviewResult } from '../types';

export abstract class Provider {
  constructor(public readonly name: string) {}
  
  abstract review(prompt: string, timeoutMs: number): Promise<ReviewResult>;
  
  static validate(name: string): boolean {
    const pattern = /^(opencode\/[\w.-]+|openrouter\/[\w.-]+\/[\w.-]+(:free)?)$/;
    return pattern.test(name);
  }
}

export class RateLimitError extends Error {
  constructor(message: string, public retryAfterSeconds?: number) {
    super(message);
    this.name = 'RateLimitError';
  }
}
```

**File**: `src/providers/openrouter.ts`

```typescript
import { Provider, RateLimitError } from './base';
import { ReviewResult, TokenUsage } from '../types';

export class OpenRouterProvider extends Provider {
  private static readonly BASE_URL = 'https://openrouter.ai/api/v1';
  
  constructor(
    modelId: string,
    private readonly apiKey: string
  ) {
    super(`openrouter/${modelId}`);
    this.modelId = modelId;
  }
  
  private readonly modelId: string;
  
  async review(prompt: string, timeoutMs: number): Promise<ReviewResult> {
    const startTime = Date.now();
    
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);
    
    try {
      const response = await fetch(
        `${OpenRouterProvider.BASE_URL}/chat/completions`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${this.apiKey}`,
            'HTTP-Referer': 'https://github.com/keithah/multi-provider-code-review',
            'X-Title': 'Multi-Provider Code Review',
          },
          body: JSON.stringify({
            model: this.modelId,
            messages: [{ role: 'user', content: prompt }],
            temperature: 0.1,
            max_tokens: 1500,
          }),
          signal: controller.signal,
        }
      );
      
      if (!response.ok) {
        if (response.status === 429) {
          const retryAfter = response.headers.get('retry-after');
          const seconds = retryAfter ? parseInt(retryAfter) : 3600;
          
          throw new RateLimitError(
            `Rate limited by OpenRouter: ${this.name}`,
            seconds
          );
        }
        
        throw new Error(
          `OpenRouter API error: ${response.status} ${response.statusText}`
        );
      }
      
      const data = await response.json();
      const durationSeconds = (Date.now() - startTime) / 1000;
      
      // Parse response
      const content = data.choices?.[0]?.message?.content || '';
      const usage = data.usage;
      
      // Try to parse JSON from content
      const findings = this.extractFindings(content);
      const aiAnalysis = this.extractAIAnalysis(content);
      
      return {
        content,
        usage: usage ? {
          promptTokens: usage.prompt_tokens || 0,
          completionTokens: usage.completion_tokens || 0,
          totalTokens: usage.total_tokens || 0,
        } : undefined,
        durationSeconds,
        findings,
        aiLikelihood: aiAnalysis?.likelihood,
        aiReasoning: aiAnalysis?.reasoning,
      };
    } finally {
      clearTimeout(timeout);
    }
  }
  
  private extractFindings(content: string): any[] {
    // Try to extract JSON findings
    try {
      // Look for JSON block
      const jsonMatch = content.match(/```json\s*([\s\S]*?)```/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[1]);
        return parsed.findings || [];
      }
      
      // Try parsing entire content
      const parsed = JSON.parse(content);
      return parsed.findings || [];
    } catch {
      return [];
    }
  }
  
  private extractAIAnalysis(content: string): { likelihood: number; reasoning: string } | null {
    try {
      const jsonMatch = content.match(/```json\s*([\s\S]*?)```/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[1]);
        if (parsed.ai_likelihood !== undefined) {
          return {
            likelihood: parsed.ai_likelihood,
            reasoning: parsed.ai_reasoning || '',
          };
        }
      }
    } catch {}
    
    return null;
  }
}
```

**File**: `src/providers/registry.ts`

```typescript
import { Provider } from './base';
import { OpenRouterProvider } from './openrouter';
import { OpenCodeProvider } from './opencode';
import { ReviewConfig } from '../types';
import { RateLimiter } from './rate-limiter';

export class ProviderRegistry {
  private rateLimiter = new RateLimiter();
  private rotationIndex = 0;
  
  async createProviders(config: ReviewConfig): Promise<Provider[]> {
    // Instantiate all configured providers
    let providers = this.instantiateProviders(config);
    
    // Apply allowlist/blocklist
    providers = this.applyFilters(providers, config);
    
    // Remove rate-limited providers
    providers = await this.filterRateLimited(providers);
    
    // Apply provider limit with rotation
    if (config.providerLimit > 0 && providers.length > config.providerLimit) {
      providers = this.selectWithRotation(providers, config.providerLimit);
    }
    
    // Add fallbacks if needed
    if (providers.length === 0 && config.fallbackProviders.length > 0) {
      console.log('⚠️  All primary providers unavailable, using fallbacks');
      providers = this.instantiateProviders({
        ...config,
        providers: config.fallbackProviders,
      });
    }
    
    if (providers.length === 0) {
      throw new Error('No valid providers available');
    }
    
    console.log(`✅ Created ${providers.length} providers: ${providers.map(p => p.name).join(', ')}`);
    
    return providers;
  }
  
  private instantiateProviders(config: ReviewConfig): Provider[] {
    const providers: Provider[] = [];
    
    for (const name of config.providers) {
      if (!Provider.validate(name)) {
        console.warn(`❌ Invalid provider name: ${name}`);
        continue;
      }
      
      try {
        const provider = this.createProvider(name, config);
        providers.push(provider);
      } catch (error) {
        console.warn(`❌ Failed to create provider ${name}:`, error);
      }
    }
    
    return providers;
  }
  
  private createProvider(name: string, config: ReviewConfig): Provider {
    if (name.startsWith('openrouter/')) {
      const modelId = name.replace('openrouter/', '');
      const apiKey = process.env.OPENROUTER_API_KEY;
      
      if (!apiKey) {
        throw new Error('OPENROUTER_API_KEY not set');
      }
      
      return new OpenRouterProvider(modelId, apiKey);
    }
    
    if (name.startsWith('opencode/')) {
      const modelId = name.replace('opencode/', '');
      return new OpenCodeProvider(modelId);
    }
    
    throw new Error(`Unknown provider type: ${name}`);
  }
  
  private applyFilters(providers: Provider[], config: ReviewConfig): Provider[] {
    let filtered = providers;
    
    // Allowlist
    if (config.providerAllowlist.length > 0) {
      filtered = filtered.filter(p =>
        config.providerAllowlist.some(pattern =>
          p.name.includes(pattern)
        )
      );
    }
    
    // Blocklist
    if (config.providerBlocklist.length > 0) {
      filtered = filtered.filter(p =>
        !config.providerBlocklist.some(pattern =>
          p.name.includes(pattern)
        )
      );
    }
    
    return filtered;
  }
  
  private async filterRateLimited(providers: Provider[]): Promise<Provider[]> {
    const available: Provider[] = [];
    
    for (const provider of providers) {
      const isLimited = await this.rateLimiter.isRateLimited(provider.name);
      if (!isLimited) {
        available.push(provider);
      } else {
        console.log(`⏳ Skipping rate-limited provider: ${provider.name}`);
      }
    }
    
    return available;
  }
  
  private selectWithRotation(providers: Provider[], limit: number): Provider[] {
    const selected: Provider[] = [];
    
    for (let i = 0; i < limit; i++) {
      const index = (this.rotationIndex + i) % providers.length;
      selected.push(providers[index]);
    }
    
    this.rotationIndex = (this.rotationIndex + limit) % providers.length;
    
    return selected;
  }
}
```

---

## Implementation Roadmap

### Phase 1: Foundation (Weeks 1-2)

**Week 1: Project Setup**
- ✅ Initialize TypeScript project
- ✅ Set up build system (esbuild)
- ✅ Configure testing (Jest)
- ✅ Create core types
- ✅ Implement config system
- ✅ Add skip filters

**Deliverables**:
```bash
npm run build    # Produces dist/index.js
npm run test     # All tests pass
npm run lint     # No errors
```

---

**Week 2: Provider System**
- ✅ Provider base class
- ✅ OpenRouter provider
- ✅ OpenCode provider
- ✅ Provider registry with rotation
- ✅ Rate limiter
- ✅ Parallel execution with p-queue

**Deliverables**:
```typescript
// Can execute multiple providers
const providers = await registry.createProviders(config);
const results = await executor.runAll(providers, prompt);
```

---

### Phase 2: Core Review (Weeks 3-4)

**Week 3: Analysis Pipeline**
- ✅ Prompt builder (with AI detection)
- ✅ LLM executor
- ✅ Finding deduplication
- ✅ Consensus engine
- ✅ Basic synthesis

**Week 4: GitHub Integration**
- ✅ PR context loader
- ✅ Comment poster (with chunking)
- ✅ Inline comment posting
- ✅ SARIF export
- ✅ JSON reports

**Deliverables**: v2.0-alpha with feature parity to v1

---

### Phase 3: Cost & Performance (Weeks 5-6)

**Week 5: Cost Management**
- ✅ OpenRouter pricing API
- ✅ Cost estimator
- ✅ Budget guards
- ✅ Usage tracking

**Week 6: MVP Polish**
- ✅ Test coverage hints
- ✅ Comprehensive testing
- ✅ Documentation
- ✅ Bug fixes

**Deliverables**: v2.0-beta ready for real-world use

---

### Phase 4: Advanced Features (Weeks 7-10)

**Week 7: AST Analysis**
- ✅ Tree-sitter integration
- ✅ Language detection
- ✅ Basic patterns (console.log, unused imports)
- ✅ Complexity analysis

**Week 8: Caching & Performance**
- ✅ Cache manager
- ✅ File content hashing
- ✅ Incremental analysis
- ✅ Diff compression

**Week 9: Custom Rules**
- ✅ Rules engine
- ✅ Pattern-based rules
- ✅ Natural language rules
- ✅ Built-in rule library

**Week 10: Security & AI Features**
- ✅ Security scanner
- ✅ Secrets detection
- ✅ OWASP patterns
- ✅ AI code detection

**Deliverables**: v2.0 full release

---

## Testing Requirements

### Unit Tests (>80% coverage)

```typescript
// Example test structure
describe('ConsensusEngine', () => {
  it('should require minimum agreement', () => {
    const engine = new ConsensusEngine({ minAgreement: 2 });
    const findings = [/* ... */];
    const result = engine.apply(findings);
    expect(result.length).toBe(/* expected */);
  });
});
```

### Integration Tests

```typescript
describe('End-to-end review', () => {
  it('should complete full review workflow', async () => {
    // Mock GitHub API
    // Mock provider responses
    // Run review
    // Assert results
  });
});
```

### Test Coverage Goals

| Module | Target | Priority |
|--------|--------|----------|
| Config | >90% | P0 |
| Providers | >85% | P0 |
| Analysis | >80% | P0 |
| GitHub | >75% | P1 |
| Utils | >80% | P1 |

---

## Deployment Guide

### Build Process

```bash
# Development
npm run build          # Build with sourcemaps
npm run watch          # Watch mode

# Production
npm run build:prod     # Minified bundle
npm run test          # Run all tests
npm run lint          # Check code quality
```

### GitHub Action Definition

```yaml
# action.yml
name: 'Multi-Provider Code Review'
description: 'Best-in-class code review with ensemble AI'
author: 'Keith Herrington'

branding:
  icon: 'check-circle'
  color: 'blue'

inputs:
  GITHUB_TOKEN:
    description: 'GitHub token'
    required: true
  # ... all other inputs

outputs:
  findings_count:
    description: 'Number of findings'
  cost_usd:
    description: 'Total cost in USD'

runs:
  using: 'node20'
  main: 'dist/index.js'
```

---

## Success Metrics

### After 14 weeks, you will have:

✅ **World-class accuracy**: <10% false positives (vs ~30% current)  
✅ **Blazing fast**: <30s average review time (vs ~60s current)  
✅ **Ultra low cost**: <$0.01 per review (<$0.002 with caching)  
✅ **Comprehensive**: 30+ languages, AST + LLM hybrid  
✅ **Production ready**: >80% test coverage, fully documented  
✅ **Marketplace ready**: Meets all GitHub quality standards  

### Competitive Position

```
Features vs Competitors:

You  vs  CodeRabbit  vs  PR-Agent  vs  Kodus  vs  Semgrep
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
✓         ✗             ✗            ✗          ✗     Multi-provider
✓         ✗             ✗            ✗          ✗     Synthesis
✓         ✓             ✗            ✓          ✓     AST analysis
✓         ✓             ✗            ✗          ✓     Caching
✓         ✗             ✗            ✗          ✗     Cost tracking
✓         ✗             ✗            ✗          ✗     Budget guards
✓         ✗             ✗            ✗          ✗     Free-tier focus
MIT       Prop          AGPL         Dual       LGPL  License
$0        $499/mo       Free         $99/mo     Free  Pricing
```

---

## Final Checklist

Before considering implementation complete:

### Week 1-2 (Foundation)
- [ ] TypeScript project compiles
- [ ] All tests pass
- [ ] ESLint passes
- [ ] Config loads from file + env
- [ ] Skip filters work

### Week 3-4 (Core Review)
- [ ] Can execute 3+ providers in parallel
- [ ] Synthesis produces single review
- [ ] Consensus filters inline comments
- [ ] Comments post to GitHub
- [ ] SARIF exports correctly

### Week 5-6 (Cost & Polish)
- [ ] OpenRouter pricing API works
- [ ] Budget guards prevent overspend
- [ ] Test hints detect missing tests
- [ ] Large comments chunk properly
- [ ] Rate limiting prevents API errors

### Week 7-10 (Advanced)
- [ ] AST detects 10+ issue types
- [ ] Caching saves 80%+ on costs
- [ ] Custom rules work
- [ ] Security scanner finds secrets
- [ ] AI detection estimates likelihood

### Final Release
- [ ] >80% test coverage
- [ ] All documentation complete
- [ ] README has examples
- [ ] GitHub Marketplace submission ready
- [ ] Performance benchmarks met
- [ ] Cost targets met

---

## Getting Started

### Day 1: Initialize Project

```bash
cd /Users/keith/src/multi-provider-code-review
git checkout -b typescript-v2

# Initialize
npm init -y

# Install dependencies
npm install @actions/core @actions/github @octokit/rest @actions/cache \
  js-yaml zod tree-sitter tree-sitter-typescript tree-sitter-python \
  p-queue p-retry

npm install -D typescript @types/node @types/js-yaml esbuild jest \
  @types/jest ts-jest eslint @typescript-eslint/parser \
  @typescript-eslint/eslint-plugin prettier

# Create structure
mkdir -p src/{core,config,providers,analysis,github,output,utils,types}
mkdir -p __tests__/{unit,integration,fixtures}
mkdir -p dist

# Copy tsconfig, jest config, eslint config from blueprint
# Start coding!
```

### Day 2: First Module

```bash
# Create types
touch src/types/index.ts
# Copy type definitions from this document

# Create config
touch src/config/{schema.ts,loader.ts,defaults.ts}
# Copy config code from this document

# Test it
npm run build
npm run test
```

---

**END OF IMPLEMENTATION GUIDE**

This is your complete, single source of truth. Feed this entire document to Claude Code/Codex and start building! 🚀
