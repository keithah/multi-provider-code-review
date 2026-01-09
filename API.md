# Multi-Provider Code Review API Documentation

## Overview

Multi-Provider Code Review GitHub Action provides comprehensive code reviews by running multiple AI providers in parallel and synthesizing their results.

## Table of Contents

| File | Description |
|------|-------------|
| [README.md](README.md) | Main documentation and quick start guide |
| [LICENSE](LICENSE) | MIT license |
| [action.yml](action.yml) | GitHub Action workflow |
| [multi-review-script.ts](multi-review-script.ts) | Main review execution script |
| [types.ts](src/types.ts) | TypeScript type definitions |
| [providers.ts](src/providers.ts) | Provider configurations |
| [utils.ts](src/utils.ts) | Utility functions |
| [API.md](API.md) | API documentation |

## 🚀 Quick Start

### Installation

#### Option 1: Repository Variables
Add to any repository:
```yaml
env:
  REVIEW_PROVIDERS: "opencode/big-pickle,opencode/grok-code,opencode/minimax-m2.1-free,opencode/glm-4.7-free"
```

#### Option 2: Download from Registry
```bash
curl -o .github/workflows/multi-provider-review.yml https://raw.githubusercontent.com/anomalyco/multi-provider-code-review/main/action.yml
```

### Option 3: Manual Workflow
Copy `multi-provider-review.yml` to your `.github/workflows/` directory.

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
    if: startsWith(github.event.comment.body, '/review')
      runs-on: ubuntu-latest
```

### Environment Variables

| Variable | Description | Default |
|------------|-------------|----------|
| `REVIEW_PROVIDERS` | List of providers, comma-separated | `opencode/big-pickle,opencode/grok-code,opencode/minimax-m2.1-free,opencode/glm-4.7-free` |
| `CUSTOM_PROMPT` | Custom review prompt | Empty (uses default) |
| `RUNNER` | GitHub Actions runner | `ubuntu-latest` |
| `TIMEOUT` | Provider timeout in milliseconds | `180000` (3 minutes) |

## 🎯 Features

- **🔄 Parallel Reviews**: All providers run simultaneously using `Promise.all()`
- **🧠 Synthesis**: Intelligent combination of overlapping feedback and unique insights
- **📝 Smart Comments**: Automatic GitHub API comments with line numbers
- **💰 100% Free**: Uses only free opencode providers
- **🚀 Fast**: Complete reviews in ~3 minutes
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
| Provider | Model | Type | Description |
|-----------|-------------|-----------|
| `opencode/big-pickle` | Large reasoning | Deep analysis, comprehensive reviews |
| `opencode/grok-code` | Code-specialized | Technical accuracy, code patterns |
| `opencode/minimax-m2.1-free` | General | Quick insights, balanced reviews |
| `opencode/glm-4.7-free` | Creative | Synthesis and balanced approach |

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

### Custom Prompts

Override the default review prompt:

```yaml
env:
  CUSTOM_PROMPT: |
    Focus specifically on [YOUR_FEATURE] security and performance.
    Use the project's existing code patterns and conventions.
    Follow [YOUR_LANGUAGE] best practices for naming and structure.
    Consider [YOUR_LIBRARY] optimizations for better performance.
```

## 🐛 Troubleshooting

### Common Issues

#### 1. Workflow Not Triggering

**Problem**: Review doesn't start when expected

**Solution**: Check trigger conditions:
```yaml
if: |
  github.event_name == 'pull_request' && 
  startsWith(github.event.comment.body, '/review')
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

**Problem**: Some providers failing with timeout errors

**Solution**: Check provider status and increase timeout:
```bash
# Check providers at https://models.dev
gh api --method POST -H "Accept: application/vnd.github+json" /repos/OWNER/REPO/contents/.github/workflows/multi-provider-review.yml --method PUT --field message="Update providers" --field content="$(cat providers.json | base64)" --field encoding=base64
```

## 📝 Monitoring

### GitHub Actions Logs

Check the Actions tab in your repository for detailed execution logs and error information.