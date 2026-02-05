# Architecture

**Analysis Date:** 2026-02-04

## Pattern Overview

**Overall:** Multi-provider orchestration with layered analysis and consensus-based findings synthesis.

**Key Characteristics:**
- Multi-provider LLM routing with health checks and fallback mechanisms
- Hybrid AST + LLM analysis combining syntactic and semantic review
- Consensus engine that aggregates findings from multiple providers
- Caching layer with incremental review support for performance optimization
- Component-based composition with dependency injection pattern

## Layers

**Presentation Layer (Output):**
- Purpose: Format findings into GitHub comments, SARIF, JSON, and terminal output
- Location: `src/output/` and `src/cli/`
- Contains: MarkdownFormatter, MarkdownFormatterV2, MermaidGenerator, JSON/SARIF builders
- Depends on: Finding types and formatting utilities
- Used by: ReviewOrchestrator, CLI, GitHub integration

**Orchestration Layer (Core):**
- Purpose: Coordinate all components and execute the review workflow
- Location: `src/core/orchestrator.ts`, `src/core/batch-orchestrator.ts`
- Contains: ReviewOrchestrator (main flow), BatchOrchestrator (file batching)
- Depends on: All analysis, provider, cache, and output layers
- Used by: main.ts (GitHub Action), CLI (local review)

**Analysis Layer:**
- Purpose: Detect code issues through multiple analysis methods
- Location: `src/analysis/`
- Contains: LLM prompting and parsing, AST-based detection, consensus, deduplication, filtering
- Sub-modules:
  - `llm/`: LLMExecutor, PromptBuilder, parser for extracting findings from responses
  - `ast/`: ASTAnalyzer using tree-sitter for language-specific pattern detection
  - `context/`: GraphBuilder for dependency analysis, TestCoverageAnalyzer, ValidationDetector
  - Consensus/deduplication: ConsensusEngine, Deduplicator, FindingFilter
  - Scoring: EvidenceScorer, ImpactAnalyzer
- Depends on: Provider registry, parsing libraries
- Used by: ReviewOrchestrator

**Provider Layer:**
- Purpose: Abstract different LLM providers (Claude, Gemini, OpenCode, OpenRouter, Codex)
- Location: `src/providers/`
- Contains: Provider base class, concrete implementations, ProviderRegistry, CircuitBreaker, RateLimiter, ReliabilityTracker
- Depends on: External LLM APIs, configuration
- Used by: LLMExecutor for parallel provider invocation

**Cache Layer:**
- Purpose: Store and retrieve cached analysis results for incremental review
- Location: `src/cache/`
- Contains: CacheManager, IncrementalReviewer, CacheStorage, GraphCache, KeyBuilder
- Depends on: File system and configuration
- Used by: ReviewOrchestrator to avoid re-analyzing unchanged files

**GitHub Integration Layer:**
- Purpose: Load PR context and post comments
- Location: `src/github/`
- Contains: GitHubClient, PullRequestLoader, CommentPoster, FeedbackFilter, ProgressTracker, RateLimit handling
- Depends on: @actions/github, Octokit
- Used by: ReviewOrchestrator for GitHub Action mode

**Configuration Layer:**
- Purpose: Load and validate configuration from environment and config files
- Location: `src/config/`
- Contains: ConfigLoader, schema definitions, defaults
- Depends on: Zod validation, environment variables
- Used by: All components during initialization

**Utility Layer:**
- Purpose: Cross-cutting concerns and shared utilities
- Location: `src/utils/`
- Contains: Logger, validation, diff processing, token estimation, parallel queue, retry logic
- Used by: All layers

## Data Flow

**GitHub Action Review Flow:**

1. `main.ts` - Entry point
   - Loads configuration from environment via ConfigLoader
   - Validates required inputs (GITHUB_TOKEN, PR_NUMBER)

2. `setup.ts` - Component creation
   - Initializes all components: providers, LLM executor, cache, analyzers
   - Creates ReviewComponents object with all dependencies

3. `ReviewOrchestrator.execute(prNumber)`
   - Loads PR context via PullRequestLoader
   - Checks skip conditions (drafts, labels, file limits)
   - Builds file filters using PathMatcher and TrivialDetector

4. Incremental Review Check
   - IncrementalReviewer checks if files were already analyzed
   - Returns cached results for unchanged files
   - Proceeds with full review only for changed files

5. Batch Creation
   - BatchOrchestrator splits files into batches (respects provider limits)
   - Enables token-aware batching if configured

6. Provider Selection & Health Checks
   - ProviderRegistry discovers available providers
   - LLMExecutor.filterHealthyProviders() runs health checks
   - Selects N healthy providers based on reliability/strategy

7. Parallel Provider Invocation
   - For each batch of files:
     - PromptBuilder creates review prompt with context
     - Runs providers in parallel (respects provider limits)
     - Applies circuit breaker and rate limiting
     - Parses findings from each provider response

