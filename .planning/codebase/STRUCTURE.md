# Codebase Structure

**Analysis Date:** 2026-02-04

## Directory Layout

```
multi-provider-code-review/
├── .github/                    # GitHub Actions workflow
├── .planning/                  # GSD planning documents
├── bin/                        # CLI executable entry point
│   └── mpr                     # Standalone CLI executable
├── dist/                       # Build output (generated)
│   ├── index.js               # Bundled GitHub Action
│   └── cli/index.js           # Bundled CLI
├── __tests__/                 # Test suite
│   ├── unit/                  # Unit tests
│   ├── integration/           # Integration tests
│   ├── benchmarks/            # Performance benchmarks
│   └── demo/                  # Example demonstrations
├── src/                       # Source code
│   ├── main.ts               # GitHub Action entry point
│   ├── health-check.ts       # Provider health verification
│   ├── setup.ts              # Component initialization
│   ├── analysis/             # Code analysis layer
│   ├── autofix/              # Auto-fix prompt generation
│   ├── cache/                # Caching and incremental review
│   ├── cli/                  # CLI interface
│   ├── config/               # Configuration loading
│   ├── core/                 # Orchestration logic
│   ├── cost/                 # Cost tracking and pricing
│   ├── github/               # GitHub API integration
│   ├── learning/             # ML-based feedback and quiet mode
│   ├── output/               # Output formatting (markdown, SARIF, JSON)
│   ├── plugins/              # Plugin system
│   ├── providers/            # LLM provider implementations
│   ├── rules/                # Custom rule engine
│   ├── security/             # Security scanning
│   ├── server/               # HTTP server for hosting
│   ├── types/                # Shared type definitions
│   └── utils/                # Utilities (logging, validation, etc.)
├── package.json              # Dependencies and scripts
├── tsconfig.json             # TypeScript configuration
├── .eslintrc.cjs             # ESLint configuration
├── jest.config.js            # Jest test configuration
└── README.md                 # Project documentation
```

## Directory Purposes

**`src/`:**
- Purpose: All TypeScript source code for the review system
- Contains: Entry points, components, utilities, types
- Key files: `main.ts` (Action entry), `setup.ts` (dependency injection)

**`src/analysis/`:**
- Purpose: Core code analysis functionality
- Contains: LLM integration, AST analysis, consensus, filtering, context analysis
- Key files:
  - `llm/executor.ts`: Provider invocation and health checks
  - `llm/prompt-builder.ts`: Prompt construction with context
  - `ast/analyzer.ts`: Tree-sitter based syntax analysis
  - `consensus.ts`: Multi-provider agreement logic
  - `deduplicator.ts`: Remove duplicate findings
  - `finding-filter.ts`: Apply severity/agreement filters
  - `context/graph-builder.ts`: Dependency analysis
  - `path-matcher.ts`: File pattern matching and intensity

**`src/providers/`:**
- Purpose: LLM provider implementations and routing
- Contains: Abstract Provider class, specific provider implementations, registry, circuit breaker
- Key files:
  - `base.ts`: Provider interface and validation
  - `registry.ts`: Provider discovery and selection
  - `circuit-breaker.ts`: Fault tolerance mechanism
  - `openrouter.ts`, `claude-code.ts`, `gemini.ts`, `opencode.ts`: Specific implementations

**`src/core/`:**
- Purpose: Orchestration and batch processing
- Contains: Main orchestrator, batch splitting logic
- Key files:
  - `orchestrator.ts`: ReviewOrchestrator - main workflow coordinator
  - `batch-orchestrator.ts`: File batching with token awareness

**`src/cache/`:**
- Purpose: Caching and incremental review support
- Contains: Cache management, persistence, incremental analysis
- Key files:
  - `manager.ts`: CacheManager interface
  - `incremental.ts`: IncrementalReviewer for smart caching
  - `storage.ts`: File system persistence layer
  - `key-builder.ts`: Cache key generation
  - `graph-cache.ts`: Caching for dependency graphs

**`src/github/`:**
- Purpose: GitHub API integration
- Contains: PR loading, comment posting, feedback tracking, rate limiting
- Key files:
  - `client.ts`: GitHubClient wrapping Octokit
  - `pr-loader.ts`: Load PR context from GitHub
  - `comment-poster.ts`: Post inline and summary comments
  - `feedback.ts`: Track suppressed comments
  - `progress-tracker.ts`: Update status checks

