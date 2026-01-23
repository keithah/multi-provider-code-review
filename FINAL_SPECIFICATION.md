# Multi-Provider Code Review: Complete TypeScript Rewrite Specification

**Version**: 2.0  
**Date**: 2026-01-21  
**Purpose**: Single definitive guide for building the best-in-class multi-provider code review tool

---

## Table of Contents

1. [Executive Summary](#executive-summary)
2. [Vision & Principles](#vision--principles)
3. [Complete Feature Set](#complete-feature-set)
4. [Architecture](#architecture)
5. [Technology Stack](#technology-stack)
6. [Project Structure](#project-structure)
7. [Core Modules](#core-modules)
8. [Implementation Timeline](#implementation-timeline)
9. [Production-Ready Code Examples](#production-ready-code-examples)
10. [Testing Strategy](#testing-strategy)
11. [Deployment Guide](#deployment-guide)

---

## Executive Summary

### What We're Building

**The world's most accurate, cost-effective, and flexible code review tool** combining:
- ✨ **Multi-provider ensemble** - 3-7 AI providers voting on issues
- 🎯 **Hybrid AST+LLM** - Deterministic + semantic analysis
- 💰 **Cost optimization** - Free-tier focus, real-time pricing, budget guards
- 🧪 **Quality features** - AI detection, test coverage hints, consensus filtering
- 🚀 **Performance** - Caching, incremental analysis, parallel execution
- 🔒 **Security-first** - SAST, secrets detection, SARIF export

### Competitive Position

**"The only open-source code review tool with multi-provider synthesis, hybrid analysis, and built-in cost optimization"**

### Timeline

**14 weeks** to production-ready v2.0:
- Weeks 1-4: MVP (providers + synthesis)
- Weeks 5-6: PR #2 critical features
- Weeks 7-8: AST analysis
- Weeks 9-10: Caching + performance
- Weeks 11-12: Rules + security
- Weeks 13-14: Polish + launch

---

## Vision & Principles

### Core Principles

1. **Accuracy > Speed** - Better slow and right than fast and wrong
2. **Cost Conscious** - Free alternatives, transparent tracking
3. **Developer Experience** - Zero-config works, power users get control
4. **Open Source** - MIT license, no vendor lock-in
5. **Extensible** - Plugin architecture for providers and rules

### Competitive Advantages

| Feature | Us | PR-Agent | Kodus | CodeRabbit | Semgrep |
|---------|-----|----------|-------|------------|---------|
| Multi-provider | ✅ 3-7 | ❌ 1 | ❌ 1 | ❌ 1 | ❌ N/A |
| Synthesis | ✅ Unique | ❌ | ❌ | ❌ | ❌ |
| AST + LLM | ✅ | ❌ | ✅ | ✅ | ✅ AST only |
| Cost tracking | ✅ Real-time | ❌ | ❌ | ⚠️ Hidden | ❌ |
| MIT license | ✅ | ❌ AGPL | ❌ Dual | ❌ Closed | ❌ LGPL |
| Free tier | ✅ Focus | ⚠️ Limited | ❌ | ❌ | ✅ |

---

## Complete Feature Set

### ✅ Core Features (MVP - Weeks 1-4)

1. **Multi-provider execution**
   - 3-7 providers in parallel
   - OpenRouter + OpenCode support
   - Configurable timeout & retries
   - Automatic fallback chains

2. **Synthesis engine**
   - Merge multiple reviews into one
   - Deduplicate findings
   - Priority ranking
   - Category grouping

3. **Consensus inline comments**
   - Require N providers to agree
   - Severity threshold filtering
   - Max comments limit
   - GitHub suggestion blocks

4. **Configuration system**
   - YAML file support
   - Environment variables
   - Zod validation
   - Hierarchical merging (org → repo → PR)

5. **GitHub integration**
   - PR context loading
   - Comment posting
   - Inline comments
   - SARIF upload

### 🆕 Critical Features (Weeks 5-6)

6. **Chunked comment posting**
   - Auto-split at 60KB
   - Paragraph-aware chunking
   - Multi-part headers
   - Rate limit protection

7. **Advanced skip filters**
   - Skip by labels
   - Skip by file count
   - Skip by line count
   - Skip drafts & bots

8. **Rate limit tracking**
   - Per-provider state
   - Persistent across runs
   - Automatic retry scheduling
   - Cross-process safe

9. **OpenRouter pricing**
   - Real-time API pricing
   - Cost estimation
   - Budget pre-check
   - Per-provider breakdown

### 🎯 Quality Features (Weeks 5-6)

10. **AI code detection**
    - Ask each provider for likelihood
    - Aggregate across providers
    - Show in summary
    - Flag high-confidence AI code

11. **Test coverage hints**
    - Detect missing test files
    - Suggest test file names
    - Show in summary
    - Language-aware patterns

### 🚀 Performance Features (Weeks 7-10)

12. **AST analysis**
    - Tree-sitter parsing
    - 30+ languages
    - Complexity analysis
    - Pattern matching

13. **Smart caching**
    - File-level caching
    - Content-based keys
    - GitHub Actions Cache
    - Auto-invalidation

14. **Incremental analysis**
    - Only changed files
    - Merge with cached results
    - 10x faster reviews

15. **Diff compression**
    - Smart chunking
    - Priority-based files
    - Support 10k+ line PRs

### 🔧 Advanced Features (Weeks 11-14)

16. **Custom rules engine**
    - Pattern-based (AST)
    - Natural language (LLM)
    - Team-specific rules
    - Self-documenting

17. **Security scanning**
    - SAST analysis
    - Secrets detection
    - Dependency scanning
    - OWASP Top 10

18. **Metrics & observability**
    - Per-provider stats
    - Cost breakdown
    - Performance timings
    - Quality dashboard

19. **Provider rotation**
    - Round-robin selection
    - Load balancing
    - Fair usage

20. **Artifact uploads**
    - JSON reports
    - SARIF reports
    - Auto-upload to GitHub

---

## Architecture

### Three-Tier Analysis Pipeline

```
┌─────────────────────────────────────────────────────────────┐
│                     GitHub PR Event                          │
└────────────────────┬────────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────────┐
│                  Review Orchestrator                         │
│                                                              │
│  1. Load hierarchical config                                │
│  2. Check skip conditions (labels, size, draft, bot)        │
│  3. Estimate cost (OpenRouter pricing API)                  │
│  4. Check budget guard                                      │
│  5. Filter rate-limited providers                           │
│  6. Load PR context + check cache                           │
└────────────────────┬────────────────────────────────────────┘
                     │
         ┌───────────┴───────────┐
         ▼                       ▼
┌──────────────────┐    ┌──────────────────┐
│  Tier 1: AST     │    │  Tier 2: LLM     │
│  (Fast & Free)   │    │  (Slow & Paid)   │
│                  │    │                  │
│  • Tree-sitter   │    │  • 3-7 providers │
│  • Complexity    │    │  • Parallel exec │
│  • Type errors   │    │  • Retry logic   │
│  • Patterns      │    │  • Rate limits   │
│                  │    │  • AI detection  │
│  ~2s, $0         │    │  ~30s, ~$0.01   │
└────────┬─────────┘    └────────┬─────────┘
         │                       │
         └───────────┬───────────┘
                     ▼
         ┌────────────────────────┐
         │  Finding Pipeline      │
         │                        │
         │  • Merge AST + LLM     │
         │  • Deduplicate         │
         │  • Consensus filter    │
         │  • Severity rank       │
         │  • Test coverage check │
         └───────────┬────────────┘
                     ▼
         ┌────────────────────────┐
         │  Synthesis Engine      │
         │                        │
         │  • Category grouping   │
         │  • Priority scoring    │
         │  • Action items        │
         │  • AI analysis summary │
         └───────────┬────────────┘
                     ▼
         ┌────────────────────────┐
         │  Output Generator      │
         │                        │
         │  • Chunked comments    │
         │  • Inline suggestions  │
         │  • SARIF export        │
         │  • JSON reports        │
         │  • Artifact upload     │
         └────────────────────────┘
```

---

## Technology Stack

### Core

```json
{
  "runtime": "Node.js 20+",
  "language": "TypeScript 5.3+",
  "build": "esbuild",
  "package": "npm"
}
```

### Key Dependencies

```json
{
  "dependencies": {
    "@actions/core": "^1.10.1",
    "@actions/github": "^6.0.0",
    "@actions/cache": "^3.2.4",
    "@octokit/rest": "^20.0.2",
    "tree-sitter": "^0.21.0",
    "tree-sitter-typescript": "^0.21.0",
    "tree-sitter-python": "^0.21.0",
    "zod": "^3.22.4",
    "js-yaml": "^4.1.0",
    "p-queue": "^8.0.1",
    "p-retry": "^6.2.0"
  },
  "devDependencies": {
    "typescript": "^5.3.3",
    "@types/node": "^20.10.0",
    "esbuild": "^0.19.11",
    "jest": "^29.7.0",
    "ts-jest": "^29.1.1",
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
│   │   ├── orchestrator.ts              # Main coordinator
│   │   └── skip-checker.ts              # Skip condition logic
│   │
│   ├── config/
│   │   ├── loader.ts                    # Load from file/env
│   │   ├── schema.ts                    # Zod schemas
│   │   └── hierarchy.ts                 # Hierarchical merge
│   │
│   ├── providers/
│   │   ├── base.ts                      # Provider interface
│   │   ├── registry.ts                  # Factory + rotation
│   │   ├── openrouter.ts                # OpenRouter HTTP
│   │   ├── opencode.ts                  # OpenCode CLI
│   │   └── rate-limiter.ts              # Rate limit tracking
│   │
│   ├── analysis/
│   │   ├── ast/
│   │   │   ├── analyzer.ts              # AST coordinator
│   │   │   ├── parsers.ts               # Tree-sitter setup
│   │   │   └── patterns.ts              # Pattern matchers
│   │   ├── llm/
│   │   │   ├── executor.ts              # Multi-provider exec
│   │   │   ├── prompt-builder.ts        # Prompt construction
│   │   │   └── ai-detector.ts           # AI code detection
│   │   ├── synthesis.ts                 # Merge findings
│   │   ├── consensus.ts                 # Voting logic
│   │   ├── deduplicator.ts              # Remove duplicates
│   │   └── test-coverage.ts             # Missing tests
│   │
│   ├── cache/
│   │   ├── manager.ts                   # Cache coordinator
│   │   ├── storage.ts                   # Actions Cache API
│   │   └── key-builder.ts               # Cache key logic
│   │
│   ├── cost/
│   │   ├── pricing-service.ts           # OpenRouter pricing
│   │   ├── estimator.ts                 # Cost estimation
│   │   └── tracker.ts                   # Usage tracking
│   │
│   ├── github/
│   │   ├── client.ts                    # API wrapper
│   │   ├── pr-loader.ts                 # Load PR context
│   │   ├── comment-poster.ts            # Chunked posting
│   │   └── inline-comments.ts           # Inline suggestions
│   │
│   ├── output/
│   │   ├── formatter.ts                 # Format review
│   │   ├── sarif.ts                     # SARIF v2.1.0
│   │   ├── json.ts                      # JSON report
│   │   └── artifacts.ts                 # Upload artifacts
│   │
│   ├── security/
│   │   ├── scanner.ts                   # Security coordinator
│   │   ├── secrets.ts                   # Secrets detection
│   │   └── patterns.ts                  # OWASP patterns
│   │
│   ├── rules/
│   │   ├── engine.ts                    # Rules executor
│   │   ├── loader.ts                    # Load custom rules
│   │   └── builtin/                     # Built-in rules
│   │
│   ├── utils/
│   │   ├── retry.ts                     # p-retry wrapper
│   │   ├── parallel.ts                  # p-queue wrapper
│   │   ├── logger.ts                    # Structured logging
│   │   └── diff.ts                      # Diff compression
│   │
│   └── types/
│       └── index.ts                     # All type definitions
│
├── __tests__/
│   ├── unit/
│   ├── integration/
│   └── fixtures/
│
├── action.yml                           # GitHub Action definition
├── package.json
├── tsconfig.json
├── jest.config.js
└── README.md
```

---

## Core Modules

### 1. Main Entry Point

```typescript
// src/main.ts

import * as core from '@actions/core';
import { ReviewOrchestrator } from './core/orchestrator';
import { ConfigLoader } from './config/loader';
import { setupComponents } from './setup';

async function run(): Promise<void> {
  try {
    // Load configuration
    const config = await ConfigLoader.load();
    
    // Initialize all components
    const components = await setupComponents(config);
    
    // Create orchestrator
    const orchestrator = new ReviewOrchestrator(config, components);
    
    // Execute review
    const prNumber = parseInt(core.getInput('PR_NUMBER'), 10);
    const result = await orchestrator.execute(prNumber);
    
    if (result) {
      // Set outputs
      core.setOutput('findings_count', result.findings.length);
      core.setOutput('critical_count', result.metrics.critical);
      core.setOutput('total_cost', result.metrics.totalCost.toFixed(4));
      
      console.log('✅ Review completed successfully');
    } else {
      console.log('⏭️  Review skipped');
    }
  } catch (error) {
    core.setFailed(`Review failed: ${(error as Error).message}`);
    process.exit(1);
  }
}

run();
```

### 2. Type Definitions

```typescript
// src/types/index.ts

export interface ReviewConfig {
  // Providers
  providers: string[];
  synthesisModel: string;
  fallbackProviders: string[];
  providerMaxParallel: number;
  providerRetries: number;
  providerLimit: number;
  providerAllowlist: string[];
  providerBlocklist: string[];
  
  // Inline comments
  inlineMaxComments: number;
  inlineMinSeverity: 'critical' | 'major' | 'minor';
  inlineMinAgreement: number;
  
  // Skip conditions
  skipLabels: string[];
  minChangedLines: number;
  maxChangedFiles: number;
  skipDrafts: boolean;
  skipBots: boolean;
  
  // Performance
  diffMaxBytes: number;
  runTimeoutSeconds: number;
  enableCache: boolean;
  enableAST: boolean;
  
  // Cost
  budgetMaxUsd: number;
  
  // Features
  enableAIDetection: boolean;
  enableTestHints: boolean;
  enableSecurity: boolean;
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
  status: 'added' | 'modified' | 'removed';
  additions: number;
  deletions: number;
  changes: number;
  patch?: string;
  language?: string;
}

export interface Finding {
  file: string;
  line: number;
  severity: 'critical' | 'major' | 'minor';
  title: string;
  message: string;
  suggestion?: string;
  provider?: string;
  providers?: string[];  // For consensus
  confidence?: number;   // 0-1, for consensus
}

export interface ReviewResult {
  content: string;
  usage?: TokenUsage;
  durationSeconds?: number;
  findings?: Finding[];
  aiLikelihood?: number;
  aiReasoning?: string;
}

export interface TokenUsage {
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
}

export interface Review {
  summary: string;
  findings: Finding[];
  inlineComments: InlineComment[];
  actionItems: string[];
  testHints?: TestCoverageHint[];
  aiAnalysis?: AIAnalysis;
  metrics: ReviewMetrics;
}

export interface InlineComment {
  path: string;
  line: number;
  side: 'LEFT' | 'RIGHT';
  body: string;
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

export interface ReviewMetrics {
  totalProviders: number;
  successfulProviders: number;
  failedProviders: number;
  totalCost: number;
  costBreakdown: Record<string, number>;
  totalTokens: number;
  durationSeconds: number;
  critical: number;
  major: number;
  minor: number;
  cached: boolean;
}

export interface CostEstimate {
  totalCost: number;
  breakdown: Record<string, number>;
  estimatedTokens: number;
}

export interface ModelPricing {
  modelId: string;
  promptPrice: number;
  completionPrice: number;
  isFree: boolean;
}
```

### 3. Configuration System

```typescript
// src/config/schema.ts

import { z } from 'zod';

export const ReviewConfigSchema = z.object({
  // Providers
  providers: z.array(z.string()).optional(),
  synthesis_model: z.string().optional(),
  fallback_providers: z.array(z.string()).optional(),
  provider_max_parallel: z.number().int().min(1).optional(),
  provider_retries: z.number().int().min(1).optional(),
  provider_limit: z.number().int().min(0).optional(),
  provider_allowlist: z.array(z.string()).optional(),
  provider_blocklist: z.array(z.string()).optional(),
  
  // Inline comments
  inline_max_comments: z.number().int().min(0).optional(),
  inline_min_severity: z.enum(['critical', 'major', 'minor']).optional(),
  inline_min_agreement: z.number().int().min(1).optional(),
  
  // Skip conditions
  skip_labels: z.array(z.string()).optional(),
  min_changed_lines: z.number().int().min(0).optional(),
  max_changed_files: z.number().int().min(0).optional(),
  skip_drafts: z.boolean().optional(),
  skip_bots: z.boolean().optional(),
  
  // Performance
  diff_max_bytes: z.number().int().min(0).optional(),
  run_timeout_seconds: z.number().int().min(1).optional(),
  enable_cache: z.boolean().optional(),
  enable_ast: z.boolean().optional(),
  
  // Cost
  budget_max_usd: z.number().min(0).optional(),
  
  // Features
  enable_ai_detection: z.boolean().optional(),
  enable_test_hints: z.boolean().optional(),
  enable_security: z.boolean().optional(),
});

export type ReviewConfigFile = z.infer<typeof ReviewConfigSchema>;
```

```typescript
// src/config/loader.ts

import * as fs from 'fs/promises';
import * as path from 'path';
import * as yaml from 'js-yaml';
import { ReviewConfig } from '../types';
import { ReviewConfigSchema, ReviewConfigFile } from './schema';

export class ConfigLoader {
  private static readonly CONFIG_PATHS = [
    '.github/multi-review.yml',
    '.github/multi-review.yaml',
    '.multi-review.yml',
  ];
  
  static async load(): Promise<ReviewConfig> {
    const fileConfig = await this.loadFromFile();
    const envConfig = this.loadFromEnv();
    
    return this.merge(this.getDefaults(), fileConfig, envConfig);
  }
  
  private static async loadFromFile(): Promise<Partial<ReviewConfig>> {
    for (const configPath of this.CONFIG_PATHS) {
      try {
        const fullPath = path.join(process.cwd(), configPath);
        const content = await fs.readFile(fullPath, 'utf8');
        const data = yaml.load(content) as Record<string, any>;
        
        // Validate
        const validated = ReviewConfigSchema.parse(data);
        return this.normalizeKeys(validated);
      } catch {
        continue;
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
      providerMaxParallel: this.parseNumber(env.PROVIDER_MAX_PARALLEL),
      providerRetries: this.parseNumber(env.PROVIDER_RETRIES),
      providerLimit: this.parseNumber(env.PROVIDER_LIMIT),
      providerAllowlist: this.parseArray(env.PROVIDER_ALLOWLIST),
      providerBlocklist: this.parseArray(env.PROVIDER_BLOCKLIST),
      
      inlineMaxComments: this.parseNumber(env.INLINE_MAX_COMMENTS),
      inlineMinSeverity: this.parseSeverity(env.INLINE_MIN_SEVERITY),
      inlineMinAgreement: this.parseNumber(env.INLINE_MIN_AGREEMENT),
      
      skipLabels: this.parseArray(env.SKIP_LABELS),
      minChangedLines: this.parseNumber(env.MIN_CHANGED_LINES),
      maxChangedFiles: this.parseNumber(env.MAX_CHANGED_FILES),
      skipDrafts: this.parseBoolean(env.SKIP_DRAFTS),
      skipBots: this.parseBoolean(env.SKIP_BOTS),
      
      diffMaxBytes: this.parseNumber(env.DIFF_MAX_BYTES),
      runTimeoutSeconds: this.parseNumber(env.RUN_TIMEOUT_SECONDS),
      enableCache: this.parseBoolean(env.ENABLE_CACHE),
      enableAST: this.parseBoolean(env.ENABLE_AST),
      
      budgetMaxUsd: this.parseFloat(env.BUDGET_MAX_USD),
      
      enableAIDetection: this.parseBoolean(env.ENABLE_AI_DETECTION),
      enableTestHints: this.parseBoolean(env.ENABLE_TEST_HINTS),
      enableSecurity: this.parseBoolean(env.ENABLE_SECURITY),
    };
  }
  
  private static getDefaults(): ReviewConfig {
    return {
      providers: [
        'openrouter/google/gemini-2.0-flash-exp:free',
        'openrouter/mistralai/devstral-2512:free',
        'opencode/big-pickle',
      ],
      synthesisModel: 'openrouter/google/gemini-2.0-flash-exp:free',
      fallbackProviders: [
        'opencode/big-pickle',
        'opencode/grok-code',
      ],
      providerMaxParallel: 3,
      providerRetries: 2,
      providerLimit: 0,
      providerAllowlist: [],
      providerBlocklist: [],
      
      inlineMaxComments: 5,
      inlineMinSeverity: 'major',
      inlineMinAgreement: 2,
      
      skipLabels: [],
      minChangedLines: 0,
      maxChangedFiles: 0,
      skipDrafts: false,
      skipBots: true,
      
      diffMaxBytes: 120000,
      runTimeoutSeconds: 600,
      enableCache: true,
      enableAST: true,
      
      budgetMaxUsd: 0,
      
      enableAIDetection: true,
      enableTestHints: true,
      enableSecurity: false,
    };
  }
  
  private static merge(...configs: Partial<ReviewConfig>[]): ReviewConfig {
    const result = { ...this.getDefaults() };
    
    for (const config of configs) {
      for (const [key, value] of Object.entries(config)) {
        if (value !== undefined && value !== null) {
          (result as any)[key] = value;
        }
      }
    }
    
    return result;
  }
  
  private static normalizeKeys(config: ReviewConfigFile): Partial<ReviewConfig> {
    return {
      providers: config.providers,
      synthesisModel: config.synthesis_model,
      fallbackProviders: config.fallback_providers,
      providerMaxParallel: config.provider_max_parallel,
      providerRetries: config.provider_retries,
      providerLimit: config.provider_limit,
      providerAllowlist: config.provider_allowlist,
      providerBlocklist: config.provider_blocklist,
      
      inlineMaxComments: config.inline_max_comments,
      inlineMinSeverity: config.inline_min_severity,
      inlineMinAgreement: config.inline_min_agreement,
      
      skipLabels: config.skip_labels,
      minChangedLines: config.min_changed_lines,
      maxChangedFiles: config.max_changed_files,
      skipDrafts: config.skip_drafts,
      skipBots: config.skip_bots,
      
      diffMaxBytes: config.diff_max_bytes,
      runTimeoutSeconds: config.run_timeout_seconds,
      enableCache: config.enable_cache,
      enableAST: config.enable_ast,
      
      budgetMaxUsd: config.budget_max_usd,
      
      enableAIDetection: config.enable_ai_detection,
      enableTestHints: config.enable_test_hints,
      enableSecurity: config.enable_security,
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
  
  private static parseSeverity(value?: string): 'critical' | 'major' | 'minor' | undefined {
    if (!value) return undefined;
    const lower = value.toLowerCase();
    if (lower === 'critical' || lower === 'major' || lower === 'minor') {
      return lower;
    }
    return undefined;
  }
}
```

### 4. Orchestrator (Main Coordinator)

```typescript
// src/core/orchestrator.ts

import { ReviewConfig, PRContext, Review } from '../types';
import { GitHubClient } from '../github/client';
import { CacheManager } from '../cache/manager';
import { ASTAnalyzer } from '../analysis/ast/analyzer';
import { LLMExecutor } from '../analysis/llm/executor';
import { SynthesisEngine } from '../analysis/synthesis';
import { TestCoverageAnalyzer } from '../analysis/test-coverage';
import { CostEstimator } from '../cost/estimator';
import { SkipChecker } from './skip-checker';

export class ReviewOrchestrator {
  constructor(
    private config: ReviewConfig,
    private github: GitHubClient,
    private cache: CacheManager,
    private astAnalyzer: ASTAnalyzer,
    private llmExecutor: LLMExecutor,
    private synthesis: SynthesisEngine,
    private testCoverage: TestCoverageAnalyzer,
    private costEstimator: CostEstimator,
    private skipChecker: SkipChecker
  ) {}
  
  async execute(prNumber: number): Promise<Review | null> {
    // 1. Load PR context
    console.log(`📥 Loading PR #${prNumber}...`);
    const pr = await this.github.loadPRContext(prNumber);
    
    // 2. Check skip conditions
    const skipReason = this.skipChecker.shouldSkip(pr);
    if (skipReason) {
      console.log(`⏭️  Skipping: ${skipReason}`);
      await this.github.postComment(
        pr.number,
        `ℹ️ Review skipped: ${skipReason}`
      );
      return null;
    }
    
    // 3. Estimate cost and check budget
    if (this.config.budgetMaxUsd > 0) {
      const estimate = await this.costEstimator.estimateCost(
        this.llmExecutor.getProviders(),
        this.estimatePromptTokens(pr.diff)
      );
      
      console.log(`💰 Estimated cost: $${estimate.totalCost.toFixed(4)}`);
      
      if (estimate.totalCost > this.config.budgetMaxUsd) {
        throw new Error(
          `Estimated cost ($${estimate.totalCost.toFixed(4)}) exceeds budget ($${this.config.budgetMaxUsd})`
        );
      }
    }
    
    // 4. Check cache for unchanged files
    const cachedFindings = this.config.enableCache
      ? await this.cache.getCachedFindings(pr)
      : new Map();
    
    const changedFiles = pr.files.filter(
      f => !cachedFindings.has(f.filename)
    );
    
    console.log(
      `📁 Files: ${pr.files.length} total, ${changedFiles.length} need review, ${cachedFindings.size} cached`
    );
    
    // 5. AST analysis (fast path)
    let astFindings: Finding[] = [];
    if (this.config.enableAST && changedFiles.length > 0) {
      console.log(`🌳 Running AST analysis...`);
      astFindings = await this.astAnalyzer.analyze(changedFiles);
      console.log(`✅ AST found ${astFindings.length} issues`);
    }
    
    // 6. Filter files for LLM analysis
    const needsLLM = this.filterForLLM(changedFiles, astFindings);
    console.log(`🤖 ${needsLLM.length} files need LLM review`);
    
    // 7. LLM analysis (slow path)
    let llmFindings: Finding[] = [];
    if (needsLLM.length > 0) {
      console.log(`🚀 Running ${this.llmExecutor.getProviders().length} providers...`);
      llmFindings = await this.llmExecutor.analyze(needsLLM, pr.diff);
      console.log(`✅ LLM found ${llmFindings.length} issues`);
    }
    
    // 8. Test coverage hints
    let testHints: TestCoverageHint[] = [];
    if (this.config.enableTestHints) {
      testHints = this.testCoverage.analyze(changedFiles);
      console.log(`🧪 ${testHints.length} files missing tests`);
    }
    
    // 9. Merge all findings
    const allFindings = [
      ...astFindings,
      ...llmFindings,
      ...Array.from(cachedFindings.values()).flat(),
    ];
    
    // 10. Synthesize into final review
    console.log(`🔄 Synthesizing ${allFindings.length} findings...`);
    const review = await this.synthesis.synthesize(
      allFindings,
      pr,
      testHints,
      this.llmExecutor.getAIAnalysis()
    );
    
    // 11. Cache results
    if (this.config.enableCache) {
      await this.cache.saveFindings(pr, review.findings);
    }
    
    // 12. Post to GitHub
    console.log(`📤 Posting review...`);
    await this.github.postReview(pr, review);
    
    console.log(`✅ Review complete!`);
    console.log(`   Findings: ${review.findings.length}`);
    console.log(`   Cost: $${review.metrics.totalCost.toFixed(4)}`);
    console.log(`   Duration: ${review.metrics.durationSeconds}s`);
    
    return review;
  }
  
  private filterForLLM(
    files: FileChange[],
    astFindings: Finding[]
  ): FileChange[] {
    return files.filter(file => {
      // Skip trivial changes
      if (file.additions + file.deletions < 5) return false;
      
      // Skip test files (AST catches most issues)
      if (this.isTestFile(file.filename)) return false;
      
      // Skip docs
      if (this.isDocFile(file.filename)) return false;
      
      // Skip if AST found many critical issues
      const fileCritical = astFindings.filter(
        f => f.file === file.filename && f.severity === 'critical'
      );
      if (fileCritical.length > 5) return false;
      
      return true;
    });
  }
  
  private isTestFile(filename: string): boolean {
    return /\.(test|spec)\.(ts|tsx|js|jsx|py)$/.test(filename) ||
           filename.includes('__tests__/') ||
           filename.includes('/tests/');
  }
  
  private isDocFile(filename: string): boolean {
    return /\.(md|txt|rst)$/.test(filename);
  }
  
  private estimatePromptTokens(diff: string): number {
    // Rough estimate: 1 token ≈ 4 characters
    return Math.ceil(diff.length / 4);
  }
}
```

### 5. Skip Checker

```typescript
// src/core/skip-checker.ts

import { ReviewConfig, PRContext } from '../types';

export class SkipChecker {
  constructor(private config: ReviewConfig) {}
  
  shouldSkip(pr: PRContext): string | null {
    // Skip drafts
    if (this.config.skipDrafts && pr.draft) {
      return 'PR is in draft status';
    }
    
    // Skip bots
    if (this.config.skipBots && this.isBotAuthor(pr.author)) {
      return `Author is a bot: ${pr.author}`;
    }
    
    // Skip by label
    if (this.config.skipLabels.length > 0) {
      for (const label of pr.labels) {
        if (this.config.skipLabels.includes(label)) {
          return `PR has skip label: ${label}`;
        }
      }
    }
    
    // Skip if too small
    if (this.config.minChangedLines > 0) {
      const totalLines = pr.additions + pr.deletions;
      if (totalLines < this.config.minChangedLines) {
        return `Changes (${totalLines} lines) below minimum (${this.config.minChangedLines})`;
      }
    }
    
    // Skip if too large
    if (this.config.maxChangedFiles > 0) {
      if (pr.files.length > this.config.maxChangedFiles) {
        return `Files (${pr.files.length}) exceeds maximum (${this.config.maxChangedFiles})`;
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
    
    const lower = author.toLowerCase();
    return botPatterns.some(pattern => lower.includes(pattern));
  }
}
```

### 6. Chunked Comment Poster

```typescript
// src/github/comment-poster.ts

import { Octokit } from '@octokit/rest';
import { PRContext, InlineComment } from '../types';

export class CommentPoster {
  private static readonly MAX_COMMENT_SIZE = 60000;
  
  constructor(
    private octokit: Octokit,
    private owner: string,
    private repo: string
  ) {}
  
  async postReview(
    pr: PRContext,
    summary: string,
    inlineComments: InlineComment[]
  ): Promise<void> {
    // Post inline comments first
    if (inlineComments.length > 0) {
      await this.postInlineComments(pr.number, inlineComments);
    }
    
    // Post summary (chunked if needed)
    if (summary.length > CommentPoster.MAX_COMMENT_SIZE) {
      await this.postChunkedComment(pr.number, summary);
    } else {
      await this.postComment(pr.number, summary);
    }
  }
  
  private async postChunkedComment(
    prNumber: number,
    content: string
  ): Promise<void> {
    const chunks = this.chunkContent(content);
    
    console.log(`📄 Posting ${chunks.length} comment chunks...`);
    
    for (let i = 0; i < chunks.length; i++) {
      const header = `## 📄 Review Summary (Part ${i + 1}/${chunks.length})\n\n`;
      const body = header + chunks[i];
      
      await this.postComment(prNumber, body);
      
      // Rate limit protection
      if (i < chunks.length - 1) {
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }
  }
  
  private chunkContent(content: string): string[] {
    const chunks: string[] = [];
    const maxSize = CommentPoster.MAX_COMMENT_SIZE;
    
    // Split by paragraphs
    const paragraphs = content.split('\n\n');
    let currentChunk = '';
    
    for (const para of paragraphs) {
      // Would this exceed the limit?
      if (currentChunk.length + para.length + 2 > maxSize) {
        // Save current chunk
        if (currentChunk) {
          chunks.push(currentChunk.trim());
          currentChunk = '';
        }
        
        // If single paragraph is huge, split by lines
        if (para.length > maxSize) {
          const lines = para.split('\n');
          let lineChunk = '';
          
          for (const line of lines) {
            if (lineChunk.length + line.length + 1 > maxSize) {
              chunks.push(lineChunk.trim());
              lineChunk = line + '\n';
            } else {
              lineChunk += line + '\n';
            }
          }
          
          currentChunk = lineChunk;
        } else {
          currentChunk = para + '\n\n';
        }
      } else {
        currentChunk += para + '\n\n';
      }
    }
    
    if (currentChunk.trim()) {
      chunks.push(currentChunk.trim());
    }
    
    return chunks;
  }
  
  private async postComment(
    prNumber: number,
    body: string
  ): Promise<void> {
    await this.octokit.issues.createComment({
      owner: this.owner,
      repo: this.repo,
      issue_number: prNumber,
      body,
    });
  }
  
  private async postInlineComments(
    prNumber: number,
    comments: InlineComment[]
  ): Promise<void> {
    // GitHub API requires review creation for inline comments
    const reviewComments = comments.map(c => ({
      path: c.path,
      line: c.line,
      side: c.side,
      body: c.body,
    }));
    
    await this.octokit.pulls.createReview({
      owner: this.owner,
      repo: this.repo,
      pull_number: prNumber,
      event: 'COMMENT',
      comments: reviewComments,
    });
  }
}
```

### 7. Rate Limiter

```typescript
// src/providers/rate-limiter.ts

import * as fs from 'fs/promises';
import * as path from 'path';
import * as os from 'os';

export interface RateLimitInfo {
  provider: string;
  limitedUntil: number;
  reason: string;
}

export class RateLimiter {
  private lockDir = path.join(os.tmpdir(), 'mpr-ratelimits');
  
  constructor() {
    fs.mkdir(this.lockDir, { recursive: true }).catch(() => {});
  }
  
  async isRateLimited(provider: string): Promise<boolean> {
    const lockFile = this.getLockFile(provider);
    
    try {
      const data = await fs.readFile(lockFile, 'utf8');
      const info: RateLimitInfo = JSON.parse(data);
      
      if (Date.now() < info.limitedUntil) {
        const until = new Date(info.limitedUntil).toISOString();
        console.log(`⏳ ${provider} rate-limited until ${until}`);
        return true;
      }
      
      // Expired, remove file
      await fs.unlink(lockFile).catch(() => {});
      return false;
    } catch {
      return false;
    }
  }
  
  async markRateLimited(
    provider: string,
    durationMinutes: number,
    reason: string
  ): Promise<void> {
    const lockFile = this.getLockFile(provider);
    const limitedUntil = Date.now() + durationMinutes * 60 * 1000;
    
    const info: RateLimitInfo = {
      provider,
      limitedUntil,
      reason,
    };
    
    await fs.writeFile(lockFile, JSON.stringify(info), 'utf8');
    console.log(`⏳ ${provider} rate-limited for ${durationMinutes}min: ${reason}`);
  }
  
  async clearRateLimit(provider: string): Promise<void> {
    const lockFile = this.getLockFile(provider);
    await fs.unlink(lockFile).catch(() => {});
  }
  
  private getLockFile(provider: string): string {
    const safe = provider.replace(/[^a-z0-9]/gi, '_');
    return path.join(this.lockDir, `${safe}.json`);
  }
}
```

### 8. OpenRouter Pricing Service

```typescript
// src/cost/pricing-service.ts

export interface ModelPricing {
  modelId: string;
  promptPrice: number;
  completionPrice: number;
  isFree: boolean;
}

export class PricingService {
  private cache = new Map<string, ModelPricing>();
  private cacheExpiry = 0;
  private static readonly CACHE_TTL = 3600 * 1000;
  
  constructor(private apiKey?: string) {}
  
  async getPricing(modelId: string): Promise<ModelPricing> {
    // Free models
    if (modelId.includes(':free')) {
      return {
        modelId,
        promptPrice: 0,
        completionPrice: 0,
        isFree: true,
      };
    }
    
    // Refresh cache if expired
    if (Date.now() > this.cacheExpiry) {
      await this.refreshCache();
    }
    
    return this.cache.get(modelId) || {
      modelId,
      promptPrice: 0,
      completionPrice: 0,
      isFree: false,
    };
  }
  
  private async refreshCache(): Promise<void> {
    if (!this.apiKey) {
      console.warn('No API key for pricing');
      return;
    }
    
    try {
      const response = await fetch('https://openrouter.ai/api/v1/models', {
        headers: { 'Authorization': `Bearer ${this.apiKey}` },
      });
      
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      
      const data = await response.json();
      
      for (const model of data.data || []) {
        const pricing = model.pricing || {};
        this.cache.set(model.id, {
          modelId: model.id,
          promptPrice: parseFloat(pricing.prompt || '0') * 1_000_000,
          completionPrice: parseFloat(pricing.completion || '0') * 1_000_000,
          isFree: model.id.includes(':free'),
        });
      }
      
      this.cacheExpiry = Date.now() + PricingService.CACHE_TTL;
      console.log(`✅ Loaded pricing for ${this.cache.size} models`);
    } catch (error) {
      console.warn('Failed to fetch pricing:', error);
    }
  }
}
```

---

## Implementation Timeline

### Phase 1: MVP (Weeks 1-4)

**Week 1: Foundation**
- [ ] Project setup (package.json, tsconfig, esbuild)
- [ ] Core types (all interfaces)
- [ ] Config loader with Zod
- [ ] GitHub client wrapper

**Week 2: Provider System**
- [ ] Provider base class
- [ ] Provider registry
- [ ] OpenRouter implementation
- [ ] OpenCode implementation
- [ ] Parallel execution (p-queue)

**Week 3: Analysis**
- [ ] Prompt builder
- [ ] LLM executor
- [ ] Basic synthesis
- [ ] Deduplicator

**Week 4: Integration**
- [ ] PR context loader
- [ ] Comment posting
- [ ] Inline comments
- [ ] SARIF export
- [ ] End-to-end testing

**Deliverable**: v2.0-alpha with feature parity to v1.0

---

### Phase 2: Critical Features (Weeks 5-6)

**Week 5: Essential PR #2 Features**
- [ ] Chunked comment posting
- [ ] Advanced skip filters
- [ ] AI code detection
- [ ] Test coverage hints

**Week 6: Cost & Performance**
- [ ] Rate limit tracking
- [ ] OpenRouter pricing integration
- [ ] Cost estimation
- [ ] Budget guards
- [ ] Provider rotation

**Deliverable**: v2.0-beta with all PR #2 features

---

### Phase 3: AST Analysis (Weeks 7-8)

**Week 7: AST Foundation**
- [ ] Tree-sitter integration
- [ ] Language detection
- [ ] Basic patterns (console.log, unused imports)
- [ ] Complexity analysis

**Week 8: Advanced AST**
- [ ] Type checking
- [ ] Error handling detection
- [ ] Security patterns
- [ ] Integration with LLM pipeline

**Deliverable**: v2.0-rc1 with hybrid AST+LLM

---

### Phase 4: Caching & Performance (Weeks 9-10)

**Week 9: Caching**
- [ ] Cache manager
- [ ] GitHub Actions Cache integration
- [ ] Content-based keys
- [ ] Auto-invalidation

**Week 10: Optimization**
- [ ] Incremental analysis
- [ ] Diff compression
- [ ] Smart file filtering
- [ ] Performance benchmarks

**Deliverable**: v2.0-rc2 with 10x performance

---

### Phase 5: Advanced Features (Weeks 11-12)

**Week 11: Rules Engine**
- [ ] Rule loader
- [ ] Pattern-based rules
- [ ] Natural language rules
- [ ] Built-in rule library

**Week 12: Security**
- [ ] Security scanner
- [ ] Secrets detection
- [ ] OWASP patterns
- [ ] Dependency scanning

**Deliverable**: v2.0 feature-complete

---

### Phase 6: Polish & Launch (Weeks 13-14)

**Week 13: Quality**
- [ ] >80% test coverage
- [ ] Documentation
- [ ] Examples
- [ ] Migration guide

**Week 14: Launch**
- [ ] GitHub Marketplace listing
- [ ] Blog post
- [ ] Video demo
- [ ] Hacker News launch

**Deliverable**: v2.0 stable release

---

## Production-Ready Code Examples

### Complete OpenRouter Provider

```typescript
// src/providers/openrouter.ts

import { Provider } from './base';
import { ReviewResult, TokenUsage } from '../types';
import { RateLimiter } from './rate-limiter';

export class RateLimitError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'RateLimitError';
  }
}

export class OpenRouterProvider extends Provider {
  private static readonly BASE_URL = 'https://openrouter.ai/api/v1';
  
  constructor(
    modelId: string,
    private apiKey: string,
    private rateLimiter: RateLimiter
  ) {
    super(`openrouter/${modelId}`);
    this.modelId = modelId;
  }
  
  private readonly modelId: string;
  
  async review(prompt: string, timeoutMs: number): Promise<ReviewResult> {
    const startTime = Date.now();
    
    // Check rate limit
    if (await this.rateLimiter.isRateLimited(this.name)) {
      throw new RateLimitError(`${this.name} is currently rate-limited`);
    }
    
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
            max_tokens: 2000,
          }),
          signal: controller.signal,
        }
      );
      
      if (!response.ok) {
        if (response.status === 429) {
          // Parse retry-after
          const retryAfter = response.headers.get('retry-after');
          const minutes = retryAfter ? Math.ceil(parseInt(retryAfter) / 60) : 60;
          
          await this.rateLimiter.markRateLimited(
            this.name,
            minutes,
            'HTTP 429 from OpenRouter'
          );
          
          throw new RateLimitError(`Rate limited: ${this.name}`);
        }
        
        throw new Error(`API error: ${response.status} ${response.statusText}`);
      }
      
      const data = await response.json();
      const durationSeconds = (Date.now() - startTime) / 1000;
      
      // Parse AI detection from response
      const content = data.choices[0].message.content;
      const { findings, aiLikelihood, aiReasoning } = this.parseResponse(content);
      
      return {
        content,
        findings,
        aiLikelihood,
        aiReasoning,
        usage: data.usage ? {
          promptTokens: data.usage.prompt_tokens || 0,
          completionTokens: data.usage.completion_tokens || 0,
          totalTokens: data.usage.total_tokens || 0,
        } : undefined,
        durationSeconds,
      };
    } finally {
      clearTimeout(timeout);
    }
  }
  
  private parseResponse(content: string): {
    findings: Finding[];
    aiLikelihood?: number;
    aiReasoning?: string;
  } {
    try {
      // Try to parse as JSON first
      const json = JSON.parse(content);
      
      return {
        findings: json.findings || [],
        aiLikelihood: json.ai_likelihood,
        aiReasoning: json.ai_reasoning,
      };
    } catch {
      // Fallback: plain text response
      return { findings: [] };
    }
  }
}
```

### Complete Test Coverage Analyzer

```typescript
// src/analysis/test-coverage.ts

import * as fs from 'fs';
import * as path from 'path';
import { FileChange, TestCoverageHint } from '../types';

export class TestCoverageAnalyzer {
  analyze(files: FileChange[]): TestCoverageHint[] {
    const hints: TestCoverageHint[] = [];
    
    for (const file of files) {
      if (!this.isCodeFile(file.filename)) continue;
      if (this.isTestFile(file.filename)) continue;
      
      const testFile = this.findTestFile(file.filename);
      if (!testFile) {
        hints.push({
          file: file.filename,
          suggestedTestFile: this.suggestTestFile(file.filename),
          testPattern: this.getTestPattern(file.filename),
        });
      }
    }
    
    return hints;
  }
  
  private isCodeFile(filename: string): boolean {
    const codeExts = ['.ts', '.tsx', '.js', '.jsx', '.py', '.go', '.rs'];
    return codeExts.some(ext => filename.endsWith(ext));
  }
  
  private isTestFile(filename: string): boolean {
    const patterns = [
      '.test.',
      '.spec.',
      '_test.',
      'tests/',
      '__tests__/',
      'test_',
    ];
    return patterns.some(p => filename.includes(p));
  }
  
  private findTestFile(filename: string): string | null {
    const dir = path.dirname(filename);
    const base = path.basename(filename, path.extname(filename));
    const ext = path.extname(filename);
    
    const patterns = [
      `${base}.test${ext}`,
      `${base}.spec${ext}`,
      `${base}_test${ext}`,
      `test_${base}${ext}`,
      path.join('__tests__', `${base}.test${ext}`),
    ];
    
    for (const pattern of patterns) {
      const testPath = path.join(dir, pattern);
      if (fs.existsSync(testPath)) {
        return testPath;
      }
    }
    
    return null;
  }
  
  private suggestTestFile(filename: string): string {
    const ext = path.extname(filename);
    const base = path.basename(filename, ext);
    const dir = path.dirname(filename);
    
    if (ext === '.ts' || ext === '.tsx') {
      return path.join(dir, `${base}.test.ts`);
    }
    
    if (ext === '.py') {
      return path.join(dir, `test_${base}.py`);
    }
    
    return path.join(dir, `${base}.test${ext}`);
  }
  
  private getTestPattern(filename: string): string {
    const ext = path.extname(filename);
    
    if (ext === '.ts' || ext === '.tsx') {
      return 'Jest: *.test.ts or __tests__/*.ts';
    }
    
    if (ext === '.py') {
      return 'pytest: test_*.py or *_test.py';
    }
    
    return `*.test${ext}`;
  }
}
```

---

## Testing Strategy

### Unit Tests (>80% coverage)

```typescript
// __tests__/unit/consensus.test.ts

import { ConsensusEngine } from '../../src/analysis/consensus';
import { Finding } from '../../src/types';

describe('ConsensusEngine', () => {
  it('requires minimum agreement', () => {
    const engine = new ConsensusEngine({
      minAgreement: 2,
      minSeverity: 'major',
      maxComments: 10,
    });
    
    const findings: Finding[] = [
      {
        file: 'a.ts',
        line: 10,
        severity: 'major',
        title: 'Issue A',
        message: 'Found by 2 providers',
        providers: ['p1', 'p2'],
      },
      {
        file: 'b.ts',
        line: 20,
        severity: 'major',
        title: 'Issue B',
        message: 'Found by 1 provider',
        providers: ['p1'],
      },
    ];
    
    const result = engine.filterByConsensus(findings);
    
    expect(result).toHaveLength(1);
    expect(result[0].title).toBe('Issue A');
  });
});
```

### Integration Tests

```typescript
// __tests__/integration/e2e.test.ts

import nock from 'nock';
import { ReviewOrchestrator } from '../../src/core/orchestrator';

describe('End-to-end review', () => {
  beforeEach(() => {
    nock.cleanAll();
  });
  
  it('completes full review workflow', async () => {
    // Mock GitHub API
    nock('https://api.github.com')
      .get('/repos/owner/repo/pulls/123')
      .reply(200, mockPRData)
      .get('/repos/owner/repo/pulls/123/files')
      .reply(200, mockFilesData);
    
    // Mock OpenRouter
    nock('https://openrouter.ai')
      .post('/api/v1/chat/completions')
      .reply(200, mockLLMResponse);
    
    const orchestrator = createOrchestrator();
    const result = await orchestrator.execute(123);
    
    expect(result).toBeDefined();
    expect(result.findings.length).toBeGreaterThan(0);
  });
});
```

---

## Deployment Guide

### Build Configuration

```json
{
  "scripts": {
    "build": "esbuild src/main.ts --bundle --platform=node --target=node20 --outfile=dist/index.js --sourcemap",
    "build:prod": "npm run build -- --minify",
    "test": "jest",
    "test:coverage": "jest --coverage",
    "lint": "eslint src/**/*.ts",
    "format": "prettier --write src/**/*.ts",
    "typecheck": "tsc --noEmit",
    "prepare": "npm run build:prod"
  }
}
```

### GitHub Action Definition

```yaml
# action.yml

name: 'Multi-Provider Code Review'
description: 'AI code review with ensemble voting from multiple providers'
author: 'Keith Herrington'

branding:
  icon: 'check-circle'
  color: 'blue'

inputs:
  GITHUB_TOKEN:
    description: 'GitHub token'
    required: true
  OPENROUTER_API_KEY:
    description: 'OpenRouter API key (optional)'
    required: false
  REVIEW_PROVIDERS:
    description: 'Comma-separated providers'
    required: false
  ENABLE_AI_DETECTION:
    description: 'Detect AI-generated code'
    required: false
    default: 'true'
  ENABLE_TEST_HINTS:
    description: 'Show missing test hints'
    required: false
    default: 'true'
  BUDGET_MAX_USD:
    description: 'Maximum budget in USD'
    required: false
    default: '0'

outputs:
  findings_count:
    description: 'Number of findings'
  total_cost:
    description: 'Total cost in USD'
  ai_likelihood:
    description: 'AI-generated code likelihood'

runs:
  using: 'node20'
  main: 'dist/index.js'
```

---

## Success Metrics

### Technical Targets

| Metric | v2.0 Target | World-Class |
|--------|-------------|-------------|
| False positive rate | <10% | <5% |
| Review time | <30s | <15s |
| Cost per review | <$0.01 | <$0.005 |
| Test coverage | >80% | >90% |
| Build time | <30s | <10s |

### Business Targets

| Metric | 3 Months | 6 Months | 12 Months |
|--------|----------|----------|-----------|
| GitHub stars | 200 | 1000 | 3000 |
| Installs | 100 | 1000 | 10000 |
| Rating | 4.5+ | 4.7+ | 4.8+ |

---

## Final Checklist

### Before Starting Implementation

- [ ] Review this entire document
- [ ] Confirm feature priorities
- [ ] Set up development environment
- [ ] Create GitHub repository
- [ ] Set up CI/CD pipeline

### During Implementation

- [ ] Follow the 14-week timeline
- [ ] Write tests for each module
- [ ] Document as you go
- [ ] Test with real PRs weekly
- [ ] Track progress publicly

### Before Launch

- [ ] Achieve >80% test coverage
- [ ] Complete documentation
- [ ] Create demo video
- [ ] Prepare launch materials
- [ ] Submit to GitHub Marketplace

---

## Ready to Build!

This document contains everything needed to build the best-in-class multi-provider code review tool:

✅ Complete architecture  
✅ All features from PR #2 integrated  
✅ Production-ready code examples  
✅ Clear 14-week timeline  
✅ Testing strategy  
✅ Deployment guide

**Next step**: Start with Week 1, Day 1 - Project setup!

---

**END OF SPECIFICATION**
