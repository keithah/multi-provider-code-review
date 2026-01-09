# Multi-Provider Code Review GitHub Action

[![GitHub Action](https://img.shields.io/badge/GitHub%20Action-blue.svg)](https://github.com/keithah/multi-provider-code-review)[![License](https://img.shields.io/badge/License-MIT-green.svg)](https://opencode.ai)[![Free](https://img.shields.io/badge/Free%20Providers-orange.svg)](https://anthropic.com/claude)[![Uses](https://img.shields.io/badge/Uses%20Claude%20Code-orange.svg)]

🤖 **Run comprehensive code reviews with 4 free AI providers in parallel and synthesize their results into one actionable review.**

## ✨ Features

- **🔄 Parallel Processing**: Run reviews with 4 free AI providers simultaneously
- **🧠 Intelligent Synthesis**: Combine overlapping feedback, highlight unique insights
- **💰 100% Free**: Uses only free opencode providers (no API keys required)
- **🚀 Fast**: Complete reviews in ~3 minutes
- **📝 Smart Comments**: Automatic GitHub comments with line numbers and suggestions
- **🎯 Flexible**: Multiple trigger options and customizable providers

## 🚀 Quick Start

### Option 1: Add to your repo

```bash
# Clone your fork
git clone https://github.com/YOUR_USERNAME/multi-provider-code-review.git
cd multi-provider-code-review

# Install dependencies
npm install

# Create workflows directory
mkdir -p .github/workflows

# Download and update action
curl -o .github/workflows/multi-provider-review.yml https://raw.githubusercontent.com/keithah/multi-provider-code-review/main/action.yml

# Commit and push
git add .github/workflows/multi-provider-review.yml
git commit -m "Add multi-provider code review action"
git push origin main
```

### Option 2: Use directly

```bash
# In your existing repository
mkdir -p .github/workflows
curl -o .github/workflows/multi-provider-review.yml https://raw.githubusercontent.com/keithah/multi-provider-code-review/main/action.yml

# Commit and push
git add .github/workflows/multi-provider-review.yml
git commit -m "Update multi-provider code review action"
git push origin main
```

## 📋 Configuration

No configuration required! The action works out of the box with free providers.

### Repository Variables

| Variable | Default | Description |
|------------|-------------|-----------|
| `REVIEW_PROVIDERS` | List of providers, comma-separated | `opencode/big-pickle,opencode/grok-code,opencode/minimax-m2.1-free,opencode/glm-4.7-free` | Comma-separated providers |
| `RUNNER` | `ubuntu-latest` | GitHub Actions runner |

## 🎯 Usage

### Manual Triggers

Comment `/review` to trigger review
Mention `@opencode` or `@claude` to trigger

## 🤖 Available Providers

| Provider | Description | Type | Description |
|-----------|-------------|-----------|
| `opencode/big-pickle` | Large reasoning model | Deep analysis, comprehensive reviews |
| `opencode/grok-code` | Code-specialized model | Technical accuracy, code patterns |
| `opencode/minimax-m2.1-free` | Free tier model | Quick insights, general reviews |
| `opencode/glm-4.7-free` | Free GLM model | Balanced approach, good synthesis |

### Premium Providers

Additional providers available with authentication:
- Claude models (anthropic/claude-3.5-sonnet, etc.)
- OpenAI models (gpt-4-turbo, etc.)

## 🔧 Advanced Configuration

### Custom Prompts

Override the default review prompt:

```yaml
env:
  CUSTOM_PROMPT: "Focus specifically on [YOUR_FEATURE] security and performance for this review."
  CUSTOM_TIMEOUT: "300000"
```

## 📊 Monitoring

### GitHub Actions Logs

Check the Actions tab in your repository for detailed execution logs and error information.

## 🤝 Contributing

Thank you for your interest in contributing! Please see [CONTRIBUTING.md](CONTRIBUTING.md) for guidelines.

---

**Made with ❤️ by [Keith Herrington](https://github.com/keithah)**

For questions or support, please open an issue in this repository.