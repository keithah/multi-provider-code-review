# Multi-Provider Code Review (TypeScript v2.0)

**Status:** Phase 1 Complete ✅ | Production Ready

Hybrid AST + LLM GitHub Action that fuses multiple AI providers with consensus filtering, cost tracking, and security scanning. Now with incremental review (6x faster) and CLI mode for local development.

## Features
- **Multi-provider execution** with rotation, retries, and rate-limit awareness
- **Hybrid analysis:** fast AST heuristics + deep LLM prompts
- **Consensus-based inline comments** with severity thresholds
- **Cost estimation/tracking** and budget guardrails
- **Incremental review** (6x faster, 80% cheaper on PR updates) ⚡ NEW
- **CLI mode** for local development workflows 🚀 NEW
- **Dry-run mode** for previewing reviews without posting
- Chunked GitHub comment posting with JSON + SARIF report output
- Optional test coverage hints, AI code detection, and secrets scanning
- 85%+ test coverage with comprehensive benchmarks

## Quick Start

### GitHub Action (Production)
```yaml
name: multi-provider-review
on:
  pull_request:

jobs:
  review:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
        with:
          fetch-depth: 0  # Required for incremental review
      - uses: keithah/multi-provider-code-review@main
        with:
          GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
          PR_NUMBER: ${{ github.event.pull_request.number }}
          REVIEW_PROVIDERS: openrouter/google/gemini-2.0-flash-exp:free,openrouter/mistralai/devstral-2512:free
          INCREMENTAL_ENABLED: 'true'  # 6x faster on updates
```

### CLI Mode (Local Development)
```bash
# Install globally
npm install -g multi-provider-code-review

# Review uncommitted changes
mpr review

# Review specific commit
mpr review HEAD~1

# Review branch comparison
mpr review main..feature

# Preview without running (dry-run)
mpr review --dry-run
```

## Key Inputs

### Required
- `GITHUB_TOKEN`: token with PR read/write scope
- `PR_NUMBER`: pull request number to review

### Performance & Cost
- `INCREMENTAL_ENABLED` (default: `true`): Enable 6x faster incremental reviews
- `INCREMENTAL_CACHE_TTL_DAYS` (default: `7`): Cache lifetime for incremental reviews
- `BUDGET_MAX_USD` (default: `0`): Skip if estimated cost exceeds this amount
- `DRY_RUN` (default: `false`): Preview mode without posting to GitHub

### Providers
- `REVIEW_PROVIDERS`: Comma-separated providers (`openrouter/<model>`, `opencode/<model>`)
- `FALLBACK_PROVIDERS`: Backup providers if primary providers fail
- `PROVIDER_LIMIT` (default: `6`): Max number of providers to use
- `PROVIDER_MAX_PARALLEL` (default: `3`): Max parallel provider execution

### Filtering & Thresholds
- `INLINE_MAX_COMMENTS` (default: `5`): Maximum inline comments to post
- `INLINE_MIN_SEVERITY` (default: `major`): Minimum severity for inline comments
- `INLINE_MIN_AGREEMENT` (default: `2`): Providers required to agree
- `MIN_CHANGED_LINES` (default: `0`): Skip if below this line count
- `MAX_CHANGED_FILES` (default: `0`): Skip if over this file count
- `SKIP_LABELS`: Comma-separated labels to skip review

### Features
- `ENABLE_AST_ANALYSIS` (default: `true`): Fast AST-based analysis
- `ENABLE_SECURITY` (default: `true`): Security secrets scanning
- `ENABLE_TEST_HINTS` (default: `true`): Test coverage hints
- `ENABLE_AI_DETECTION` (default: `true`): AI-generated code detection
- `ENABLE_CACHING` (default: `true`): Cache findings for faster reviews

### Output
- `REPORT_BASENAME` (default: `multi-provider-review`): Base name for `*.json` and `*.sarif` files

## Development

### Setup
```bash
npm install
npm run hooks:install  # Install pre-commit hooks
```

### Build & Test
```bash
npm run build          # Bundle action and CLI
npm run build:prod     # Minified production build
npm run test           # All tests
npm run test:unit      # Fast unit tests only
npm run test:coverage  # Coverage report (target: 85%)
npm run benchmark      # Performance benchmarks
```

### Quality Checks
```bash
npm run lint           # ESLint
npm run format         # Prettier formatting
npm run typecheck      # TypeScript type checking
```

### Pre-commit Hook
The pre-commit hook automatically runs on every commit:
- Type checking
- Linting
- Fast unit tests
- Build verification

Skip with: `git commit --no-verify`

## Project Status

### ✅ Phase 1 Complete (Weeks 1-4)
- **Test Coverage:** 85%+ with 23 test files, 5,361 lines of test code
- **Incremental Review:** 6x faster, 80% cheaper on PR updates
- **CLI Mode:** Full local development workflow
- **Performance:** All benchmarks exceed targets by 10-100x
- **DX:** Pre-commit hooks, dry-run mode, structured logging

### ⚠️ Phase 2 In Progress (Weeks 5-10)
- Feedback learning system (basic filtering exists)
- Code graph with dependency tracking (not started)
- Auto-fix prompts (not started)
- Provider reliability tracking (not started)

### 📋 Phase 3 Planned (Weeks 11-14)
- Analytics dashboard
- Self-hosted deployment
- Enterprise features

See `DEVELOPMENT_PLAN_V2.1.md` for detailed roadmap.

## Documentation
- **[DEVELOPMENT_PLAN_V2.1.md](./DEVELOPMENT_PLAN_V2.1.md)** - Complete development roadmap and status
- **[INCREMENTAL_REVIEW.md](./INCREMENTAL_REVIEW.md)** - Incremental review system documentation
- **[scripts/README.md](./scripts/README.md)** - Development scripts and hooks
- **[__tests__/benchmarks/README.md](./__tests__/benchmarks/README.md)** - Performance benchmarking guide
