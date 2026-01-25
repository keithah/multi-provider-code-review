# Performance Optimization Guide

## Performance Characteristics

The Multi-Provider Code Review action is designed for high performance with the following targets:

| PR Size | Files | Lines Changed | Target Duration | Typical Cost |
|---------|-------|---------------|-----------------|--------------|
| Small   | 5     | 100          | < 10s           | $0.001-0.005 |
| Medium  | 20    | 500          | < 30s           | $0.005-0.020 |
| Large   | 100   | 2000         | < 90s           | $0.020-0.100 |

**Actual performance depends on:**
- Provider response times (typically 0.5-5 seconds each)
- Network latency to provider APIs
- Cache hit rate (incremental reviews are 6x faster, 80% cheaper)
- Number of providers configured
- Parallel execution limits

## Optimization Strategies

### 1. Incremental Review (Biggest Impact)

**Enable incremental review** to only analyze files changed since the last review:

```yaml
- INCREMENTAL_ENABLED: true
- INCREMENTAL_CACHE_TTL_DAYS: 7  # How long to keep review cache
```

**Benefits:**
- 6x faster on PR updates
- 80% cost reduction for iterative reviews
- Same quality as full review

**How it works:**
- Caches first review result
- On PR update, only reviews newly changed files
- Merges cached findings with new findings
- Updates summary comment in place

**When to use:**
- All PR workflows (recommended default)
- Especially useful for large PRs with multiple iterations

### 2. Provider Selection

**Use free or cheap providers** for cost-effective reviews:

```yaml
# Free providers (good for most use cases)
REVIEW_PROVIDERS: >-
  openrouter/google/gemini-2.0-flash-exp:free,
  openrouter/mistralai/devstral-2512:free

# Balanced (free + paid for critical checks)
REVIEW_PROVIDERS: >-
  openrouter/google/gemini-2.0-flash-exp:free,
  openrouter/anthropic/claude-3.5-sonnet
```

**Provider tips:**
- Start with 2-3 providers for consensus
- Use free providers for routine PRs
- Use premium providers (GPT-4, Claude) for critical security reviews
- Avoid >5 providers unless needed (diminishing returns)

### 3. Parallel Execution Limits

**Tune parallel provider execution** based on API rate limits:

```yaml
- PROVIDER_MAX_PARALLEL: 3  # Default: 5
```

**Guidelines:**
- 3-5 for free tier API keys
- 5-10 for paid tier with high rate limits
- Lower if experiencing rate limiting
- Higher doesn't always help (network overhead)

### 4. Filtering Noise

**Reduce unnecessary analysis** with smart filtering:

```yaml
# Skip specific PRs
- SKIP_LABELS: wip,draft,dependencies
- SKIP_DRAFTS: true
- SKIP_BOTS: true

# Size limits (skip very large PRs)
- MIN_CHANGED_LINES: 5      # Skip trivial changes
- MAX_CHANGED_FILES: 100    # Skip massive refactors

# Comment limits
- INLINE_MAX_COMMENTS: 15   # Cap inline comments per PR
- INLINE_MIN_SEVERITY: major  # Only show major/critical inline
```

**Benefits:**
- Skip PRs that don't need review
- Avoid overwhelming developers with too many comments
- Save API costs on routine updates

### 5. Quiet Mode

**Filter low-confidence findings** to reduce noise:

```yaml
- QUIET_MODE_ENABLED: true
- QUIET_MIN_CONFIDENCE: 0.6  # Only show findings with ≥60% confidence
- QUIET_USE_LEARNING: true   # Learn from user feedback
```

**How it works:**
- Analyzes provider agreement and evidence scores
- Filters findings below confidence threshold
- Learns from 👍/👎 reactions over time

**When to use:**
- High-velocity teams with many PRs
- Established codebases with consistent patterns
- When you're getting too many false positives

### 6. Selective Feature Enablement

**Disable features you don't need:**

```yaml
# Features that add latency
- ENABLE_AST_ANALYSIS: false   # AST analysis (~200-500ms)
- ENABLE_TEST_HINTS: false     # Test coverage analysis (~100ms)
- ENABLE_AI_DETECTION: false   # AI-generated code detection (~50ms)
- ENABLE_SECURITY: true        # Keep security scanning (critical)

# Advanced features
- GRAPH_ENABLED: false         # Code graph analysis (~500-1000ms)
- ANALYTICS_ENABLED: true      # Keep for cost tracking
```

**Recommendations:**
- Always keep `ENABLE_SECURITY: true` (critical vulnerabilities)
- Disable AST/graph for speed, enable for thorough analysis
- Disable test hints unless explicitly tracking coverage
- Keep analytics for cost visibility

### 7. Caching Strategy

**Maximize cache hit rate:**

```yaml
- ENABLE_CACHING: true
- INCREMENTAL_ENABLED: true
```

**Best practices:**
- Use consistent branch naming (e.g., `feature/*`, `fix/*`)
- Avoid force-pushing to PR branches (breaks cache)
- Keep `INCREMENTAL_CACHE_TTL_DAYS` at 7-14 days
- Review cache directory size periodically

**Cache invalidation triggers:**
- New commits to PR (incremental review)
- Branch force-push (full re-review)
- Cache TTL expiration
- Configuration changes

### 8. Budget Controls

**Prevent runaway costs:**

```yaml
- BUDGET_MAX_USD: 0.50  # Hard stop at $0.50 per review
```

**Cost management:**
- Set budget appropriate to PR importance
- Use free providers for most PRs
- Reserve budget for security/critical reviews
- Monitor analytics dashboard for trends

