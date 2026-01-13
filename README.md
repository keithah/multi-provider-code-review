# Multi-Provider Code Review GitHub Action

[![GitHub Action](https://img.shields.io/badge/GitHub%20Action-blue.svg)](https://github.com/keithah/multi-provider-code-review)[![License](https://img.shields.io/badge/License-MIT-green.svg)](https://opencode.ai)[![Free](https://img.shields.io/badge/Free%20Providers-orange.svg)](https://anthropic.com/claude)[![Uses](https://img.shields.io/badge/Uses%20OpenCode-orange.svg)]

🤖 **Run comprehensive code reviews with multiple free OpenCode providers and synthesize their results into one actionable review.**

## ✨ Features

- **🔄 Multi-Provider Coverage**: Run reviews with multiple free OpenCode providers
- **🧠 Intelligent Synthesis**: Combine overlapping feedback, highlight unique insights from all providers
- **💰 100% Free**: Uses only free opencode providers (no API keys required)
- **🚀 Simple**: Composite action builds prompts, runs providers, synthesizes, and posts the comment
- **📝 Smart Comments**: Single synthesized PR comment plus raw provider outputs (collapsed)
- **🎯 Flexible**: Multiple trigger options and customizable provider lists, AGENTS.md awareness
- **🧩 Clean Integration**: Single composite action, no local scripts needed

## 🚀 Quick Start

### Prerequisites

- GitHub-hosted runners (or self-hosted with Node.js/npm available)
- OpenCode CLI (installed automatically via npm in the workflow template if missing)
- GitHub CLI is already available on `ubuntu-latest` runners

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

## 📋 Configuration

### Repository Variables

| Variable           | Default                                                                                   | Description                       |
| ------------------ | ----------------------------------------------------------------------------------------- | --------------------------------- |
| `REVIEW_PROVIDERS` | `opencode/big-pickle,opencode/grok-code,opencode/minimax-m2.1-free,opencode/glm-4.7-free` | Comma-separated list of providers |

### Inputs wired by the workflow template

The provided workflow (`action-simple.yml`) resolves and passes these to the composite action:

| Input          | Source                 | Description                       |
| -------------- | ---------------------- | --------------------------------- |
| `GITHUB_TOKEN` | `secrets.GITHUB_TOKEN` | GitHub token for API access       |
| `PR_TITLE`     | PR metadata            | Pull request title                |
| `PR_NUMBER`    | PR metadata            | Pull request number               |
| `PR_BODY`      | PR metadata            | Pull request description          |
| `HAS_AGENTS`   | Local check            | Whether `AGENTS.md` exists        |

## 🎯 Usage

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

## 🏗️ How It Works

### Architecture

```
┌─────────────────────────────────────────────────┐
│  GitHub Action Trigger                          │
└─────────────┬───────────────────────────────┘
              │
              ▼
┌─────────────────────────────────────────────┐
│  Multi-Provider Composite Action             │
└─────────────┬──────────────────────────┘
              │
              ▼
┌──────────────────────────────────────────────┐
│  OpenCode CLI                                 │
│                                               │
│  ┌──────────┬──────────┬─────────┬────────┐ │
│  │ Big      │ Grok     │ Minimax │ GLM    │ │
│  │ Pickle   │ Code     │ M2.1    │ 4.7    │ │
│  └──────────┴──────────┴─────────┴────────┘ │
│   Sequential provider runs                    │
│                                               │
│  ┌───────────────────────────────────────┐    │
│  │  Synthesize Results (Big Pickle)      │    │
│  │  → Comprehensive Review               │    │
│  └───────────────────────────────────────┘    │
└───────────────────────────────────────────────┘
              │
              ▼
┌─────────────────────────────────────────────┐
│  Post Review as PR Comment                   │
└─────────────────────────────────────────────┘
```

### Process Flow

1. **Setup**: Action receives PR details (title, number, body)
2. **Prompt Building**: Assembles PR title/body, optional `AGENTS.md`, changed file summary, and PR diff (truncated if huge)
3. **Provider Runs**: Calls `opencode run -m <provider>` for each provider in `REVIEW_PROVIDERS`
4. **Synthesis**: Uses Big Pickle (configurable) to combine provider outputs into one review
5. **GitHub Comment**: Posts the synthesized review to the PR and attaches raw provider outputs in a collapsed section

### Providers

Each provider is run directly via OpenCode CLI using the list from `REVIEW_PROVIDERS`.

## 🤖 Available Providers

| Provider                     | Description            | Backing      |
| ---------------------------- | ---------------------- | ------------ |
| `opencode/big-pickle`        | Large reasoning model  | Claude-based |
| `opencode/grok-code`         | Code-specialized model | Grok-based   |
| `opencode/minimax-m2.1-free` | Free tier model        | Minimax      |
| `opencode/glm-4.7-free`      | Free GLM model         | Zhipu AI     |

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

## 🔧 Advanced Configuration

### Provider and synthesis models

```yaml
env:
  REVIEW_PROVIDERS: "opencode/big-pickle,opencode/grok-code,opencode/minimax-m2.1-free,opencode/glm-4.7-free"
  SYNTHESIS_MODEL: "opencode/big-pickle"   # optional override
  DIFF_MAX_BYTES: "120000"                 # optional diff truncation size
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
