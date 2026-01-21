# Multi-Provider Code Review (TypeScript v2)

Hybrid AST + LLM GitHub Action that fuses multiple AI providers with consensus filtering, cost tracking, and security scanning.

## Features
- Multi-provider execution with rotation, retries, and rate-limit awareness
- Hybrid analysis: fast AST heuristics + deep LLM prompts
- Consensus-based inline comments with severity thresholds
- Cost estimation/tracking and budget guardrails
- Chunked GitHub comment posting with JSON + SARIF report output
- Optional test coverage hints, AI code detection, and secrets scanning

## Quick Start
```yaml
name: multi-provider-review
on:
  pull_request:

jobs:
  review:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: keithah/multi-provider-code-review@ts-rewrite
        with:
          GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
          PR_NUMBER: ${{ github.event.pull_request.number }}
          REVIEW_PROVIDERS: openrouter/google/gemini-2.0-flash-exp:free,openrouter/mistralai/devstral-2512:free
```

## Key Inputs
- `GITHUB_TOKEN` (required): token with PR read/write scope
- `PR_NUMBER` (required): pull request number to review
- `REVIEW_PROVIDERS`: comma-separated providers (`openrouter/<model>`, `opencode/<model>`)
- `INLINE_MAX_COMMENTS`, `INLINE_MIN_SEVERITY`, `INLINE_MIN_AGREEMENT`
- `MIN_CHANGED_LINES`, `MAX_CHANGED_FILES`, `SKIP_LABELS`
- `BUDGET_MAX_USD`: skip if estimated cost exceeds this amount
- `ENABLE_AST_ANALYSIS`, `ENABLE_SECURITY`, `ENABLE_TEST_HINTS`, `ENABLE_AI_DETECTION`
- `REPORT_BASENAME`: base name for generated `*.json` and `*.sarif`

## Development
```bash
npm install
npm run build        # bundle to dist/index.js
npm run test         # jest
npm run lint         # eslint
npm run typecheck    # tsc --noEmit
```

The implementation follows `FINAL_SPECIFICATION.md` and `FINAL_IMPLEMENTATION_GUIDE.md` for architecture and feature scope.
