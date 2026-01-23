# The Ultimate Multi-Provider Code Review Tool
## Complete Rewrite Blueprint

**Date**: 2026-01-21  
**Vision**: Build the best-in-class open-source multi-provider code review tool  
**Goal**: Combine the best ideas from PR-Agent, Kodus, Semgrep, and CodeRabbit with your unique multi-provider synthesis

---

## Table of Contents

1. [Vision & Philosophy](#vision--philosophy)
2. [Architecture Overview](#architecture-overview)
3. [Technology Stack](#technology-stack)
4. [Feature Set](#feature-set)
5. [Project Structure](#project-structure)
6. [Core Modules](#core-modules)
7. [Implementation Phases](#implementation-phases)
8. [Code Examples](#code-examples)
9. [Testing Strategy](#testing-strategy)
10. [Deployment Strategy](#deployment-strategy)

---

## Vision & Philosophy

### What We're Building

**The world's most accurate, cost-effective, and flexible code review tool** that combines:
- ✨ **Ensemble AI** - Multiple providers voting on issues (your unique advantage)
- 🎯 **Hybrid Analysis** - AST + LLM for best-in-class accuracy
- 💰 **Cost Optimization** - Smart caching, free-tier focus, budget controls
- 🔧 **Team Customization** - Custom rules, hierarchical config
- 🚀 **Performance** - Incremental analysis, parallel execution, smart caching
- 🔒 **Security-First** - SAST, secrets detection, dependency scanning
- 📊 **Transparency** - Full observability, cost tracking, SARIF export

### Core Principles

1. **Accuracy over Speed**: Better to be slow and right than fast and wrong
2. **Cost Conscious**: Always provide free alternatives, track costs transparently
3. **Developer Experience**: Zero-config works, advanced users get full control
4. **Open Source**: MIT license, no vendor lock-in, self-hostable
5. **Extensible**: Plugin architecture for custom providers and rules

### Competitive Positioning

```
"The only open-source code review tool with:
- Multi-provider ensemble voting
- Hybrid AST + LLM analysis
- Built-in cost optimization
- Team-customizable rules
- Enterprise-grade accuracy at startup prices"
```

---

## Architecture Overview

### High-Level Flow

```
┌─────────────────────────────────────────────────────────────┐
│                     GitHub PR Event                          │
└────────────────────┬────────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────────┐
│                  Review Orchestrator                         │
│  • Load config (hierarchical)                               │
│  • Check cache (incremental)                                │
│  • Load PR context                                          │
│  • Apply skip rules                                         │
└────────────────────┬────────────────────────────────────────┘
                     │
         ┌───────────┴───────────┐
         ▼                       ▼
┌──────────────────┐    ┌──────────────────┐
│  Fast Path       │    │  Deep Analysis   │
│  (AST + Cache)   │    │  (Multi-LLM)     │
│                  │    │                  │
│  • Tree-sitter   │    │  • Provider pool │
│  • Pattern rules │    │  • Parallel exec │
│  • Deterministic │    │  • Consensus     │
│                  │    │                  │
│  ~2s, Free       │    │  ~30s, ~$0.01   │
└────────┬─────────┘    └────────┬─────────┘
         │                       │
         └───────────┬───────────┘
                     ▼
         ┌────────────────────────┐
         │  Finding Pipeline      │
         │  • Merge AST + LLM     │
         │  • Deduplicate         │
         │  • Apply custom rules  │
         │  • Severity ranking    │
         │  • Consensus voting    │
         └───────────┬────────────┘
                     ▼
         ┌────────────────────────┐
         │  Synthesis Engine      │
         │  • Group by category   │
         │  • Priority ranking    │
         │  • Action suggestions  │
         │  • Format output       │
         └───────────┬────────────┘
                     ▼
         ┌────────────────────────┐
         │  Output Generator      │
         │  • Summary comment     │
         │  • Inline suggestions  │
         │  • SARIF report        │
         │  • Metrics dashboard   │
         └────────────────────────┘
```

### Three-Tier Analysis

```
Tier 1: Deterministic (AST + Patterns)
├── Fast: 1-2 seconds
├── Free: No API calls
├── Catches: Syntax, types, simple patterns
└── Tools: tree-sitter, custom rules

Tier 2: Ensemble LLM (Multi-Provider)
├── Medium: 20-40 seconds
├── Cost: $0.005-0.02 per review
├── Catches: Logic, architecture, best practices
└── Tools: 3-7 LLM providers with synthesis

Tier 3: Security Deep Scan (Optional)
├── Slow: 60-120 seconds
├── Cost: Free (pattern-based)
├── Catches: OWASP Top 10, secrets, dependencies
└── Tools: Custom scanners + Semgrep patterns
```

---

## Technology Stack

### Core Runtime
```typescript
{
  "runtime": "Node.js 20+",
  "language": "TypeScript 5.3+",
  "build": "esbuild (fast, single bundle)",
  "package": "npm/pnpm"
}
```

### Key Libraries

**GitHub Integration**:
- `@actions/core` - Action inputs/outputs/logging
- `@actions/github` - GitHub context
- `@octokit/rest` - GitHub API client
- `@actions/cache` - Caching API

**Parsing & Analysis**:
- `tree-sitter` - AST parsing (30+ languages)
- `tree-sitter-typescript` - TypeScript/JavaScript
- `tree-sitter-python` - Python
- `tree-sitter-go` - Go
- `tree-sitter-rust` - Rust

**Configuration & Validation**:
- `zod` - Schema validation
- `js-yaml` - YAML parsing
- `dotenv` - Environment variables

**HTTP & APIs**:
- Native `fetch` (Node 18+) - HTTP client
- `p-queue` - Concurrency control
- `p-retry` - Retry logic

**Testing**:
- `jest` - Test framework
- `@types/jest` - TypeScript types
- `nock` - HTTP mocking

**Code Quality**:
- `eslint` - Linting
- `prettier` - Formatting
- `typescript-eslint` - TypeScript rules

### Provider SDKs

```typescript
// Official SDKs (when available)
import { Anthropic } from '@anthropic-ai/sdk';
import { OpenAI } from 'openai';
import { GoogleGenerativeAI } from '@google/generative-ai';

// Custom implementations
// - OpenRouter (REST API)
// - OpenCode (CLI wrapper)
```

---

## Feature Set

### ✅ Carried Over From Current Implementation

**Core Features**:
- [x] Multi-provider execution (3-7 providers)
- [x] Synthesis of multiple reviews into one
- [x] Consensus-based inline comments
- [x] Cost tracking and budget guards
- [x] Rate limit detection and avoidance
- [x] Configurable retry logic
- [x] Parallel provider execution
- [x] YAML configuration file
- [x] SARIF export
- [x] JSON report export
- [x] Test coverage hints
- [x] OpenRouter integration
- [x] OpenCode CLI integration
- [x] Free-tier provider prioritization

### 🆕 New Features (Best-in-Class)

**Tier 1: Must-Have**:
- [ ] **Hybrid AST + LLM analysis** (Kodus-inspired)
  - Tree-sitter parsing for 30+ languages
  - Deterministic pattern matching
  - 80% faster, 90% cost reduction on simple issues
  
- [ ] **Smart caching system** (CodeRabbit-inspired)
  - File-level caching with content hashing
  - Incremental analysis (only changed files)
  - 10x faster for typical PRs
  - 90% cost savings
  
- [ ] **Diff compression** (PR-Agent-inspired)
  - Smart chunking for large PRs
  - Priority-based file selection
  - Support 10,000+ line PRs

- [ ] **Custom rules engine**
  - Pattern-based rules (AST)
  - Natural language rules (LLM)
  - Team-specific enforcement
  - Self-documenting with examples

**Tier 2: Should-Have**:
- [ ] **Security scanning**
  - SAST (static analysis)
  - Secrets detection (API keys, tokens)
  - Dependency vulnerability scanning
  - OWASP Top 10 patterns
  
- [ ] **Hierarchical configuration**
  - Organization → Repository → PR levels
  - Config inheritance with overrides
  - Shared rule libraries
  
- [ ] **Enhanced synthesis**
  - Category grouping (security, performance, style)
  - Priority scoring
  - Action item generation
  - Executive summary

- [ ] **Metrics & observability**
  - Per-provider success rates
  - Cost breakdown by category
  - Performance timings
  - Quality metrics dashboard

**Tier 3: Nice-to-Have**:
- [ ] **CLI mode** - Run locally or in any CI
- [ ] **GitHub App mode** - Zero-config installation
- [ ] **Webhook support** - Self-hosted deployments
- [ ] **Context learning** - Track accepted/rejected suggestions
- [ ] **Tech debt tracking** - Accumulate over time
- [ ] **Cross-file analysis** - Understand project structure

---

## Project Structure

```
multi-provider-review/
├── src/
│   ├── main.ts                          # Entry point
│   │
│   ├── core/
│   │   ├── orchestrator.ts              # Main workflow coordinator
│   │   ├── pipeline.ts                  # Analysis pipeline
│   │   └── context.ts                   # Review context management
│   │
│   ├── config/
│   │   ├── loader.ts                    # Load from file/env
│   │   ├── schema.ts                    # Zod schemas
│   │   ├── validator.ts                 # Validation logic
│   │   └── hierarchy.ts                 # Hierarchical merging
│   │
│   ├── providers/
│   │   ├── base.ts                      # Provider interface
│   │   ├── registry.ts                  # Provider factory
│   │   ├── openrouter.ts                # OpenRouter implementation
│   │   ├── opencode.ts                  # OpenCode CLI wrapper
│   │   ├── anthropic.ts                 # Claude (optional)
│   │   ├── openai.ts                    # GPT (optional)
│   │   └── google.ts                    # Gemini (optional)
│   │
│   ├── analysis/
│   │   ├── ast/
│   │   │   ├── analyzer.ts              # AST analysis coordinator
│   │   │   ├── parsers.ts               # Tree-sitter parsers
│   │   │   ├── patterns.ts              # Pattern matching
│   │   │   └── extractors.ts            # Feature extraction
│   │   ├── llm/
│   │   │   ├── executor.ts              # Multi-provider execution
│   │   │   ├── prompt-builder.ts        # Smart prompt construction
│   │   │   └── result-parser.ts         # Parse LLM responses
│   │   ├── synthesis.ts                 # Merge findings from all sources
│   │   ├── consensus.ts                 # Voting and agreement logic
│   │   ├── deduplicator.ts              # Remove duplicate findings
│   │   └── ranker.ts                    # Priority ranking
│   │
│   ├── rules/
│   │   ├── engine.ts                    # Rules execution engine
│   │   ├── loader.ts                    # Load rules from config
│   │   ├── pattern-matcher.ts           # AST pattern matching
│   │   ├── llm-validator.ts             # LLM-based validation
│   │   └── builtin/                     # Built-in rule library
│   │       ├── security.ts
│   │       ├── performance.ts
│   │       └── best-practices.ts
│   │
│   ├── cache/
│   │   ├── manager.ts                   # Cache coordination
│   │   ├── storage.ts                   # GitHub Actions Cache API
│   │   ├── key-builder.ts               # Cache key generation
│   │   └── invalidator.ts               # Invalidation logic
│   │
│   ├── security/
│   │   ├── scanner.ts                   # Security scan coordinator
│   │   ├── secrets.ts                   # Secrets detection
│   │   ├── dependencies.ts              # Dependency vulnerabilities
│   │   └── owasp.ts                     # OWASP Top 10 patterns
│   │
│   ├── github/
│   │   ├── client.ts                    # GitHub API wrapper
│   │   ├── pr-loader.ts                 # Load PR context
│   │   ├── comment-poster.ts            # Post review comments
│   │   ├── inline-comments.ts           # Inline suggestion posting
│   │   └── check-runs.ts                # GitHub Checks API
│   │
│   ├── output/
│   │   ├── formatter.ts                 # Format review output
│   │   ├── markdown.ts                  # Markdown generation
│   │   ├── sarif.ts                     # SARIF generation
│   │   ├── json.ts                      # JSON report
│   │   └── metrics.ts                   # Metrics dashboard
│   │
│   ├── utils/
│   │   ├── retry.ts                     # Retry logic with backoff
│   │   ├── timeout.ts                   # Timeout wrapper
│   │   ├── parallel.ts                  # Parallel execution
│   │   ├── rate-limit.ts                # Rate limit tracking
│   │   ├── cost.ts                      # Cost calculation
│   │   ├── logger.ts                    # Structured logging
│   │   └── diff.ts                      # Diff parsing/compression
│   │
│   └── types/
│       ├── index.ts                     # Core types
│       ├── config.ts                    # Configuration types
│       ├── providers.ts                 # Provider types
│       ├── findings.ts                  # Finding types
│       └── github.ts                    # GitHub types
│
├── __tests__/
│   ├── unit/                            # Unit tests
│   │   ├── config/
│   │   ├── providers/
│   │   ├── analysis/
│   │   └── utils/
│   ├── integration/                     # Integration tests
│   │   ├── e2e.test.ts
│   │   └── github-api.test.ts
│   └── fixtures/                        # Test fixtures
│       ├── configs/
│       ├── prs/
│       └── responses/
│
├── docs/
│   ├── architecture.md
│   ├── configuration.md
│   ├── custom-rules.md
│   ├── providers.md
│   └── contributing.md
│
├── scripts/
│   ├── build.ts                         # Build script
│   └── test-local.ts                    # Local testing
│
├── .github/
│   └── workflows/
│       ├── test.yml
│       ├── release.yml
│       └── dogfood.yml                  # Use on self
│
├── action.yml                           # GitHub Action definition
├── package.json
├── tsconfig.json
├── jest.config.js
├── .eslintrc.js
├── .prettierrc
├── LICENSE (MIT)
└── README.md
```

---

## Core Modules

### 1. Orchestrator (Brain)

**Purpose**: Coordinates the entire review process

```typescript
// src/core/orchestrator.ts

export class ReviewOrchestrator {
  constructor(
    private config: ReviewConfig,
    private github: GitHubClient,
    private cache: CacheManager,
    private astAnalyzer: ASTAnalyzer,
    private llmExecutor: LLMExecutor,
    private synthesis: SynthesisEngine,
    private security: SecurityScanner
  ) {}

  async execute(prNumber: number): Promise<ReviewResult> {
    // 1. Load PR context
    const pr = await this.github.loadPRContext(prNumber);
    
    // 2. Check skip conditions
    if (this.shouldSkip(pr)) {
      return this.skipWithReason(pr);
    }
    
    // 3. Check cache for unchanged files
    const cachedFiles = await this.cache.getCachedReviews(pr);
    const changedFiles = pr.files.filter(f => !cachedFiles.has(f.filename));
    
    // 4. Fast path: AST analysis (always run, super fast)
    const astFindings = await this.astAnalyzer.analyze(changedFiles);
    
    // 5. Determine which files need LLM analysis
    const needsLLM = this.filterForLLM(changedFiles, astFindings);
    
    // 6. Slow path: Multi-provider LLM (if needed)
    let llmFindings: Finding[] = [];
    if (needsLLM.length > 0) {
      llmFindings = await this.llmExecutor.analyze(needsLLM, pr.diff);
    }
    
    // 7. Security scan (optional, in parallel)
    const securityFindings = this.config.enableSecurity
      ? await this.security.scan(changedFiles)
      : [];
    
    // 8. Merge all findings
    const allFindings = [
      ...astFindings,
      ...llmFindings,
      ...securityFindings,
      ...cachedFiles.values().flat()
    ];
    
    // 9. Synthesize into final review
    const review = await this.synthesis.synthesize(allFindings, pr);
    
    // 10. Cache results
    await this.cache.saveResults(pr, review);
    
    // 11. Post to GitHub
    await this.github.postReview(pr, review);
    
    return review;
  }
  
  private shouldSkip(pr: PRContext): boolean {
    // Skip if labels match skip list
    if (pr.labels.some(l => this.config.skipLabels.includes(l))) {
      return true;
    }
    
    // Skip if too small
    if (pr.additions + pr.deletions < this.config.minChangedLines) {
      return true;
    }
    
    // Skip if too large
    if (pr.files.length > this.config.maxChangedFiles) {
      return true;
    }
    
    return false;
  }
  
  private filterForLLM(files: FileChange[], astFindings: Finding[]): FileChange[] {
    // Skip trivial files
    return files.filter(file => {
      // Skip if very small change
      if (file.additions + file.deletions < 5) return false;
      
      // Skip test files (AST catches most issues)
      if (file.filename.includes('.test.') || file.filename.includes('.spec.')) {
        return false;
      }
      
      // Skip markdown/docs
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
}
```

---

### 2. AST Analyzer (Speed)

**Purpose**: Fast, deterministic analysis using tree-sitter

```typescript
// src/analysis/ast/analyzer.ts

import Parser from 'tree-sitter';
import TypeScript from 'tree-sitter-typescript';
import Python from 'tree-sitter-python';
import { Finding, FileChange } from '../../types';

export class ASTAnalyzer {
  private parsers: Map<string, Parser> = new Map();
  
  constructor() {
    this.initializeParsers();
  }
  
  private initializeParsers() {
    // TypeScript/JavaScript
    const tsParser = new Parser();
    tsParser.setLanguage(TypeScript.typescript);
    this.parsers.set('typescript', tsParser);
    this.parsers.set('javascript', tsParser);
    
    // Python
    const pyParser = new Parser();
    pyParser.setLanguage(Python);
    this.parsers.set('python', pyParser);
    
    // Add more languages...
  }
  
  async analyze(files: FileChange[]): Promise<Finding[]> {
    const findings: Finding[] = [];
    
    for (const file of files) {
      const language = this.detectLanguage(file.filename);
      if (!language) continue;
      
      const parser = this.parsers.get(language);
      if (!parser) continue;
      
      try {
        const content = await this.getFileContent(file);
        const tree = parser.parse(content);
        
        findings.push(
          ...this.checkUnusedImports(tree, file),
          ...this.checkConsoleStatements(tree, file),
          ...this.checkComplexity(tree, file),
          ...this.checkMissingErrorHandling(tree, file),
          ...this.checkTypeAnnotations(tree, file),
        );
      } catch (error) {
        console.warn(`AST analysis failed for ${file.filename}:`, error);
      }
    }
    
    return findings;
  }
  
  private checkConsoleStatements(tree: Parser.Tree, file: FileChange): Finding[] {
    const findings: Finding[] = [];
    
    // Query for console.log/error/warn
    const query = new Parser.Query(
      tree.language,
      '(call_expression function: (member_expression object: (identifier) @obj property: (property_identifier) @prop) (#eq? @obj "console"))'
    );
    
    const matches = query.matches(tree.rootNode);
    
    for (const match of matches) {
      const node = match.captures[0].node;
      
      findings.push({
        file: file.filename,
        line: node.startPosition.row + 1,
        severity: 'major',
        title: 'Console statement in production code',
        message: 'Remove console.log/error/warn from production code',
        suggestion: '// Use proper logging library instead\nlogger.info(...);',
        provider: 'ast-analyzer',
      });
    }
    
    return findings;
  }
  
  private checkComplexity(tree: Parser.Tree, file: FileChange): Finding[] {
    const findings: Finding[] = [];
    
    // Find all function declarations
    const functions = tree.rootNode.descendantsOfType('function_declaration');
    
    for (const func of functions) {
      const complexity = this.calculateCyclomaticComplexity(func);
      
      if (complexity > 10) {
        findings.push({
          file: file.filename,
          line: func.startPosition.row + 1,
          severity: complexity > 20 ? 'critical' : 'major',
          title: `High cyclomatic complexity (${complexity})`,
          message: `Function has complexity of ${complexity}, consider refactoring (threshold: 10)`,
          suggestion: 'Break this function into smaller functions',
          provider: 'ast-analyzer',
        });
      }
    }
    
    return findings;
  }
  
  private calculateCyclomaticComplexity(node: Parser.SyntaxNode): number {
    let complexity = 1; // Base complexity
    
    // Count decision points
    const decisionNodes = [
      'if_statement',
      'while_statement',
      'for_statement',
      'case',
      'catch_clause',
      'binary_expression', // && and ||
    ];
    
    for (const descendant of node.descendants) {
      if (decisionNodes.includes(descendant.type)) {
        complexity++;
      }
    }
    
    return complexity;
  }
  
  private detectLanguage(filename: string): string | null {
    const ext = filename.split('.').pop()?.toLowerCase();
    
    const langMap: Record<string, string> = {
      'ts': 'typescript',
      'tsx': 'typescript',
      'js': 'javascript',
      'jsx': 'javascript',
      'py': 'python',
      'go': 'go',
      'rs': 'rust',
      'java': 'java',
      // Add more...
    };
    
    return langMap[ext || ''] || null;
  }
}
```

---

### 3. Multi-Provider LLM Executor (Accuracy)

**Purpose**: Run multiple providers in parallel, merge results

```typescript
// src/analysis/llm/executor.ts

import { Provider } from '../../providers/base';
import { Finding, ReviewConfig } from '../../types';
import PQueue from 'p-queue';

export class LLMExecutor {
  private providers: Provider[] = [];
  private queue: PQueue;
  
  constructor(
    providers: Provider[],
    config: ReviewConfig
  ) {
    this.providers = providers;
    this.queue = new PQueue({ concurrency: config.providerMaxParallel });
  }
  
  async analyze(files: FileChange[], diff: string): Promise<Finding[]> {
    // Build prompt
    const prompt = await this.buildPrompt(files, diff);
    
    // Execute all providers in parallel
    const results = await Promise.allSettled(
      this.providers.map(provider =>
        this.queue.add(() => this.executeProvider(provider, prompt))
      )
    );
    
    // Extract successful results
    const successful = results
      .filter((r): r is PromiseFulfilledResult<ProviderResult> => 
        r.status === 'fulfilled'
      )
      .map(r => r.value);
    
    if (successful.length === 0) {
      throw new Error('All providers failed');
    }
    
    // Extract findings from all providers
    const allFindings = successful.flatMap(r => r.result.findings || []);
    
    return allFindings;
  }
  
  private async executeProvider(
    provider: Provider,
    prompt: string
  ): Promise<ProviderResult> {
    const startTime = Date.now();
    
    try {
      const result = await withRetry(
        () => provider.review(prompt, this.config.runTimeoutSeconds * 1000),
        {
          retries: this.config.providerRetries,
          onRetry: (error, attempt) => {
            console.log(`Retry ${attempt} for ${provider.name}:`, error.message);
          },
        }
      );
      
      return {
        name: provider.name,
        status: 'success',
        result,
        durationSeconds: (Date.now() - startTime) / 1000,
      };
    } catch (error) {
      return {
        name: provider.name,
        status: 'error',
        error: error as Error,
        durationSeconds: (Date.now() - startTime) / 1000,
      };
    }
  }
  
  private async buildPrompt(files: FileChange[], diff: string): Promise<string> {
    // Smart prompt building with context compression
    return new PromptBuilder()
      .addSystemContext()
      .addFileSummary(files)
      .addDiff(diff, { maxTokens: 8000 })
      .addOutputFormat()
      .build();
  }
}
```

---

### 4. Synthesis Engine (Intelligence)

**Purpose**: Merge findings from multiple sources into coherent review

```typescript
// src/analysis/synthesis.ts

export class SynthesisEngine {
  async synthesize(findings: Finding[], pr: PRContext): Promise<Review> {
    // 1. Deduplicate similar findings
    const deduplicated = this.deduplicate(findings);
    
    // 2. Apply consensus filter
    const consensus = this.applyConsensus(deduplicated);
    
    // 3. Rank by priority
    const ranked = this.rankByPriority(consensus);
    
    // 4. Group by category
    const grouped = this.groupByCategory(ranked);
    
    // 5. Generate executive summary
    const summary = await this.generateSummary(grouped, pr);
    
    // 6. Format inline comments
    const inlineComments = this.formatInlineComments(consensus);
    
    // 7. Generate action items
    const actionItems = this.generateActionItems(grouped);
    
    return {
      summary,
      findings: ranked,
      inlineComments,
      actionItems,
      metrics: this.calculateMetrics(findings, consensus),
    };
  }
  
  private deduplicate(findings: Finding[]): Finding[] {
    // Group by (file, line, message similarity)
    const groups = new Map<string, Finding[]>();
    
    for (const finding of findings) {
      const key = `${finding.file}:${finding.line}:${this.normalize(finding.message)}`;
      
      if (!groups.has(key)) {
        groups.set(key, []);
      }
      groups.get(key)!.push(finding);
    }
    
    // Pick the best finding from each group
    return Array.from(groups.values()).map(group => {
      // If multiple providers agree, merge their findings
      if (group.length > 1) {
        return {
          ...group[0],
          providers: group.map(f => f.provider).filter(Boolean),
          confidence: group.length / this.totalProviders,
        };
      }
      return group[0];
    });
  }
  
  private applyConsensus(findings: Finding[]): Finding[] {
    // Only keep findings with minimum agreement
    return findings.filter(f => {
      const providerCount = f.providers?.length || 1;
      return providerCount >= this.config.inlineMinAgreement;
    });
  }
  
  private rankByPriority(findings: Finding[]): Finding[] {
    const severityScore = {
      critical: 100,
      major: 50,
      minor: 10,
    };
    
    return findings.sort((a, b) => {
      // Sort by: severity, then provider agreement, then line number
      const scoreA = (severityScore[a.severity] || 0) + (a.providers?.length || 0) * 10;
      const scoreB = (severityScore[b.severity] || 0) + (b.providers?.length || 0) * 10;
      
      if (scoreA !== scoreB) return scoreB - scoreA;
      return a.line - b.line;
    });
  }
  
  private groupByCategory(findings: Finding[]): Map<string, Finding[]> {
    const categories = new Map<string, Finding[]>();
    
    const categoryMap: Record<string, string> = {
      'security': /security|vulnerability|injection|xss|csrf/i,
      'performance': /performance|slow|inefficient|memory|leak/i,
      'bugs': /bug|error|exception|null|undefined/i,
      'style': /style|format|naming|convention/i,
      'best-practices': /best.practice|pattern|antipattern/i,
    };
    
    for (const finding of findings) {
      let category = 'other';
      
      for (const [cat, pattern] of Object.entries(categoryMap)) {
        if (pattern.test(finding.title) || pattern.test(finding.message)) {
          category = cat;
          break;
        }
      }
      
      if (!categories.has(category)) {
        categories.set(category, []);
      }
      categories.get(category)!.push(finding);
    }
    
    return categories;
  }
  
  private async generateSummary(
    grouped: Map<string, Finding[]>,
    pr: PRContext
  ): Promise<string> {
    const totalFindings = Array.from(grouped.values()).flat().length;
    
    if (totalFindings === 0) {
      return `## ✅ LGTM (Looks Good To Me)

This PR looks great! No significant issues found.

**Analysis Summary:**
- Files reviewed: ${pr.files.length}
- Lines changed: +${pr.additions}/-${pr.deletions}
- Providers consulted: ${this.providers.length}
`;
    }
    
    // Generate category summaries
    const summaries: string[] = [];
    
    for (const [category, findings] of grouped.entries()) {
      const critical = findings.filter(f => f.severity === 'critical').length;
      const major = findings.filter(f => f.severity === 'major').length;
      const minor = findings.filter(f => f.severity === 'minor').length;
      
      summaries.push(
        `**${this.capitalize(category)}**: ${critical} critical, ${major} major, ${minor} minor`
      );
    }
    
    return `## Code Review Summary

Found ${totalFindings} issue(s) across ${grouped.size} categories:

${summaries.join('\n')}

**Analysis Summary:**
- Files reviewed: ${pr.files.length}
- Lines changed: +${pr.additions}/-${pr.deletions}
- Providers consulted: ${this.providers.length}
`;
  }
}
```

---

### 5. Smart Cache Manager (Performance)

**Purpose**: Cache review results to avoid redundant analysis

```typescript
// src/cache/manager.ts

import * as cache from '@actions/cache';
import crypto from 'crypto';

export class CacheManager {
  async getCachedReviews(pr: PRContext): Promise<Map<string, Finding[]>> {
    const cached = new Map<string, Finding[]>();
    
    for (const file of pr.files) {
      const key = this.buildCacheKey(file);
      
      try {
        const restored = await cache.restoreCache([key], key);
        if (restored) {
          const findings = await this.loadFindings(key);
          cached.set(file.filename, findings);
        }
      } catch (error) {
        console.warn(`Cache restore failed for ${file.filename}`);
      }
    }
    
    return cached;
  }
  
  async saveResults(pr: PRContext, review: Review): Promise<void> {
    // Group findings by file
    const byFile = new Map<string, Finding[]>();
    
    for (const finding of review.findings) {
      if (!byFile.has(finding.file)) {
        byFile.set(finding.file, []);
      }
      byFile.get(finding.file)!.push(finding);
    }
    
    // Save each file's findings to cache
    for (const [filename, findings] of byFile.entries()) {
      const file = pr.files.find(f => f.filename === filename);
      if (!file) continue;
      
      const key = this.buildCacheKey(file);
      await this.saveFindings(key, findings);
    }
  }
  
  private buildCacheKey(file: FileChange): string {
    // Cache key includes:
    // - File content hash
    // - Config hash (rules, severity thresholds)
    // - Provider versions
    
    const contentHash = crypto
      .createHash('sha256')
      .update(file.patch || '')
      .digest('hex');
    
    const configHash = crypto
      .createHash('sha256')
      .update(JSON.stringify(this.config))
      .digest('hex');
    
    return `review-v1-${file.filename}-${contentHash}-${configHash}`;
  }
  
  private async loadFindings(key: string): Promise<Finding[]> {
    // Load from GitHub Actions cache
    const path = `/tmp/cache/${key}.json`;
    const data = await fs.readFile(path, 'utf8');
    return JSON.parse(data);
  }
  
  private async saveFindings(key: string, findings: Finding[]): Promise<void> {
    const path = `/tmp/cache/${key}.json`;
    await fs.writeFile(path, JSON.stringify(findings), 'utf8');
    await cache.saveCache([path], key);
  }
}
```

---

## Implementation Phases

### Phase 1: MVP (Weeks 1-4)

**Goal**: Working TypeScript action with core features

**Week 1: Foundation**
- [ ] Project setup (TypeScript, esbuild, Jest)
- [ ] Core types and interfaces
- [ ] Config loader with Zod validation
- [ ] GitHub API client wrapper

**Week 2: Provider System**
- [ ] Provider base class and registry
- [ ] OpenRouter provider
- [ ] OpenCode provider
- [ ] Parallel execution with p-queue

**Week 3: Analysis Pipeline**
- [ ] Prompt builder
- [ ] LLM executor
- [ ] Basic synthesis (concat findings)
- [ ] Finding deduplication

**Week 4: GitHub Integration**
- [ ] PR context loading
- [ ] Comment posting (chunked)
- [ ] Inline comments
- [ ] SARIF export

**Deliverable**: v2.0-alpha - Feature parity with v1

---

### Phase 2: Hybrid Analysis (Weeks 5-7)

**Goal**: Add AST analysis for speed and accuracy

**Week 5: AST Foundation**
- [ ] Tree-sitter integration
- [ ] Language detection
- [ ] Basic AST patterns (console.log, unused imports)

**Week 6: Advanced AST**
- [ ] Complexity analysis
- [ ] Type checking (TypeScript)
- [ ] Error handling detection
- [ ] Security patterns

**Week 7: Integration**
- [ ] AST + LLM pipeline
- [ ] Smart file filtering (skip LLM when AST finds issues)
- [ ] Performance benchmarking

**Deliverable**: v2.0-beta - Hybrid AST+LLM

---

### Phase 3: Performance (Weeks 8-9)

**Goal**: Add caching and incremental analysis

**Week 8: Caching**
- [ ] Cache manager implementation
- [ ] File content hashing
- [ ] GitHub Actions Cache integration
- [ ] Cache invalidation

**Week 9: Incremental**
- [ ] Changed file detection
- [ ] Diff compression
- [ ] Smart chunking for large PRs

**Deliverable**: v2.0-rc - Production-ready

---

### Phase 4: Advanced Features (Weeks 10-12)

**Goal**: Custom rules and security scanning

**Week 10: Rules Engine**
- [ ] Rule loader and validator
- [ ] Pattern-based rules (AST)
- [ ] Natural language rules (LLM)
- [ ] Built-in rule library

**Week 11: Security**
- [ ] Secrets detection
- [ ] OWASP patterns
- [ ] Dependency scanning
- [ ] SARIF security categories

**Week 12: Polish**
- [ ] Enhanced synthesis
- [ ] Metrics dashboard
- [ ] Documentation
- [ ] GitHub Marketplace listing

**Deliverable**: v2.0 - Full release

---

## Code Examples

### Main Entry Point

```typescript
// src/main.ts

import * as core from '@actions/core';
import { ReviewOrchestrator } from './core/orchestrator';
import { ConfigLoader } from './config/loader';
import { ProviderRegistry } from './providers/registry';
import { GitHubClient } from './github/client';
import { CacheManager } from './cache/manager';
import { ASTAnalyzer } from './analysis/ast/analyzer';
import { LLMExecutor } from './analysis/llm/executor';
import { SynthesisEngine } from './analysis/synthesis';
import { SecurityScanner } from './security/scanner';

async function run(): Promise<void> {
  try {
    // Load configuration
    const config = ConfigLoader.load();
    
    // Initialize components
    const github = new GitHubClient(
      process.env.GITHUB_TOKEN!,
      process.env.GITHUB_REPOSITORY!
    );
    
    const cache = new CacheManager(config);
    const astAnalyzer = new ASTAnalyzer();
    
    const providers = ProviderRegistry.createProviders(config);
    const llmExecutor = new LLMExecutor(providers, config);
    
    const synthesis = new SynthesisEngine(config, providers.length);
    const security = new SecurityScanner(config);
    
    // Create orchestrator
    const orchestrator = new ReviewOrchestrator(
      config,
      github,
      cache,
      astAnalyzer,
      llmExecutor,
      synthesis,
      security
    );
    
    // Execute review
    const prNumber = parseInt(core.getInput('PR_NUMBER'), 10);
    const result = await orchestrator.execute(prNumber);
    
    // Set outputs
    core.setOutput('findings_count', result.findings.length);
    core.setOutput('critical_count', result.metrics.critical);
    core.setOutput('estimated_cost', result.metrics.estimatedCost);
    
    console.log('✅ Review completed successfully');
  } catch (error) {
    core.setFailed(`Review failed: ${(error as Error).message}`);
  }
}

run();
```

### Provider Registry

```typescript
// src/providers/registry.ts

import { Provider } from './base';
import { OpenRouterProvider } from './openrouter';
import { OpenCodeProvider } from './opencode';
import { ReviewConfig } from '../types';

export class ProviderRegistry {
  static createProviders(config: ReviewConfig): Provider[] {
    const providers: Provider[] = [];
    
    for (const name of config.providers) {
      if (!Provider.validate(name)) {
        console.warn(`Invalid provider name: ${name}`);
        continue;
      }
      
      try {
        const provider = this.createProvider(name, config);
        providers.push(provider);
      } catch (error) {
        console.warn(`Failed to create provider ${name}:`, error);
      }
    }
    
    if (providers.length === 0) {
      throw new Error('No valid providers configured');
    }
    
    return providers;
  }
  
  private static createProvider(name: string, config: ReviewConfig): Provider {
    if (name.startsWith('openrouter/')) {
      const modelId = name.replace('openrouter/', '');
      return new OpenRouterProvider(modelId, process.env.OPENROUTER_API_KEY!);
    }
    
    if (name.startsWith('opencode/')) {
      const modelId = name.replace('opencode/', '');
      return new OpenCodeProvider(modelId);
    }
    
    throw new Error(`Unknown provider type: ${name}`);
  }
}
```

---

## Testing Strategy

### Unit Tests (>80% coverage)

```typescript
// __tests__/unit/analysis/consensus.test.ts

describe('ConsensusEngine', () => {
  it('should require minimum agreement', () => {
    const engine = new ConsensusEngine({ minAgreement: 2 });
    
    const findings: Finding[] = [
      { file: 'a.ts', line: 10, severity: 'major', title: 'Issue A', message: '', provider: 'p1' },
      { file: 'a.ts', line: 10, severity: 'major', title: 'Issue A', message: '', provider: 'p2' },
      { file: 'b.ts', line: 20, severity: 'major', title: 'Issue B', message: '', provider: 'p1' },
    ];
    
    const result = engine.applyConsensus(findings);
    
    // Only Issue A should pass (2 providers agreed)
    expect(result).toHaveLength(1);
    expect(result[0].title).toBe('Issue A');
  });
  
  it('should filter by severity threshold', () => {
    const engine = new ConsensusEngine({ minSeverity: 'major' });
    
    const findings: Finding[] = [
      { file: 'a.ts', line: 10, severity: 'critical', title: 'C', message: '', provider: 'p1', providers: ['p1'] },
      { file: 'a.ts', line: 20, severity: 'major', title: 'M', message: '', provider: 'p1', providers: ['p1'] },
      { file: 'a.ts', line: 30, severity: 'minor', title: 'm', message: '', provider: 'p1', providers: ['p1'] },
    ];
    
    const result = engine.applyConsensus(findings);
    
    // Should have critical and major, not minor
    expect(result).toHaveLength(2);
    expect(result.some(f => f.severity === 'minor')).toBe(false);
  });
});
```

### Integration Tests

```typescript
// __tests__/integration/e2e.test.ts

describe('End-to-end review', () => {
  it('should complete full review workflow', async () => {
    // Mock GitHub API
    nock('https://api.github.com')
      .get('/repos/owner/repo/pulls/123')
      .reply(200, mockPRData);
    
    // Mock provider responses
    nock('https://openrouter.ai')
      .post('/api/v1/chat/completions')
      .reply(200, mockLLMResponse);
    
    // Run review
    const orchestrator = createOrchestrator();
    const result = await orchestrator.execute(123);
    
    // Assertions
    expect(result.findings.length).toBeGreaterThan(0);
    expect(result.summary).toContain('Code Review Summary');
    expect(result.inlineComments.length).toBeLessThanOrEqual(5);
  });
});
```

---

## Deployment Strategy

### Build Process

```json
{
  "scripts": {
    "build": "esbuild src/main.ts --bundle --platform=node --target=node20 --outfile=dist/index.js --sourcemap",
    "build:prod": "npm run build -- --minify --legal-comments=none",
    "test": "jest",
    "lint": "eslint src/**/*.ts",
    "typecheck": "tsc --noEmit",
    "prepare": "npm run build:prod"
  }
}
```

### GitHub Action Definition

```yaml
# action.yml

name: 'Multi-Provider Code Review'
description: 'AI-powered code review with ensemble wisdom from multiple providers'
author: 'Keith Herrington'

branding:
  icon: 'check-circle'
  color: 'blue'

inputs:
  GITHUB_TOKEN:
    description: 'GitHub token for API access'
    required: true
  REVIEW_PROVIDERS:
    description: 'Comma-separated list of providers'
    required: false
    default: 'openrouter/google/gemini-2.0-flash-exp:free,opencode/big-pickle'
  SYNTHESIS_MODEL:
    description: 'Model for synthesis'
    required: false
    default: 'openrouter/google/gemini-2.0-flash-exp:free'
  OPENROUTER_API_KEY:
    description: 'OpenRouter API key (optional)'
    required: false
  # ... other inputs

outputs:
  findings_count:
    description: 'Number of findings'
  critical_count:
    description: 'Number of critical issues'
  estimated_cost:
    description: 'Estimated cost in USD'

runs:
  using: 'node20'
  main: 'dist/index.js'
```

### Release Process

```yaml
# .github/workflows/release.yml

name: Release

on:
  push:
    tags:
      - 'v*'

jobs:
  release:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      
      - uses: actions/setup-node@v4
        with:
          node-version: '20'
      
      - run: npm ci
      - run: npm run build:prod
      - run: npm test
      
      - name: Create Release
        uses: actions/create-release@v1
        env:
          GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
        with:
          tag_name: ${{ github.ref }}
          release_name: Release ${{ github.ref }}
          draft: false
          prerelease: false
```

---

## Success Metrics

### Technical Metrics

| Metric | Target (v2.0) | World-Class |
|--------|---------------|-------------|
| False positive rate | <10% | <5% |
| Review time (avg) | <30s | <15s |
| Cost per review | <$0.01 | <$0.005 |
| Test coverage | >80% | >90% |
| Build time | <30s | <10s |

### Business Metrics

| Metric | 3 Months | 6 Months | 12 Months |
|--------|----------|----------|-----------|
| GitHub stars | 200 | 1000 | 3000 |
| Active installs | 100 | 1000 | 10000 |
| Marketplace rating | 4.5+ | 4.7+ | 4.8+ |
| Contributors | 5 | 15 | 30 |

---

## Go-to-Market Plan

### Launch Strategy

**Week 1-2: Soft Launch**
- [ ] Release v2.0-alpha to early testers
- [ ] Post on personal Twitter/LinkedIn
- [ ] Share in 2-3 Discord communities

**Week 3-4: Public Launch**
- [ ] Publish to GitHub Marketplace
- [ ] Post on Hacker News ("Show HN")
- [ ] Post on Reddit (r/github, r/programming)
- [ ] Write blog post on architecture

**Week 5-8: Content Marketing**
- [ ] Comparison with CodeRabbit (cost savings)
- [ ] Technical deep-dive (AST + LLM hybrid)
- [ ] Case study (before/after on popular repo)
- [ ] Video tutorial

**Week 9-12: Community Building**
- [ ] GitHub Discussions for support
- [ ] Discord server
- [ ] Monthly contributor calls
- [ ] Recognize top contributors

### Positioning

**Primary Message**:
> "The only open-source code review tool with multi-provider ensemble voting, hybrid AST+LLM analysis, and built-in cost optimization"

**Target Personas**:
1. **Bootstrapped Startups** - "Enterprise quality, startup budget"
2. **Open Source Maintainers** - "Free, powerful, self-hosted"
3. **Security Teams** - "SAST, secrets detection, compliance-ready"
4. **Large Teams** - "Customizable rules, hierarchical config"

---

## Conclusion

This blueprint gives you everything you need to build the best-in-class multi-provider code review tool:

✅ **Clear vision** - Ensemble AI with hybrid analysis  
✅ **Proven architecture** - Best ideas from all competitors  
✅ **Detailed implementation** - Modules, code examples, tests  
✅ **Realistic timeline** - 12 weeks to v2.0 full release  
✅ **Go-to-market plan** - How to get users and grow

**Your competitive advantages**:
1. Multi-provider synthesis (no one else has this)
2. MIT license (truly open source)
3. Cost optimization (free-tier focus)
4. Hybrid AST+LLM (best accuracy)

**Next steps**:
1. Review this blueprint
2. Set up TypeScript project (Day 1)
3. Start with Phase 1: MVP (Weeks 1-4)
4. Ship v2.0-alpha and get feedback

Ready to build the future of code review? 🚀

---

**End of Rewrite Blueprint**
