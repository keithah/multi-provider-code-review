# Error Handling Guide

## Overview

Multi-Provider Code Review implements robust error handling to ensure reliability:

- **Graceful degradation**: Continue with partial results when providers fail
- **Automatic retries**: Retry transient failures with exponential backoff
- **Provider fallbacks**: Use backup providers when primary fails
- **Budget protection**: Stop execution before exceeding cost limits
- **Detailed logging**: Track errors for debugging and monitoring

## Error Handling Patterns

### 1. Retry Logic

All external API calls use automatic retry with exponential backoff:

```typescript
import { withRetry } from '../utils/retry';

// Retry up to 3 times with exponential backoff
const result = await withRetry(
  () => provider.review(prompt, timeout),
  {
    retries: 3,
    minTimeout: 1000,
    maxTimeout: 5000
  }
);
```

**When retries are used:**
- GitHub API calls (posting comments, fetching PR data)
- LLM provider API calls
- File system operations (cache reads/writes)

**Retry configuration:**
```yaml
- PROVIDER_RETRIES: 3  # Number of retry attempts per provider
```

### 2. Graceful Degradation

When providers fail, the system continues with partial results:

```typescript
// Provider execution with error handling
const results = await Promise.allSettled(
  providers.map(p => p.review(prompt))
);

// Process successful results, log failures
const successful = results
  .filter(r => r.status === 'fulfilled')
  .map(r => r.value);
```

**Behavior:**
- Minimum 1 successful provider required for review
- Failed providers logged in review summary
- Consensus engine adjusts for missing providers
- Synthesis continues with available results

### 3. Provider Fallbacks

Configure fallback providers for resilience:

```yaml
REVIEW_PROVIDERS: openrouter/google/gemini-2.0-flash-exp:free
FALLBACK_PROVIDERS: openrouter/mistralai/devstral-2512:free
```

**Fallback triggers:**
- Primary provider rate limited
- Primary provider timeout
- Primary provider API error
- Primary provider returns invalid response

### 4. Budget Protection

Hard budget limits prevent runaway costs:

```typescript
// Check budget before each provider call
if (costTracker.getTotalCost() > config.budgetMaxUsd) {
  throw new Error(`Budget exceeded: ${costTracker.getTotalCost()} > ${config.budgetMaxUsd}`);
}
```

**Configuration:**
```yaml
- BUDGET_MAX_USD: 0.50  # Halt at $0.50
```

**Behavior:**
- Check before each provider execution
- Halt immediately when exceeded
- Return partial results
- Log budget status

### 5. Timeout Handling

All operations have timeout protection:

```yaml
- RUN_TIMEOUT_SECONDS: 300     # Total review timeout (5 min)
- PROVIDER_TIMEOUT_MS: 30000   # Per-provider timeout (30s)
- GRAPH_TIMEOUT_SECONDS: 10    # Graph analysis timeout
```

**Timeout behavior:**
- Provider timeout: Mark as failed, continue with others
- Total timeout: Return partial review with warning
- Graph timeout: Skip graph analysis, continue review

### 6. Validation and Input Sanitization

Validate all configuration and inputs:

```typescript
// Configuration validation
if (config.providerLimit < 0) {
  throw new Error('Provider limit must be non-negative');
}

// Input sanitization
const sanitizedDiff = diff.substring(0, config.diffMaxBytes);
```

**Validations:**
- PR number is positive integer
- Provider names are valid
- File paths are safe (no path traversal)
- Budget limits are reasonable
- Timeouts are positive

### 7. Structured Logging

Use structured logging for debugging:

```typescript
import { logger } from '../utils/logger';

// Error logging with context
logger.error('Provider execution failed', {
  provider: provider.name,
  error: error.message,
  duration: durationSeconds,
  prNumber: pr.number,
});
```

**Log levels:**
- **ERROR**: Failures that affect functionality
- **WARN**: Recoverable errors, retries, degraded mode
- **INFO**: Normal operation, progress updates
- **DEBUG**: Detailed execution traces

**Configuration:**
```yaml
- LOG_LEVEL: info  # Set to 'debug' for troubleshooting
```

## Common Error Scenarios

### Provider Rate Limiting

**Symptoms:**
- `429 Too Many Requests` errors
- Providers marked as rate-limited in summary
- Review completes with fewer providers

**Solutions:**
1. **Reduce parallel providers:**
   ```yaml
   - PROVIDER_MAX_PARALLEL: 2  # Slower execution, less rate limiting
   ```

2. **Use fallback providers:**
   ```yaml
   FALLBACK_PROVIDERS: alternative/provider
   ```

3. **Upgrade API tier:** Get higher rate limits from provider

4. **Spread load:** Use provider rotation across PRs

### Provider Timeout

**Symptoms:**
- Providers marked as timeout in summary
- Slow review execution
- Missing findings from specific providers

**Solutions:**
1. **Increase timeout:**
   ```yaml
   - PROVIDER_TIMEOUT_MS: 60000  # 60 seconds
   ```

2. **Use faster providers:**
   - Check provider latency in analytics
   - Replace slow providers

3. **Reduce diff size:**
   ```yaml
   - MAX_CHANGED_FILES: 50  # Skip very large PRs
   ```

### GitHub API Errors

**Symptoms:**
- Failed to post comments
- PR data fetch failures
- 403 Forbidden, 404 Not Found errors

**Solutions:**
1. **Check permissions:**
   - Ensure `GITHUB_TOKEN` has write access
   - Verify repository permissions

