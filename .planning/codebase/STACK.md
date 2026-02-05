# Technology Stack

**Analysis Date:** 2026-02-04

## Languages

**Primary:**
- TypeScript 5.9.3 - All source code in `src/`
- JavaScript - Node.js runtime for CLI and GitHub Action

**Build & Config:**
- JSON - Configuration files and manifests

## Runtime

**Environment:**
- Node.js >= 20
- Platform: macOS/Linux/Windows (GitHub Actions compatible)

**Package Manager:**
- npm 10+ (inferred from package.json lock mechanism)
- Lockfile: `package-lock.json` (committed)

## Frameworks & Build Tools

**Core:**
- `@actions/core` 1.11.1 - GitHub Actions API (input/output management)
- `@actions/github` 6.0.1 - GitHub API client wrapper
- `@octokit/rest` 20.1.2 - GitHub REST API client

**Build System:**
- `esbuild` 0.25.0 - TypeScript bundling (produces `dist/index.js` and `dist/cli/index.js`)
- `typescript` 5.9.3 - Transpilation (`tsc --noEmit` for type checking)

**AST & Code Analysis:**
- `tree-sitter` 0.21.1 - Universal syntax parser engine
- `tree-sitter-typescript` 0.21.2 - TypeScript/JavaScript parser grammar
- `tree-sitter-python` 0.21.0 - Python parser grammar
- `tree-sitter-go` 0.21.0 - Go parser (optional)
- `tree-sitter-rust` 0.21.0 - Rust parser (optional)

**Testing:**
- `jest` 29.7.0 - Test runner and framework
- `ts-jest` 29.4.6 - TypeScript support for Jest

**Linting & Formatting:**
- `eslint` 8.57.1 - Code linting
- `@typescript-eslint/parser` 6.21.0 - TypeScript AST parsing for ESLint
- `@typescript-eslint/eslint-plugin` 6.21.0 - TypeScript-specific lint rules
- `prettier` 3.8.0 - Code formatting

**Testing Utilities:**
- `nock` 14.0.10 - HTTP request mocking

## Key Dependencies

**Critical:**
- `@actions/cache` 4.0.1 - GitHub Actions cache storage API (used for review result caching)
- `p-queue` 8.1.1 - Promise queue for concurrent provider execution (manages parallelism)
- `p-retry` 6.2.1 - Promise retry logic with exponential backoff (provider request retries)
- `zod` 3.23.8 - Schema validation and runtime type checking (config validation)

**Infrastructure:**
- `js-yaml` 4.1.1 - YAML parsing (for configuration files)
- `minimatch` 10.1.1 - Glob pattern matching (file inclusion/exclusion rules)

**CLI:**
- Bin entry: `mpr` command (points to `./bin/mpr`) - CLI entry point

## Configuration

**Environment:**
- Managed via `.env` file (template: `.env.example`)
- GitHub Actions: Uses `@actions/core` to read workflow inputs and convert to env vars
- Self-hosted: Native environment variables or secrets management
- Key configs required:
  - `GITHUB_TOKEN` - GitHub API authentication (required)
  - `REVIEW_PROVIDERS` - Comma-separated list of LLM providers (e.g., `openai/gpt-4,anthropic/claude-3-5-sonnet`)
  - Provider API keys (conditional): `OPENAI_API_KEY`, `ANTHROPIC_API_KEY`, `OPENROUTER_API_KEY`, etc.

**Build:**
- `tsconfig.json` - TypeScript compiler options (ES2022 target, strict mode)
- `.eslintrc.cjs` - ESLint configuration (TypeScript parser, recommended rules)
- No `.prettierrc` found (likely using default Prettier settings)

**Scripts:**
```bash
npm run build              # Build both Action and CLI bundles
npm run build:action      # Build GitHub Action (esbuild with tree-sitter exclusions)
npm run build:cli         # Build CLI tool
npm run build:prod        # Production build with minification
npm run test              # Run all tests
npm run test:coverage     # Generate coverage reports
npm run test:unit         # Unit tests only (excludes integration)
npm run benchmark          # Performance benchmarks
npm run lint              # ESLint source and tests
npm run format            # Prettier formatting
npm run format:check      # Verify formatting without changes
npm run typecheck         # Type checking only
npm run hooks:install     # Install git hooks
npm run prepare           # Pre-publish hook (runs build:prod)
```

## Platform Requirements

**Development:**
- Node.js >= 20
- npm or yarn
- Git (for version control and hooks)
- macOS/Linux recommended (tested on Darwin 25.2.0)

**Production:**
- GitHub Actions runner (uses `ubuntu-latest` by default)
- Alternative: Self-hosted Node.js 20+ runtime with `node_modules` and build artifacts
- Disk space: ~500MB for `node_modules`, ~10MB for build output
- Cache storage: Shared with GitHub Actions cache (7-day default TTL)

**Runtime Dependencies (Not in node_modules):**
- OpenCode CLI (optional, external executable) - for `opencode/` provider family
- Gemini CLI (optional, external executable) - for `gemini/` provider family

## Deployment Artifacts

**GitHub Action:**
- `dist/index.js` - Bundled Action code (esbuild output)
- `action.yml` - GitHub Action manifest
- Must be built and committed to repo (`npm run build:prod`)

**CLI Tool:**
- `dist/cli/index.js` - Bundled CLI code
- Entry point: `./bin/mpr` script
- Installable via `npm install -g` or local path reference

**Caching:**
- Uses `@actions/cache` for persistence across workflow runs
- Default TTL: 7 days (configurable via `CACHE_TTL`)
- Key format: Based on PR number, config hash, and provider list

---

*Stack analysis: 2026-02-04*