8. Analysis & Synthesis
   - ASTAnalyzer produces syntactic findings
   - SecurityScanner detects security issues
   - RulesEngine applies custom rules
   - ConsensusEngine requires minimum agreement between providers
   - Deduplicator removes duplicate findings
   - EvidenceScorer ranks findings by confidence
   - ImpactAnalyzer assesses change impact

9. Filtering
   - FindingFilter applies severity and agreement thresholds
   - QuietModeFilter suppresses findings based on learning
   - TrivialDetector filters formatting-only or dependency updates

10. Cost Tracking
    - CostTracker accumulates costs from all provider calls
    - Enforces budget limits if configured

11. Output & Posting
    - MarkdownFormatterV2 generates GitHub comment markdown
    - CommentPoster posts inline comments (if not dry-run)
    - Generates SARIF report for GitHub Code Scanning
    - MetricsCollector records analytics

12. Return Review Summary
    - Sets GitHub output variables (findings count, severity counts, cost)
    - Returns Review object with all findings and metrics

**CLI Review Flow:**

Similar to Action flow, but:
- GitReader loads changes from git repository instead of GitHub API
- Comments printed to terminal instead of posted to GitHub
- No GITHUB_TOKEN required
- Supports reviewing commits, branches, or uncommitted changes

**State Management:**

- Configuration is immutable singleton (loaded once in setup)
- Provider selection state maintained per batch
- Cache state is file system based (persisted between runs)
- Learning/feedback state stored in CacheStorage for continuous improvement
- Graph cache for dependency analysis results

## Key Abstractions

**Provider (Abstract):**
- Purpose: Represents an LLM provider interface
- Examples: `src/providers/claude-code.ts`, `src/providers/openrouter.ts`, `src/providers/gemini.ts`
- Pattern: Strategy pattern - each provider implements the same review interface
- Methods: review(prompt), healthCheck()

**Finding:**
- Purpose: Represents a single code issue detected
- Type defined in: `src/types/index.ts`
- Fields: file, line, severity (critical/major/minor), title, message, providers (consensus)
- Generated by: LLMExecutor (from provider responses), ASTAnalyzer, SecurityScanner, RulesEngine

**ReviewConfig:**
- Purpose: Centralized configuration for review behavior
- Type defined in: `src/types/index.ts`
- Contains: Provider settings, analysis options, output preferences, caching options
- Sources: Environment variables, config files
- Used by: All components during initialization

**ReviewComponents:**
- Purpose: Dependency injection container
- Type defined in: `src/core/orchestrator.ts`
- Contains: All initialized components (providers, analyzers, formatters, etc.)
- Created by: setup.ts
- Passed to: ReviewOrchestrator

## Entry Points

**GitHub Action:**
- Location: `src/main.ts`
- Triggers: GitHub Actions workflow on pull request events
- Responsibilities:
  - Sync environment from action inputs
  - Load configuration
  - Create components
  - Execute ReviewOrchestrator
  - Set output variables
  - Handle errors and report to GitHub

**CLI:**
- Location: `src/cli/index.ts` and `bin/mpr` (executable)
- Triggers: Manual invocation via `npm run review` or installed `mpr` command
- Responsibilities:
  - Parse command-line arguments
  - Load local git changes
  - Execute CLIReviewer
  - Format and display results in terminal

**Health Check:**
- Location: `src/health-check.ts`
- Triggers: Called before main review to verify provider availability
- Responsibilities: Filter providers to only healthy ones

## Error Handling

**Strategy:** Graceful degradation with user-friendly error messages

**Patterns:**

- **ValidationError**: Caught in main, formatted with helpful context (file paths, permissions, rate limits)
- **Provider Errors**: Caught per-provider, don't block review - contributes to health check failures
- **Timeout Errors**: Handled with retry logic via withRetry() utility, provider gets marked as unhealthy
- **RateLimitError**: Specific handling with exponential backoff using p-retry
- **FileSystem Errors**: ENOENT, EACCES caught and reported with context
- **Budget Overrun**: CostTracker prevents providers from executing if budget exceeded

## Cross-Cutting Concerns

**Logging:**
- Framework: Custom logger in `src/utils/logger.ts`
- Pattern: Structured logging with info/warn/error levels
- Usage: All components log significant operations

**Validation:**
- Framework: Zod for configuration schema
- Pattern: validateRequired(), validatePositiveInteger() utilities in `src/utils/validation.ts`
- Applied at: Config loading, input validation, type checking

**Authentication:**
- GitHub: GITHUB_TOKEN passed via environment/inputs to GitHub client
- LLM Providers: API keys stored in environment variables (OPENROUTER_API_KEY, CLAUDE_API_KEY, etc.)
- Pattern: Never logged or exposed in output

**Token Estimation:**
- Framework: `src/utils/token-estimation.ts`
- Purpose: Estimate prompt tokens to calculate costs and enable token-aware batching
- Usage: CostTracker, BatchOrchestrator

---

*Architecture analysis: 2026-02-04*