2. **Fork PRs:** External contributors need special handling
   ```yaml
   - SKIP_LABELS: external  # Skip untrusted PRs
   ```

3. **Retry configuration:**
   ```yaml
   - PROVIDER_RETRIES: 5  # More retries for flaky networks
   ```

### Cache Corruption

**Symptoms:**
- Incremental review failures
- Invalid cached data errors
- Inconsistent review results

**Solutions:**
1. **Clear cache:**
   ```bash
   rm -rf .mpr-cache/
   ```

2. **Disable incremental temporarily:**
   ```yaml
   - INCREMENTAL_ENABLED: false
   ```

3. **Reduce cache TTL:**
   ```yaml
   - INCREMENTAL_CACHE_TTL_DAYS: 3
   ```

### AST Parsing Errors

**Symptoms:**
- AST analysis failures
- Unsupported file types
- Parsing timeout errors

**Solutions:**
1. **Graceful fallback:** AST failures don't block review
   - Review continues with LLM-only analysis
   - Missing AST evidence noted in findings

2. **Disable AST for problematic files:**
   ```yaml
   - ENABLE_AST_ANALYSIS: false
   ```

3. **Report unsupported languages:** File an issue for new language support

### Out of Memory

**Symptoms:**
- Node heap out of memory
- Action killed by runner
- Incomplete reviews for large PRs

**Solutions:**
1. **Limit PR size:**
   ```yaml
   - MAX_CHANGED_FILES: 100
   - MAX_CHANGED_LINES: 2000
   ```

2. **Disable heavy features:**
   ```yaml
   - GRAPH_ENABLED: false
   - ENABLE_AST_ANALYSIS: false
   ```

3. **Increase memory (self-hosted):**
   ```yaml
   # docker-compose.yml
   deploy:
     resources:
       limits:
         memory: 4096M  # 4GB
   ```

## Error Recovery Strategies

### Automatic Recovery

The system automatically recovers from:
- **Transient network errors**: Retry with backoff
- **Provider failures**: Use fallbacks or continue with others
- **Rate limiting**: Exponential backoff + fallbacks
- **Cache misses**: Fallback to full review

### Manual Recovery

For persistent errors:

1. **Check logs:**
   ```bash
   # GitHub Actions
   gh run view <run-id> --log

   # Self-hosted
   docker logs mpr-review
   ```

2. **Retry failed PR:**
   ```bash
   # Re-run GitHub Action
   gh run rerun <run-id>

   # Or push empty commit to trigger new run
   git commit --allow-empty -m "Retry review"
   git push
   ```

3. **Adjust configuration:**
   - Lower limits (files, cost, timeout)
   - Disable features (AST, graph, test hints)
   - Change providers

4. **Dry run for debugging:**
   ```yaml
   - DRY_RUN: true
   - LOG_LEVEL: debug
   ```

## Monitoring and Alerts

### Key Metrics to Monitor

1. **Provider success rate:**
   ```bash
   mpr analytics summary
   ```
   - Should be >95%
   - <90% indicates reliability issues

2. **Average review duration:**
   - Should be <30s for typical PRs
   - >60s indicates performance issues

3. **Cache hit rate:**
   - Should be >60% with incremental reviews
   - <40% indicates cache issues

4. **Cost per review:**
   - Should match expected provider costs
   - Spikes indicate efficiency issues

### Setting Up Alerts

For production deployments, monitor:

```yaml
# Example: Send alert if provider success rate drops
if (successRate < 0.90) {
  sendAlert('Provider reliability degraded');
}

# Example: Alert on high costs
if (costPerReview > expectedCost * 2) {
  sendAlert('Review costs unexpectedly high');
}
```

## Best Practices

### For Action Developers

1. **Always use retry wrapper** for external calls
2. **Log errors with context** (PR number, file, provider)
3. **Fail gracefully** - partial results better than no results
4. **Validate inputs** before processing
5. **Test error paths** - ensure degradation works
6. **Use timeouts** on all async operations
7. **Check budgets** before expensive operations

### For Action Users

1. **Set reasonable budgets** to prevent cost overruns
2. **Monitor analytics** for early warning of issues
3. **Test configuration** with dry-run first
4. **Keep logs accessible** for troubleshooting
5. **Report issues** with full context (logs, config, PR)
6. **Use fallback providers** for critical workflows
7. **Document custom error handling** in your workflows

## Debugging Tips

### Enable Debug Logging

```yaml
- LOG_LEVEL: debug
```

### Use Dry Run Mode

```yaml
- DRY_RUN: true
```

### Check Specific Components

```yaml
# Disable features to isolate issues
- ENABLE_AST_ANALYSIS: false   # Test without AST
- ENABLE_SECURITY: false       # Test without security scanning
- GRAPH_ENABLED: false         # Test without graph analysis
```

### Inspect Provider Responses

```yaml
# Use single provider to isolate provider-specific issues
REVIEW_PROVIDERS: openrouter/google/gemini-2.0-flash-exp:free
FALLBACK_PROVIDERS: ""
```

### Test Locally

```bash
# Run CLI locally to avoid GitHub Action overhead
mpr review --dry-run
```

## See Also

- [Troubleshooting Guide](TROUBLESHOOTING.md) - Common issues and fixes
- [Performance Guide](PERFORMANCE.md) - Optimization strategies
- [User Guide](user-guide.md) - Configuration and usage
- [Analytics Guide](analytics.md) - Cost and performance tracking