**`src/output/`:**
- Purpose: Format findings for different outputs
- Contains: Markdown formatters, SARIF/JSON generators, Mermaid diagrams
- Key files:
  - `formatter-v2.ts`: Modern GitHub comment formatting
  - `sarif.ts`: SARIF report generation
  - `json.ts`: JSON export
  - `mermaid.ts`: Dependency visualizations

**`src/cli/`:**
- Purpose: Command-line interface for local review
- Contains: Git reader, CLI reviewer, terminal formatter
- Key files:
  - `index.ts`: CLI main class and command parsing
  - `git-reader.ts`: Load changes from local git repo
  - `reviewer.ts`: CLIReviewer orchestration
  - `formatter.ts`: Terminal output formatting
  - `analytics.ts`: CLI analytics reporting

**`src/config/`:**
- Purpose: Configuration loading and validation
- Contains: Config schema, loader, defaults
- Key files:
  - `loader.ts`: ConfigLoader from env/files
  - `schema.ts`: Zod schema definitions
  - `defaults.ts`: Default configuration values

**`src/utils/`:**
- Purpose: Shared utilities and helpers
- Contains: Logging, validation, diff processing, token estimation
- Key files:
  - `logger.ts`: Custom structured logger
  - `validation.ts`: Input validation helpers
  - `diff.ts`: Diff parsing and mapping
  - `token-estimation.ts`: LLM token counting
  - `parallel.ts`: Create work queue for concurrent operations

**`src/security/`:**
- Purpose: Security vulnerability scanning
- Contains: SecurityScanner for detecting security issues
- Key files:
  - `scanner.ts`: Security pattern detection

**`src/learning/`:**
- Purpose: Machine learning and feedback tracking
- Contains: Quiet mode filtering, feedback analysis
- Key files:
  - `quiet-mode.ts`: Suppress findings based on learning
  - `feedback-tracker.ts`: Store and analyze feedback

**`src/cost/`:**
- Purpose: Cost tracking and pricing
- Contains: Cost tracking, LLM pricing data
- Key files:
  - `tracker.ts`: Accumulate and enforce budget
  - `pricing.ts`: Provider pricing information

**`src/rules/`:**
- Purpose: Custom rule engine
- Contains: Rule loader and executor
- Key files:
  - `engine.ts`: RulesEngine coordinator
  - `builtin/`: Built-in rule implementations

**`__tests__/`:**
- Purpose: Test suite
- Contains:
  - `unit/`: Unit tests for individual components
  - `integration/`: Full workflow integration tests
  - `benchmarks/`: Performance benchmarks
  - `demo/`: Example demonstrations

**`src/types/index.ts`:**
- Purpose: Shared type definitions
- Contains:
  - `ReviewConfig`: Configuration interface
  - `Finding`: Code issue representation
  - `Review`: Complete review result
  - `PRContext`: Pull request context
  - `Severity`: Finding severity levels
  - `FileChange`: File modification details

**`.github/`:**
- Purpose: GitHub-specific configuration
- Contains: Workflows, action definition
- Key files: `action.yml`, workflows for CI/CD

**`bin/mpr`:**
- Purpose: CLI executable entry point
- Shebang: `#!/usr/bin/env node`
- Executes: Bundled CLI code from `dist/cli/index.js`

## Key File Locations

**Entry Points:**
- `src/main.ts`: GitHub Action entry - runs on PR events
- `src/cli/index.ts`: CLI entry - local review and analytics
- `bin/mpr`: Executable wrapper for CLI

**Configuration:**
- `src/config/loader.ts`: Load config from environment/files
- `src/types/index.ts`: ReviewConfig interface definition
- `package.json`: Dependencies and build scripts
- `tsconfig.json`: TypeScript compilation settings

**Core Logic:**
- `src/core/orchestrator.ts`: Main ReviewOrchestrator that coordinates all components
- `src/core/batch-orchestrator.ts`: File batching logic
- `src/setup.ts`: Component dependency injection

**Analysis:**
- `src/analysis/llm/executor.ts`: Provider invocation
- `src/analysis/llm/prompt-builder.ts`: Prompt generation
- `src/analysis/ast/analyzer.ts`: AST-based detection
- `src/analysis/consensus.ts`: Multi-provider agreement

**Providers:**
- `src/providers/registry.ts`: Provider discovery
- `src/providers/base.ts`: Provider interface
- `src/providers/circuit-breaker.ts`: Fault tolerance
- `src/providers/openrouter.ts`: OpenRouter implementation
- `src/providers/claude-code.ts`: Claude Code implementation

