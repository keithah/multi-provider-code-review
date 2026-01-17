# Multi-Provider Code Review GitHub Action

[![GitHub Action](https://img.shields.io/badge/GitHub%20Action-blue.svg)](https://github.com/keithah/multi-provider-code-review) [![License](https://img.shields.io/badge/License-MIT-green.svg)](https://opencode.ai)

Run comprehensive code reviews with multiple providers (OpenRouter-first) and synthesize the results into one actionable review. If no OpenRouter key is available, the action automatically falls back to bundled free models.

## Features

- Multi-provider coverage: OpenRouter-first providers with automatic fallback to bundled free models when no key is present
- Intelligent synthesis: combines overlapping feedback, highlights unique insights, and posts a single review
- Inline commenting: structured findings are posted inline (severity-gated) plus a summary comment
- Exports: writes JSON and SARIF reports for downstream tooling or code scanning upload
- Triggers: supports auto-on-PR changes plus manual `/review`, `@opencode`, or `@claude`
- Clean integration: single composite action that builds prompts, runs providers, synthesizes, and posts results
- Inline and consensus: inline suggestions post only when severity meets thresholds, multiple providers agree (configurable), and a suggestion/hunk is present
- Resilient posting: summary comments are chunked if large and API calls retry with backoff; JSON/SARIF reports capture timings and truncation status

## Quick Start

### Prerequisites

- GitHub-hosted runners (or self-hosted with Node.js/npm available)
- OpenCode CLI (installed automatically via npm in the workflow template if missing)
- GitHub CLI is already available on `ubuntu-latest` runners
- Python on the runner (used to build/parse JSON for OpenRouter; `python` must be on PATH)
- Optional: `OPENROUTER_API_KEY` if you want to run OpenRouter-hosted models (recommended default)

### Add to your repo

```bash
# In your existing repository
mkdir -p .github/workflows
curl -o .github/workflows/multi-provider-review.yml https://raw.githubusercontent.com/keithah/multi-provider-code-review/main/action-simple.yml

# Commit and push
git add .github/workflows/multi-provider-review.yml
git commit -m "Add multi-provider code review action"
git push origin main
```

### Required Permissions

Your workflow needs these permissions:

```yaml
permissions:
  contents: read
  pull-requests: write
```

## Configuration

### Repository Variables

| Variable              | Default                                                                                     | Description                                                                                   |
| --------------------- | ------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------- |
| `REVIEW_PROVIDERS`    | `openrouter/google/gemini-2.0-flash-exp:free,openrouter/mistralai/devstral-2512:free,openrouter/xiaomi/mimo-v2-flash:free` | Comma-separated list of providers (OpenRouter-first). If no `OPENROUTER_API_KEY`, the action automatically falls back to bundled free models. |
| `SYNTHESIS_MODEL`     | `openrouter/google/gemini-2.0-flash-exp:free`                                               | Model used to synthesize outputs; falls back to `opencode/big-pickle` when OpenRouter key is absent. |
| `DIFF_MAX_BYTES`      | `120000`                                                                                    | Max diff bytes to include                                                                     |
| `RUN_TIMEOUT_SECONDS` | `600`                                                                                       | Per-model timeout in seconds                                                                  |
| `OPENROUTER_API_KEY`  | _unset_                                                                                     | Optional key for OpenRouter models                                                            |
| `INLINE_MAX_COMMENTS` | `5`                                                                                         | Max inline review comments from structured findings                                           |
| `INLINE_MIN_SEVERITY` | `major`                                                                                     | Minimum severity to post inline (`critical`, `major`, `minor`)                                |
| `INLINE_MIN_AGREEMENT`| `1`                                                                                         | Minimum number of providers that must agree before posting inline suggestions                 |
| `REPORT_BASENAME`     | `multi-provider-review`                                                                     | Base filename for exported JSON/SARIF reports                                                 |

### Inputs wired by the workflow template

The provided workflow (`action-simple.yml`) resolves and passes these to the composite action:

| Input          | Source                 | Description                       |
| -------------- | ---------------------- | --------------------------------- |
| `GITHUB_TOKEN` | `secrets.GITHUB_TOKEN` | GitHub token for API access       |
| `PR_TITLE`     | PR metadata            | Pull request title                |
| `PR_NUMBER`    | PR metadata            | Pull request number               |
| `PR_BODY`      | PR metadata            | Pull request description          |
| `HAS_AGENTS`   | Local check            | Whether `AGENTS.md` exists        |
| `SYNTHESIS_MODEL` | Optional input      | Override synthesis model          |
| `DIFF_MAX_BYTES`  | Optional input      | Override diff truncation limit    |

## Usage

### Automatic Triggers

The action runs automatically on:

- **New pull requests**: When a PR is opened
- **PR updates**: When a PR is updated (synchronize)
- **PR reopens**: When a closed PR is reopened

### Manual Triggers

Trigger a review manually:

```bash
# Comment on a PR
/review

# Or mention
@opencode or @claude
```

### Choose your trigger mode

- **Auto + manual (default)**: Keep both `pull_request` and `issue_comment` blocks.
- **Manual only**: Remove the `pull_request` block.
- **Auto only**: Remove the `issue_comment` block or narrow the `if` filter.

## How It Works

### Architecture

```
┌─────────────────────────────────────┐
│  GitHub Action Trigger              │
└─────────────┬──────────────────┘
              │
              ▼
┌─────────────────────────────────────┐
│  Multi-Provider Composite Action    │
└─────────────┬──────────────────┘
              │
              ▼
┌─────────────────────────────────────┐
│  Provider Runs                      │
│  - OpenRouter models (if keyed)     │
│  - Bundled fallback models          │
└─────────────┬──────────────────┘
              │
              ▼
┌─────────────────────────────────────┐
│  Synthesis                          │
│  - Merge findings                   │
│  - Apply severity gating            │
└─────────────┬──────────────────┘
              │
              ▼
┌─────────────────────────────────────┐
│  Output                             │
│  - PR summary comment               │
│  - Inline comments (structured)     │
│  - JSON + SARIF reports             │
└─────────────────────────────────────┘
```

### Process Flow

1. **Setup**: Action receives PR details (title, number, body)
2. **Prompt Building**: Assembles PR title/body, optional `AGENTS.md`, changed file summary, and PR diff (truncated if huge)
3. **Provider Runs**: Calls the configured providers in `REVIEW_PROVIDERS`
4. **Synthesis**: Uses the configured synthesis model to combine provider outputs into one review
5. **GitHub Comment**: Posts the synthesized review to the PR and attaches raw provider outputs in a collapsed section
6. **Inline Suggestions**: Posts inline suggestions when findings meet severity, agreement, and evidence thresholds

### Reports and artifacts

- The action writes reports to `multi-provider-report/` (relative to the workspace):
  - `${REPORT_BASENAME}.json` — normalized providers, findings, and metadata
  - `${REPORT_BASENAME}.sarif` — SARIF v2.1.0 generated from structured findings
- To persist them as workflow artifacts, add a step after the action:
  ```yaml
  - uses: actions/upload-artifact@v4
    with:
      name: code-review-reports
      path: multi-provider-report/*
  ```
- To publish SARIF to code scanning, grant `security-events: write` and upload:
  ```yaml
  - name: Upload SARIF to code scanning
    uses: github/codeql-action/upload-sarif@v3
    with:
      sarif_file: multi-provider-report/multi-provider-review.sarif
  ```

### Providers

Each provider is run directly via OpenCode CLI using the list from `REVIEW_PROVIDERS`.

## Available Providers

**Recommended OpenRouter free (needs `OPENROUTER_API_KEY`)**
| Provider                                           | Role/Notes                                   |
| -------------------------------------------------- | -------------------------------------------- |
| `openrouter/google/gemini-2.0-flash-exp:free`      | Fast/light Gemini general reasoning          |
| `openrouter/mistralai/devstral-2512:free`          | Solid code + reasoning (Mistral)             |
| `openrouter/xiaomi/mimo-v2-flash:free`             | Fast passes, lightweight                     |
| `openrouter/z-ai/glm-4.5-air:free`                 | Strong general/code                          |
| `openrouter/qwen/qwen3-coder:free`                 | Code-focused                                 |
| `openrouter/google/gemma-3-27b-it:free`            | Larger Gemma instruct                        |
| `openrouter/meta-llama/llama-3.3-70b-instruct:free`| Strong but heavier/slower                    |
| `openrouter/nousresearch/hermes-3-llama-3.1-405b:free` | Very heavy, high-quality reasoning       |
| `openrouter/cognitivecomputations/dolphin-mistral-24b-venice-edition:free` | Good coding/reasoning balance |
| `openrouter/tngtech/deepseek-r1t-chimera:free`     | CoT/analysis oriented (heavier)              |

**Bundled fallback (no key required; auto-used when `OPENROUTER_API_KEY` is missing)**
| Provider                     | Style/Strength          | Notes                  |
| ---------------------------- | ----------------------- | ---------------------- |
| `opencode/big-pickle`        | Large reasoning         | Fallback synthesis model |
| `opencode/grok-code`         | Code-specialized        | Quality-focused        |
| `opencode/minimax-m2.1-free` | General/free tier       | Lightweight            |
| `opencode/glm-4.7-free`      | GLM-based, generalist   | Creative/expressive    |

### Adding Custom Providers

Add your own provider to the list:

```yaml
env:
  REVIEW_PROVIDERS: "opencode/big-pickle,opencode/grok-code,your-custom-provider"
```

Or add premium providers (requires API keys):

```yaml
env:
  REVIEW_PROVIDERS: "anthropic/claude-3.5-sonnet,openai/gpt-4-turbo"
```

## Advanced Configuration

### Provider and synthesis models

```yaml
env:
  REVIEW_PROVIDERS: "openrouter/google/gemini-2.0-flash-exp:free,openrouter/mistralai/devstral-2512:free,openrouter/xiaomi/mimo-v2-flash:free"
  SYNTHESIS_MODEL: "openrouter/google/gemini-2.0-flash-exp:free"   # optional override
  DIFF_MAX_BYTES: "120000"                                        # optional diff truncation size
  RUN_TIMEOUT_SECONDS: "600"                                      # optional per-model timeout
  OPENROUTER_API_KEY: "${{ secrets.OPENROUTER_API_KEY }}"         # recommended for openrouter/*

If `OPENROUTER_API_KEY` is unset, the action automatically swaps in the fallback bundled models above.

### Using OpenRouter providers

1. Create a repo/org secret `OPENROUTER_API_KEY`.
2. Set `REVIEW_PROVIDERS` and (optionally) `SYNTHESIS_MODEL` to your preferred OpenRouter models, prefixed with `openrouter/`.
3. The action routes `openrouter/*` entries via the OpenRouter Chat Completions API; when the key is missing, it silently falls back to the bundled free models so runs still succeed.

### Optional repo config file

You can set defaults in `.github/multi-review.yml` (YAML or JSON). Fields:

```yaml
providers:
  - openrouter/google/gemini-2.0-flash-exp:free
  - openrouter/mistralai/devstral-2512:free
  - openrouter/xiaomi/mimo-v2-flash:free
synthesis_model: openrouter/google/gemini-2.0-flash-exp:free
inline_max_comments: 5
inline_min_severity: major
inline_min_agreement: 2   # require consensus across providers
diff_max_bytes: 120000
run_timeout_seconds: 600
```

Values in the config file override action inputs/vars at runtime.
```

### Project Guidelines Integration

If your repo has an `AGENTS.md` file, it will be automatically included in the review:

```markdown
<!-- AGENTS.md -->

## Project Context

This is a TypeScript project using:

- React for frontend
- Express for backend
- PostgreSQL for database

### Style Guidelines

- Use TypeScript strict mode
- Prefer functional components
- Follow naming conventions from style guide
<!-- END AGENTS.md -->
```

The action automatically detects `AGENTS.md` and includes the first 2000 characters.

## 📊 Monitoring

### GitHub Actions Logs

Check the Actions tab in your repository for detailed execution logs:

- **Setup logs**: Provider configuration, prompt assembly
- **Execution logs**: Per-provider start/completion
- **Synthesis logs**: Result aggregation and final review
- **Error logs**: Any failures with provider and timing info

### Common Issues

**"provider not found"**: Check provider spelling and availability
**"permission denied"**: Ensure workflow has `pull-requests: write` permission
**"opencode: command not found"**: Ensure the npm install step ran (or preinstall OpenCode CLI)

## 🤝 Contributing

Thank you for your interest in contributing! Please see [CONTRIBUTING.md](CONTRIBUTING.md) for guidelines.

---

**Made with ❤️ by [Keith Herrington](https://github.com/keithah) with [OpenCode](https://opencode.ai)**
