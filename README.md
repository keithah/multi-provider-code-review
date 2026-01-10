# Multi-Provider Code Review GitHub Action

[![GitHub Action](https://img.shields.io/badge/GitHub%20Action-blue.svg)](https://github.com/keithah/multi-provider-code-review)[![License](https://img.shields.io/badge/License-MIT-green.svg)](https://opencode.ai)[![Free](https://img.shields.io/badge/Free%20Providers-orange.svg)](https://anthropic.com/claude)[![Uses](https://img.shields.io/badge/Uses%20OpenCode-orange.svg)]

🤖 **Run comprehensive code reviews with 4 free AI providers in parallel and synthesize their results into one actionable review.**

## ✨ Features

- **🔄 Parallel Processing**: Run reviews with 4 free AI providers simultaneously using OpenCode subagents
- **🧠 Intelligent Synthesis**: Combine overlapping feedback, highlight unique insights from all providers
- **💰 100% Free**: Uses only free opencode providers (no API keys required)
- **🚀 Fast**: Complete reviews in ~3 minutes with parallel subagent execution
- **📝 Smart Comments**: Automatic GitHub comments with line numbers and code suggestions
- **🎯 Flexible**: Multiple trigger options and customizable provider lists
- **🧩 Clean Integration**: Single composite action, no local scripts needed

## 🚀 Quick Start

### Add to your repo

```bash
# In your existing repository
mkdir -p .github/workflows
curl -o .github/workflows/multi-provider-review.yml https://raw.githubusercontent.com/keithah/multi-provider-code-review/main/action.yml

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

### Environment Variables

| Variable       | Default        | Description                            |
| -------------- | -------------- | -------------------------------------- |
| `GITHUB_TOKEN` | `github.token` | GitHub token for API access (auto-set) |
| `PR_TITLE`     | From PR        | Pull request title                     |
| `PR_NUMBER`    | From PR        | Pull request number                    |
| `PR_BODY`      | From PR        | Pull request description               |
| `HAS_AGENTS`   | `false`        | Whether AGENTS.md exists               |

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
│  GitHub Action Trigger               │
└─────────────┬───────────────────────────────┘
              │
              ▼
┌─────────────────────────────────────────────┐
│  Multi-Provider Composite Action          │
└─────────────┬──────────────────────────┘
              │
              ▼
┌──────────────────────────────────────────────┐
│  OpenCode with Task Tool                │
│                                      │
│  ┌──────────┬──────────┬─────────┐ │
│  │  Big    │  Grok   │         │ │
│  │  Pickle │  Code    │  Minimax │ │
│  └──────────┴──────────┴─────────┘ │
│                                      │
│  Parallel execution                   │
│                                      │
│  ┌───────────────────────────────────────┐ │
│  │  Synthesize Results             │ │
│  │  → Comprehensive Review        │ │
│  └───────────────────────────────────────┘ │
└───────────────────────────────────────────────┘
              │
              ▼
┌─────────────────────────────────────────────┐
│  Post Review as PR Comment             │
└─────────────────────────────────────────────┘
```

### Process Flow

1. **Setup**: Action receives PR details (title, number, body)
2. **Agent Config Creation**: Dynamically creates subagent configs for each provider
3. **Parallel Execution**: OpenCode runs all 4 review subagents in parallel using Task tool
4. **Synthesis**: Results are synthesized into one comprehensive review
5. **GitHub Comments**: Review is posted as a PR comment with specific line numbers

### Subagent System

Each provider runs as a dedicated subagent with:

- **Fixed model**: Each subagent uses its specific model (big-pickle, grok-code, etc.)
- **Review focus**: Code quality, security, performance, testing
- **Permissions**: Only `gh pr comment` and `gh api` commands (read-only access)
- **No edits**: Subagents cannot write files, ensuring code safety

## 🤖 Available Providers

| Provider                     | Description            | Type         | Model |
| ---------------------------- | ---------------------- | ------------ | ----- |
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

### Custom Review Prompts

Override the default review criteria:

```yaml
env:
  CUSTOM_PROMPT: "Focus specifically on security and performance for this review."
  CUSTOM_TIMEOUT: "300000"
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

- **Setup logs**: Provider configuration, agent creation
- **Execution logs**: Parallel review starts/completion for each provider
- **Synthesis logs**: Result aggregation and final review
- **Error logs**: Any failures with provider and timing info

### Common Issues

**"provider not found"**: Check provider spelling and availability
**"timeout"**: Increase `CUSTOM_TIMEOUT` variable for large PRs
**"permission denied"**: Ensure workflow has `pull-requests: write` permission

## 🤝 Contributing

Thank you for your interest in contributing! Please see [CONTRIBUTING.md](CONTRIBUTING.md) for guidelines.

---

**Made with ❤️ by [Keith Herrington](https://github.com/keithah) with [OpenCode](https://opencode.ai)**
