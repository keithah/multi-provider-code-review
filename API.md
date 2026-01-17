# Multi-Provider Code Review API Documentation

## Overview

Multi-Provider Code Review GitHub Action provides comprehensive code reviews by running multiple AI providers and synthesizing their results into a single PR comment.

## Table of Contents

| File | Description |
|------|-------------|
| [README.md](README.md) | Main documentation and quick start guide |
| [LICENSE](LICENSE) | MIT license |
| [action.yml](action.yml) | Composite GitHub Action |
| [action-simple.yml](action-simple.yml) | Example workflow that wires inputs and installs OpenCode |
| [multi-review-script.ts](multi-review-script.ts) | Legacy script (unused by the composite action) |
| [API.md](API.md) | API documentation |

## 🚀 Quick Start

1. Copy the workflow template into your repo:
   ```bash
   mkdir -p .github/workflows
   curl -o .github/workflows/multi-provider-review.yml https://raw.githubusercontent.com/keithah/multi-provider-code-review/main/action-simple.yml
   ```
2. Commit and push the workflow.
3. Ensure the runner can install OpenCode (template installs via `npm install -g opencode-ai` if missing).

## 📋 Usage

### Triggers

```yaml
# Comment on PR (auto)
on:
  pull_request:
    types: [opened, synchronize]

# Manual mention triggers  
  issue_comment:
    types: [created]
jobs:
  review:
    if: |
      github.event_name == 'pull_request' ||
      (github.event.issue.pull_request &&
        (startsWith(github.event.comment.body, '/review') ||
         contains(github.event.comment.body, '@opencode') ||
         contains(github.event.comment.body, '@claude')))
    runs-on: ubuntu-latest
```

### Inputs / variables

| Name | Description | Default |
|------------|-------------|----------|
| `REVIEW_PROVIDERS` | List of providers, comma-separated | `opencode/big-pickle,opencode/grok-code,opencode/minimax-m2.1-free,opencode/glm-4.7-free` |
| `SYNTHESIS_MODEL` | Model used to combine provider outputs | `opencode/big-pickle` |
| `DIFF_MAX_BYTES` | Max diff bytes included in prompt | `120000` |
| `RUN_TIMEOUT_SECONDS` | Per-model timeout in seconds | `600` |
| `PR_TITLE` | PR title (passed by workflow) | n/a |
| `PR_NUMBER` | PR number (passed by workflow) | n/a |
| `PR_BODY` | PR body (passed by workflow) | n/a |
| `HAS_AGENTS` | Whether `AGENTS.md` exists | `false` |

## 🎯 Features

- **🔄 Multi-Provider Coverage**: Runs multiple providers (sequentially) via OpenCode CLI
- **🧠 Synthesis**: Intelligent combination of overlapping feedback and unique insights
- **📝 Smart Comments**: Posts one synthesized PR comment with raw provider outputs in a collapsed section
- **💰 100% Free**: Uses only free opencode providers
- **🎯 Flexible**: Multiple trigger options and customizable providers

## 📊 Output

### Example Review Output

```markdown
## 🔍 Key Findings
- **Security**: Potential SQL injection in `user.ts:45`
- **Performance**: Inefficient loop in `data.js:123`
- **Style**: Inconsistent naming in `utils.ts:67`

### 📝 Detailed Comments
- [user.ts:45] - Consider using parameterized queries
- [data.js:123] - Use map() instead of forEach() for better performance
- [utils.ts:67] - Follow camelCase convention

### ✅ Overall Assessment
The code is well-structured but needs security and performance improvements before merging.

---

## 🤖 Available Providers

### Free Providers (Current)
| Provider | Description | Backing |
|-----------|-------------|-----------|
| `opencode/big-pickle` | Large reasoning | Claude-based |
| `opencode/grok-code` | Code-specialized | Grok-based |
| `opencode/minimax-m2.1-free` | General | Minimax |
| `opencode/glm-4.7-free` | Creative | Zhipu |

### Premium Providers (Available)
Additional providers available with authentication:
- Claude models (anthropic/claude-3.5-sonnet, anthropic/claude-opus-3-7, etc.)
- OpenAI models (gpt-4, gpt-4-turbo, etc.)
- Google models (gemini-pro, etc.)

## 🔧 Advanced Configuration

### Custom Providers

Define custom providers by adding to the workflow:

```yaml
env:
  REVIEW_PROVIDERS: "opencode/big-pickle,opencode/grok-code,opencode/minimax-m2.1-free,opencode/glm-4.7-free,opencode/my-custom-provider"
```

## 🐛 Troubleshooting

### Common Issues

#### 1. Workflow Not Triggering

**Problem**: Review doesn't start when expected

**Solution**: Check trigger conditions:
```yaml
if: |
  github.event_name == 'pull_request' ||
  (github.event.issue.pull_request &&
    (startsWith(github.event.comment.body, '/review') ||
     contains(github.event.comment.body, '@opencode') ||
     contains(github.event.comment.body, '@claude')))
```

#### 2. Permission Errors

**Problem**: `gh api: Not Found` or `permission denied`

**Solution**: Verify workflow permissions:
```yaml
permissions:
  contents: read
  pull-requests: write
```

#### 3. Provider Failures

**Problem**: Some providers failing or timing out

**Solution**: Check provider status, reduce the provider list temporarily, or trim large diffs via `DIFF_MAX_BYTES`.

## 📝 Monitoring

### GitHub Actions Logs

Check the Actions tab in your repository for detailed execution logs and error information.