## Performance Monitoring

### Track Performance with Analytics

```bash
# Generate analytics dashboard
mpr analytics generate

# View summary stats
mpr analytics summary
```

**Key metrics to watch:**
- **Average review duration**: Should be <30s for typical PRs
- **Cost per review**: Should be <$0.02 with free providers
- **Cache hit rate**: Should be >60% with incremental reviews
- **Provider success rate**: Should be >95%

### Troubleshooting Slow Reviews

**If reviews are taking too long:**

1. **Check provider latency** in analytics dashboard
   - Look for consistently slow providers
   - Consider replacing with faster alternatives
   - Check for network issues

2. **Review configuration**
   - Too many providers? (>5 adds overhead)
   - AST/graph analysis enabled? (adds 0.5-1.5s)
   - Large PR? (use `MAX_CHANGED_FILES` limit)

3. **Enable debug logging**
   ```yaml
   - LOG_LEVEL: debug
   ```
   Check GitHub Action logs for bottlenecks

4. **Use dry-run to profile**
   ```yaml
   - DRY_RUN: true
   ```
   See timing breakdown without posting comments

## Advanced Optimization

### Self-Hosted Performance

For self-hosted deployments, optimize infrastructure:

```yaml
# docker-compose.yml
services:
  mpr:
    environment:
      - NODE_ENV=production
    deploy:
      resources:
        limits:
          cpus: '2.0'      # 2 CPU cores recommended
          memory: 2048M     # 2GB RAM recommended
    volumes:
      - mpr-cache:/app/.cache  # Persistent cache
```

**Infrastructure tips:**
- Run on cloud VM with fast network (AWS, GCP, Azure)
- Use SSD storage for cache directory
- Consider Redis for shared cache (multi-instance deployments)
- Monitor memory usage (2GB typical, 4GB for large PRs)

### Provider Fallbacks

**Configure fallback providers** for resilience:

```yaml
REVIEW_PROVIDERS: openrouter/google/gemini-2.0-flash-exp:free
FALLBACK_PROVIDERS: openrouter/mistralai/devstral-2512:free
```

**How it works:**
- If primary provider fails/rate-limited, use fallback
- Adds latency (sequential attempt) but ensures completion
- Good for production stability

### Custom Provider Plugins

**Optimize for your use case** with custom providers:

```yaml
- PLUGINS_ENABLED: true
- PLUGIN_DIR: ./.mpr-plugins
```

Create lightweight providers for specific checks:
- Fast linting-style rules
- Team-specific patterns
- Custom security checks

See [Plugin Development Guide](plugins.md) for details.

## Performance Checklist

Use this checklist to optimize your configuration:

- [ ] Incremental review enabled
- [ ] Using 2-3 fast/free providers
- [ ] Quiet mode configured (if high volume)
- [ ] Appropriate size limits set
- [ ] Unused features disabled
- [ ] Budget controls in place
- [ ] Analytics enabled for monitoring
- [ ] Cache hit rate >60% (check dashboard)
- [ ] Average review time <30s (check dashboard)
- [ ] Provider success rate >95% (check dashboard)

## Configuration Examples

### Speed-Optimized (Fastest reviews)

```yaml
REVIEW_PROVIDERS: openrouter/google/gemini-2.0-flash-exp:free
INCREMENTAL_ENABLED: true
PROVIDER_MAX_PARALLEL: 5
ENABLE_AST_ANALYSIS: false
ENABLE_TEST_HINTS: false
ENABLE_AI_DETECTION: false
ENABLE_SECURITY: true
GRAPH_ENABLED: false
INLINE_MAX_COMMENTS: 10
INLINE_MIN_SEVERITY: major
QUIET_MODE_ENABLED: true
QUIET_MIN_CONFIDENCE: 0.7
```

**Profile:**
- 1 fast provider
- Minimal features
- Aggressive filtering
- Target: <10s for typical PRs

### Quality-Optimized (Most thorough)

```yaml
REVIEW_PROVIDERS: >-
  openrouter/google/gemini-2.0-flash-exp:free,
  openrouter/anthropic/claude-3.5-sonnet,
  openrouter/openai/gpt-4o
INCREMENTAL_ENABLED: true
PROVIDER_MAX_PARALLEL: 3
ENABLE_AST_ANALYSIS: true
ENABLE_TEST_HINTS: true
ENABLE_SECURITY: true
GRAPH_ENABLED: true
INLINE_MAX_COMMENTS: 25
INLINE_MIN_SEVERITY: minor
QUIET_MODE_ENABLED: false
```

**Profile:**
- 3 premium providers
- All features enabled
- No filtering
- Target: <60s for comprehensive analysis

### Cost-Optimized (Minimal spend)

```yaml
REVIEW_PROVIDERS: >-
  openrouter/google/gemini-2.0-flash-exp:free,
  openrouter/mistralai/devstral-2512:free
INCREMENTAL_ENABLED: true
PROVIDER_MAX_PARALLEL: 5
ENABLE_AST_ANALYSIS: true
ENABLE_SECURITY: true
QUIET_MODE_ENABLED: true
BUDGET_MAX_USD: 0.01
```

**Profile:**
- Only free providers
- Incremental reviews
- Strict budget
- Target: $0.00 per review

## See Also

- [Analytics Guide](analytics.md) - Track performance and costs
- [User Guide](user-guide.md) - Configuration and usage
- [Troubleshooting](TROUBLESHOOTING.md) - Common issues