**Output:**
- `src/output/formatter-v2.ts`: GitHub comment formatting
- `src/output/sarif.ts`: SARIF report generation

**Testing:**
- `jest.config.js`: Jest configuration
- `__tests__/unit/`: Unit test files (mirror src/ structure)

## Naming Conventions

**Files:**
- `.ts` extensions for all TypeScript source
- `index.ts` for module entry points (barrel files)
- `*.test.ts` for test files
- Kebab-case for most files (e.g., `batch-orchestrator.ts`)
- camelCase for executables (e.g., `bin/mpr`)

**Directories:**
- kebab-case for all directories
- Logical grouping by feature/responsibility (not by type)
- Examples: `src/analysis/llm/`, `src/cache/`, `src/github/`

**Classes/Types:**
- PascalCase: `ReviewOrchestrator`, `FindingFilter`, `Provider`
- Suffixes for patterns: `Engine` (consensus, synthesis, rules), `Analyzer` (AST, coverage), `Scanner` (security)

**Functions:**
- camelCase: `filterHealthyProviders()`, `createBatches()`, `loadConfig()`
- Verbs for actions: `load`, `filter`, `create`, `execute`, `analyze`

**Variables:**
- camelCase: `prNumber`, `fileChanges`, `providerRegistry`
- Prefixes for clarity: `mock*` for mocks, `is*` for booleans, `get*` for accessors

## Where to Add New Code

**New Feature:**
- Primary code: `src/` organized by feature
- Tests: `__tests__/unit/` mirroring the src structure
- Config changes: `src/config/` (schema, loader, defaults)
- Example: New provider → `src/providers/newprovider.ts` + `__tests__/unit/providers/newprovider.test.ts`

**New Component/Module:**
- Create feature directory in `src/` at appropriate level
- Use barrel export via `index.ts`
- Add unit tests in `__tests__/unit/` with same path
- Example: New rule type → `src/rules/customrule.ts` + update `src/rules/engine.ts`

**Utilities:**
- Shared helpers: `src/utils/` (only true cross-cutting concerns)
- One-off functions: Keep in the module that uses them
- Examples: `src/utils/validation.ts`, `src/utils/logger.ts`

**Tests:**
- Unit tests: `__tests__/unit/` - test single components in isolation
- Integration tests: `__tests__/integration/` - test component interactions
- Benchmarks: `__tests__/benchmarks/` - performance tests
- Test naming: Match source file name, add `.test.ts`

**CLI Commands:**
- Add to `src/cli/index.ts` in the switch statement
- Implement handler as private method in CLI class
- Use GitReader for git operations, TerminalFormatter for output

**New Provider:**
1. Create `src/providers/newprovider.ts` extending Provider base class
2. Implement `review(prompt, timeoutMs)` method
3. Register in `src/providers/registry.ts` provider discovery logic
4. Add environment variable for API key
5. Add to `src/config/defaults.ts` if default provider
6. Add tests in `__tests__/unit/providers/newprovider.test.ts`

**Configuration Changes:**
1. Add field to `ReviewConfig` in `src/types/index.ts`
2. Update schema in `src/config/schema.ts`
3. Add default in `src/config/defaults.ts`
4. Handle in component that needs the setting
5. Add environment variable mapping in `src/main.ts` syncEnvFromInputs()

## Special Directories

**`.git/`:**
- Purpose: Git repository metadata
- Generated: Yes (automatic)
- Committed: No

**`node_modules/`:**
- Purpose: Installed dependencies
- Generated: Yes (npm install)
- Committed: No (in .gitignore)

**`dist/`:**
- Purpose: Bundled production JavaScript
- Generated: Yes (`npm run build:prod`)
- Committed: Yes (required for GitHub Actions)
- Contents:
  - `dist/index.js`: GitHub Action bundle
  - `dist/cli/index.js`: CLI bundle
  - `dist/*.map`: Source maps

**`.mpr-cache-*`:**
- Purpose: Test cache directories for integration tests
- Generated: Yes (test execution)
- Committed: No (in .gitignore)

**`.env` files:**
- Purpose: Local development environment variables
- Generated: No (developer creates)
- Committed: No (in .gitignore)
- Reference: `.env.example` has all required keys

**`lib/` or `src/`:**
- Project uses `src/` for source code
- Source is bundled to `dist/` for distribution

---

*Structure analysis: 2026-02-04*
