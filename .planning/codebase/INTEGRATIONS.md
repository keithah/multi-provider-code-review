# External Integrations

**Analysis Date:** 2026-02-04

## APIs & External Services

**LLM Providers (Multi-Provider Architecture):**
- **OpenRouter** - Universal LLM aggregator
  - SDK/Client: Native fetch API via HTTP POST to `https://openrouter.ai/api/v1/chat/completions`
  - Auth: `OPENROUTER_API_KEY` environment variable
  - Implementation: `src/providers/openrouter.ts` - OpenRouterProvider class
  - Features: Dynamic model discovery, free model routing, instance-based load distribution (#1, #2 suffixes)
  - Models: Via `src/providers/openrouter-models.ts` - `getBestFreeOpenRouterModels()` caches free models

- **OpenAI** - GPT models via OpenRouter
  - SDK/Client: Routed through OpenRouter
  - Auth: Configured via OpenRouter provider list (e.g., `openrouter/openai/gpt-4-0314`)
  - Implementation: Transparently handled by OpenRouterProvider

- **Anthropic (Claude)** - Claude models via OpenRouter or direct
  - SDK/Client: Routed through OpenRouter or direct implementation (via `claude/` prefix)
  - Auth: `ANTHROPIC_API_KEY` (if using direct provider)
  - Implementation: `src/providers/claude-code.ts` - ClaudeCodeProvider class

- **OpenCode** - Local/CLI-based model execution
  - SDK/Client: Child process execution via `spawn()` with stdin/stdout communication
  - Auth: Optional API key via `PLUGIN_OPENCODE_API_KEY` or `PLUGIN_API_KEY`
  - Implementation: `src/providers/opencode.ts` - OpenCodeProvider class
  - Models: Via `src/providers/opencode-models.ts` - `getBestFreeOpenCodeModelsCached()` discovers available models
  - Runtime: Requires `opencode` CLI installed separately

- **Gemini** - Google Gemini models
  - SDK/Client: Child process execution (similar to OpenCode)
  - Auth: Implicit (CLI-based authentication)
  - Implementation: `src/providers/gemini.ts` - GeminiProvider class
  - Runtime: Requires `gemini` CLI installed separately

- **Codex** - Legacy Codex provider
  - SDK/Client: Direct HTTP API
  - Implementation: `src/providers/codex.ts` - CodexProvider class

- **Cohere** - Cohere models (reference in .env.example)
  - Auth: `COHERE_API_KEY` environment variable
  - Status: Configured but not yet fully implemented in registry

- **Mistral** - Mistral models (reference in .env.example)
  - Auth: `MISTRAL_API_KEY` environment variable
  - Status: Configured but not yet fully implemented in registry

- **Groq** - Groq API (reference in .env.example)
  - Auth: `GROQ_API_KEY` environment variable
  - Status: Configured but not yet fully implemented in registry

**Provider Registry & Discovery:**
- Implementation: `src/providers/registry.ts` - ProviderRegistry class
- Loads providers from env vars (REVIEW_PROVIDERS, FALLBACK_PROVIDERS)
- Performs dynamic discovery when no explicit providers configured
- Rate limiting: `src/providers/rate-limiter.ts` - RateLimiter class tracks rate-limited providers
- Reliability tracking: `src/providers/reliability-tracker.ts` - ReliabilityTracker class scores provider performance
- Circuit breaker: `src/providers/circuit-breaker.ts` - CircuitBreaker pattern for failing providers

## GitHub Integration

**GitHub REST API (Octokit):**
- SDK/Client: `@octokit/rest` 20.1.2
- Auth: `GITHUB_TOKEN` environment variable (personal access token or Actions token)
- Scopes required: `repo`, `pull_requests`
- Implementation: `src/github/client.ts` - GitHubClient class wraps Octokit
- Operations:
  - Get PR details, files, and diffs: `src/github/pr-loader.ts`
  - Post inline comments: `src/github/comment-poster.ts`
  - Read file content at specific refs: `src/github/client.ts` getFileContent()
  - Retrieve rate limit status: `src/github/rate-limit.ts` - GitHubRateLimitTracker

**GitHub Actions Integration:**
- SDK/Client: `@actions/core` 1.11.1 (input/output), `@actions/github` 6.0.1 (context)
- Usage: `src/main.ts` - reads workflow inputs, sets outputs
- Inputs: REVIEW_PROVIDERS, GITHUB_TOKEN, PR_NUMBER, configuration flags
- Outputs: findings_count, critical_count, cost_usd, ai_likelihood
- Manifest: `action.yml` defines the GitHub Action interface

**GitHub Actions Caching:**
- SDK/Client: `@actions/cache` 4.0.1
- Purpose: Cache review results across workflow runs
- Implementation: `src/cache/storage.ts` - CacheStorage class reads/writes via Actions cache API
- TTL: 7 days default (configurable via CACHE_TTL environment variable)

**Webhook Server (Self-Hosted):**
- Port: Configurable via PORT environment variable (default: 3000)
- Secret verification: HMAC-SHA256 validation of `x-hub-signature-256` header
- Implementation: `src/server/index.ts` - HTTP server with webhook endpoint at `/webhook`
- Events: pull_request (opened, synchronize, reopened)
- Payload parsing: `src/server/webhook-handler.ts` - WebhookHandler class

## Data Storage

**Cache Storage:**
- Type: Local filesystem (GitHub Actions `@actions/cache` or self-hosted disk)
- Implementation: `src/cache/storage.ts` - CacheStorage class
- Format: JSON with version metadata and TTL tracking
- Key structure: Hash of PR number, config, and provider list
- Location: `./.cache` directory (configurable via CACHE_DIRECTORY)

**Graph Cache (Code Context):**
- Type: Local in-memory or persistent cache
- Implementation: `src/cache/graph-cache.ts` - GraphCache class
- Purpose: Caches code dependency graph to avoid re-parsing on subsequent reviews
- TTL: Configurable (CACHE_TTL, default 7 days)

**Analytics Storage:**
- Type: Local JSON files
- Implementation: `src/analytics/metrics-collector.ts` - MetricsCollector class
- Stored in: Reports directory (configurable via REPORTS_DIR, default: `./reports`)
- Format: Newline-delimited JSON for streaming analysis

## Learning & Feedback System

**Feedback Tracking:**
- Implementation: `src/learning/feedback-tracker.ts` - FeedbackTracker class
- Storage: Local JSON files in `./.cache/feedback/`
- Purpose: Collects false positive/negative feedback to adjust confidence thresholds
- Configuration:
  - LEARNING_ENABLED - Toggle learning system
  - LEARNING_MIN_FEEDBACK_COUNT - Min samples before adjusting
  - LEARNING_LOOKBACK_DAYS - Historical lookback window

## Environment Configuration

**Required Environment Variables:**
- `GITHUB_TOKEN` - GitHub API authentication
- `GITHUB_REPOSITORY` - Repository in format `owner/repo` (auto-detected in Actions)
- `PR_NUMBER` - Pull request number to review

**Provider API Keys (Conditional):**
- `OPENROUTER_API_KEY` - For OpenRouter models (recommended free tier)
- `OPENAI_API_KEY` - For OpenAI models via direct provider
- `ANTHROPIC_API_KEY` - For Claude models via direct provider
- `COHERE_API_KEY` - For Cohere models
- `MISTRAL_API_KEY` - For Mistral models
- `GROQ_API_KEY` - For Groq models
- `PLUGIN_API_KEY` - Generic plugin API key (or provider-specific `PLUGIN_<NAME>_API_KEY`)

**Optional Configuration:**
- `REVIEW_PROVIDERS` - Comma-separated provider list (auto-discovery if empty)
- `FALLBACK_PROVIDERS` - Backup providers if primary fails
- `SYNTHESIS_MODEL` - Model for combining results (default: `openai/gpt-4o-mini`)
- `ENABLE_AST_ANALYSIS` - Toggle AST-based code parsing
- `ENABLE_SECURITY` - Toggle security scanning
- `ENABLE_CACHING` - Toggle review result caching
- `WEBHOOK_SECRET` - HMAC secret for webhook verification (32+ chars, self-hosted only)
- `PORT` - Webhook server port (default: 3000)

**Secrets Location:**
- GitHub Actions: Repository Secrets (Settings > Secrets and variables > Actions)
- Self-hosted: Environment variables, `.env` file (must not be committed)
- Rotation: Keys should be regularly rotated; compromised keys revoked immediately

## Webhooks & Callbacks

**Incoming:**
- GitHub webhook endpoint: `/webhook` (POST)
- Events: `pull_request` with actions: `opened`, `synchronize`, `reopened`
- Verification: HMAC-SHA256 signature (header: `x-hub-signature-256`)
- Auto-review triggers: Configurable via `WEBHOOK_AUTO_REVIEW_ON_*` flags

**Outgoing:**
- PR inline comments: Posted via GitHub REST API (POST /repos/{owner}/{repo}/pulls/{pull_number}/comments)
- Summary comment: Posted via GitHub REST API (POST /repos/{owner}/{repo}/issues/{issue_number}/comments)
- No webhooks called to external systems by default

## Rate Limiting & Circuit Breaking

**GitHub API:**
- Tracker: `src/github/rate-limit.ts` - GitHubRateLimitTracker class
- Exponential backoff: Triggered when <25% of quota remaining
- Delay: Progressive 100-2000ms based on remaining quota

**LLM Provider Rate Limiting:**
- Tracker: `src/providers/rate-limiter.ts` - RateLimiter class
- Tracks per-provider rate limits and applies backoff
- Configuration: `PROVIDER_RETRIES` (default 3), `PROVIDER_MAX_PARALLEL` (default 3)

**Circuit Breaker Pattern:**
- Implementation: `src/providers/circuit-breaker.ts` - CircuitBreaker class
- Transitions: Closed (working) → Open (failing) → Half-Open (testing recovery)
- Removes providers from rotation if reliability drops below threshold
- Configuration: `RELIABILITY_MIN_SCORE` (default 0.5), `RELIABILITY_WINDOW_SIZE` (20 attempts)

## File Output Formats

**SARIF (Static Analysis Results Interchange Format):**
- Generator: `src/output/sarif.ts` - SARIF formatter
- Enabled: `ENABLE_SARIF` (default: true)
- Output: `{REPORTS_DIR}/review-sarif.json`
- Purpose: Integration with GitHub Code Scanning

**JSON Report:**
- Generator: `src/output/json.ts` - JSON formatter
- Enabled: `ENABLE_JSON` (default: true)
- Output: `{REPORTS_DIR}/review.json`
- Format: Structured findings with metadata

**Mermaid Diagrams:**
- Generator: `src/output/mermaid.ts` - Mermaid diagram builder
- Enabled: `ENABLE_MERMAID` (default: true)
- Diagrams: Code dependency graphs, impact analysis flows

## Plugin System (Advanced)

**Custom Provider Plugins:**
- Loader: `src/plugins/plugin-loader.ts` - PluginLoader class
- Directory: `PLUGIN_DIR` (default: `./plugins`)
- Manifest: `plugin-manifest.json` with SHA256 checksum (optional)
- Security: **Requires explicit acknowledgment** (`PLUGIN_SECURITY_ACKNOWLEDGED=true`)
- Allowlist/Blocklist: `PLUGIN_ALLOWLIST`, `PLUGIN_BLOCKLIST` (comma-separated)
- **WARNING:** Plugins execute arbitrary code with full system access in same process (no sandboxing)
- Recommended: Private, self-hosted environments only

---

*Integration audit: 2026-02-04*
