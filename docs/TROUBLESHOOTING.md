# Troubleshooting Guide

This guide helps you diagnose and fix common issues with Multi-Provider Code Review.

## Table of Contents

- [Installation Issues](#installation-issues)
- [API Key Problems](#api-key-problems)
- [Provider Failures](#provider-failures)
- [Performance Issues](#performance-issues)
- [GitHub Integration](#github-integration)
- [Self-Hosted Deployment](#self-hosted-deployment)
- [Advanced Debugging](#advanced-debugging)

---

## Installation Issues

### Problem: `npm install` fails with dependency errors

**Symptoms:**
```text
npm ERR! code ERESOLVE
npm ERR! ERESOLVE unable to resolve dependency tree
```

**Solutions:**
1. **Update Node.js:** Ensure you're running Node.js 20 or later
   ```bash
   node --version  # Should be v20.x or higher
   ```

2. **Clear npm cache:**
   ```bash
   npm cache clean --force
   rm -rf node_modules package-lock.json
   npm install
   ```

3. **Use legacy peer deps:**
   ```bash
   npm install --legacy-peer-deps
   ```

### Problem: Tree-sitter installation fails

**Symptoms:**
```text
Error: Cannot find module 'tree-sitter'
gyp ERR! build error
```

**Solutions:**
1. **Install build tools:**
   - **macOS:** `xcode-select --install`
   - **Ubuntu/Debian:** `sudo apt-get install build-essential`
   - **Windows:** Install Visual Studio Build Tools

2. **Rebuild native modules:**
   ```bash
   npm rebuild tree-sitter
   ```

3. **Use pre-built binaries:** Tree-sitter modules are marked as `optionalDependencies`, so the action will work without them (but with reduced functionality for some languages)

---

## API Key Problems

### Problem: `OPENROUTER_API_KEY` not found or invalid

**Symptoms:**
```text
Error: OPENROUTER_API_KEY is required
Error: API key for openrouter is required
```

**Solutions:**
1. **Verify key is set in GitHub Secrets:**
   - Go to Repository Settings → Secrets and variables → Actions
   - Ensure `OPENROUTER_API_KEY` exists and is correct
   - Get a free key at [openrouter.ai/keys](https://openrouter.ai/keys)

2. **Check key format:**
   - OpenRouter keys start with `sk-or-v1-`
   - Key should be ~64 characters long
   - No extra spaces or newlines

3. **Test key locally:**
   ```bash
   curl https://openrouter.ai/api/v1/models \
     -H "Authorization: Bearer $OPENROUTER_API_KEY"
   ```

### Problem: Rate limiting errors

**Symptoms:**
```text
Error: Rate limit exceeded
status: 'rate-limited'
```

**Solutions:**
1. **Reduce parallel providers:**
   ```yaml
   PROVIDER_MAX_PARALLEL: '2'  # Default is 3
   ```

2. **Enable incremental review:**
   ```yaml
   INCREMENTAL_ENABLED: 'true'  # Reduces API calls on updates
   ```

3. **Use provider rotation:**
   ```yaml
   PROVIDER_LIMIT: '3'  # Use fewer providers per review
   ```

4. **Add delays between retries:**
   ```yaml
   PROVIDER_RETRIES: '1'  # Reduce retries
   ```

---

## Provider Failures

### Problem: All providers fail

**Symptoms:**
```text
Providers used: 3 (success 0, failed 3)
Review completed with 0 findings
```

**Diagnosis:**
Check the "Raw provider outputs" section in the PR comment for specific error messages.

**Common Causes:**

1. **API keys not set:**
   - Verify all required API keys are in GitHub Secrets
   - Check `.env.example` for required keys

2. **Network issues:**
   - Providers may be temporarily unavailable
   - Check [openrouter.ai/status](https://openrouter.ai/status)

3. **Invalid model names:**
   - Verify model names in `REVIEW_PROVIDERS`
   - Check available models: [openrouter.ai/docs#models](https://openrouter.ai/docs#models)

4. **Budget exceeded:**
   - Check `BUDGET_MAX_USD` setting
   - Review may be skipped if estimated cost exceeds budget

### Problem: Specific provider times out

**Symptoms:**
```text
Provider openrouter/model: timeout (30.0s)
```

**Solutions:**
1. **Increase timeout:**
   ```yaml
   RUN_TIMEOUT_SECONDS: '900'  # Default is 600 (10 min)
   ```

2. **Reduce diff size:**
   ```yaml
   DIFF_MAX_BYTES: '80000'  # Default is 120000
   ```

3. **Exclude large files:**
   ```yaml
   EXCLUDE_PATTERNS: '**/*.lock,**/*.min.js,dist/**'
   ```

### Problem: Free providers not working

**Symptoms:**
```text
Error: Model requires credits
Error: No free credits available
```

**Solutions:**
1. **Use confirmed free models:**
   ```yaml
   REVIEW_PROVIDERS: |
     openrouter/google/gemini-2.0-flash-exp:free,
     openrouter/mistralai/devstral-2512:free
   ```

2. **Check model pricing:**
   - Visit [openrouter.ai/models](https://openrouter.ai/models)
   - Look for models with "free" tag
   - Free models may have rate limits

---

## Performance Issues

### Problem: Review takes too long (>5 minutes)

**Diagnosis:**
Check review duration in PR comment:
```text
Duration: 300.0s • Cost: $0.1234 • Tokens: 50000
```

**Solutions:**
1. **Enable incremental review (fastest):**
   ```yaml
   INCREMENTAL_ENABLED: 'true'  # 6x faster on PR updates
   ```

2. **Reduce provider count:**
   ```yaml
   PROVIDER_LIMIT: '2'  # Use fewer providers
   PROVIDER_MAX_PARALLEL: '2'  # Reduce parallelism
   ```

3. **Exclude unnecessary files:**
   ```yaml
   EXCLUDE_PATTERNS: '**/*.test.ts,**/*.spec.ts,dist/**,node_modules/**'
   ```

4. **Disable expensive features:**
   ```yaml
   ENABLE_AST_ANALYSIS: 'false'  # Skip AST analysis
   GRAPH_ENABLED: 'false'  # Skip dependency graph
   ```

5. **Use faster models:**
   - Prefer "flash" or "turbo" variants
   - Example: `gemini-2.0-flash-exp:free` instead of slower models

### Problem: High API costs

**Symptoms:**
```text
Cost: $5.00 per review
Total monthly cost: $500+
```

**Solutions:**
1. **Use free providers:**
   ```yaml
   REVIEW_PROVIDERS: |
     openrouter/google/gemini-2.0-flash-exp:free,
     openrouter/mistralai/devstral-2512:free
   ```

2. **Enable incremental review:**
   ```yaml
   INCREMENTAL_ENABLED: 'true'  # 80% cost reduction on updates
   ```

3. **Set budget limit:**
   ```yaml
   BUDGET_MAX_USD: '0.10'  # Skip reviews exceeding $0.10
   ```

4. **Enable caching:**
   ```yaml
   ENABLE_CACHING: 'true'  # Cache findings for reuse
   ```

5. **Review fewer files:**
   ```yaml
   MAX_CHANGED_FILES: '50'  # Skip reviews with >50 files
   ```

### Problem: Action runs out of memory

**Symptoms:**
```text
Error: JavaScript heap out of memory
FATAL ERROR: Reached heap limit
```

**Solutions:**
1. **Reduce diff size:**
   ```yaml
   DIFF_MAX_BYTES: '50000'  # Smaller chunks
   ```

2. **Exclude large files:**
   ```yaml
   EXCLUDE_PATTERNS: '**/*.lock,**/*.svg,**/*.min.js'
   ```

3. **Use smaller runner:** (Self-hosted only)
   ```yaml
   runs-on: ubuntu-latest  # Has more memory than smaller runners
   ```

4. **Disable graph features:**
   ```yaml
   GRAPH_ENABLED: 'false'  # Reduces memory usage
   ```

---

## GitHub Integration

### Problem: Comments not posting to PR

**Symptoms:**
- Action completes successfully
- No comments appear on PR
- No errors in logs

**Solutions:**
1. **Check permissions:**
   ```yaml
   permissions:
     contents: read
     pull-requests: write  # Required for commenting
   ```

2. **Verify token scope:**
   - `GITHUB_TOKEN` should be `${{ secrets.GITHUB_TOKEN }}`
   - Token needs `pull_requests: write` permission

3. **Check PR state:**
   - PR must be open (not closed or merged)
   - PR must not be a draft (unless configured to review drafts)

4. **Check skip conditions:**
   - Review labels: `SKIP_LABELS` setting
   - Draft PRs: `SKIP_DRAFTS` setting
   - Min/max files: `MIN_CHANGED_LINES`, `MAX_CHANGED_FILES`

### Problem: Duplicate comments on every commit

**Symptoms:**
- New comment on every push
- Old comments remain

**Solutions:**
1. **Enable incremental review:**
   ```yaml
   INCREMENTAL_ENABLED: 'true'  # Updates existing comment
   ```

2. **Check workflow trigger:**
   ```yaml
   on:
     pull_request:
       types: [opened, synchronize]  # Not ready_for_review
   ```

3. **Use concurrency control:**
   ```yaml
   concurrency:
     group: review-${{ github.event.pull_request.number }}
     cancel-in-progress: true
   ```

### Problem: Fork PRs fail with secrets error

**Symptoms:**
```text
⚠️  Skipping review for fork PR without OPENROUTER_API_KEY
Fork PRs cannot access repository secrets
```

**Explanation:**
This is expected behavior for security. Fork PRs don't have access to repository secrets.

**Solutions:**
1. **Manual trigger:** Use `workflow_dispatch` to manually approve and run review
2. **Use free providers without secrets:** Not recommended for security reasons
3. **Use GitHub App:** Create a GitHub App with proper permissions (advanced)

---

## Self-Hosted Deployment

### Problem: Docker container won't start

**Symptoms:**
```text
Error: Cannot find module './dist/index.js'
Container exits immediately
```

**Solutions:**
1. **Build dist files:**
   ```bash
   npm run build:prod
   ```

2. **Verify dist directory:**
   ```bash
   ls -la dist/
   # Should contain index.js and CLI files
   ```

3. **Check Docker logs:**
   ```bash
   docker logs mpr-review
   ```

4. **Rebuild image:**
   ```bash
   docker-compose build --no-cache
   docker-compose up -d
   ```

### Problem: Webhook server returns 401 Unauthorized

**Symptoms:**
```text
Webhook delivery failed: 401 Unauthorized
GitHub shows webhook delivery failure
```

**Solutions:**
1. **Verify webhook secret:**
   - Generate secure secret: `openssl rand -hex 32`
   - Set in `.env`: `WEBHOOK_SECRET=your_generated_secret`
   - Use same secret in GitHub webhook settings

2. **Check signature header:**
   - GitHub sends `X-Hub-Signature-256` header
   - Secret must match exactly (case-sensitive)

3. **Test locally:**
   ```bash
   curl -X POST http://localhost:3000/health
   # Should return 200 OK
   ```

### Problem: Rate limit errors in self-hosted mode

**Symptoms:**
```text
Error: Rate limit exceeded for PR #123
Too many reviews per minute
```

**Solutions:**
1. **Adjust rate limits:**
   ```bash
   WEBHOOK_RATE_LIMIT_PER_MINUTE=20  # Default: 10
   WEBHOOK_RATE_LIMIT_PER_PR=10      # Default: 5
   ```

2. **Check cleanup interval:**
   - Rate limits reset automatically
   - Check logs for cleanup messages

3. **Restart container:**
   ```bash
   docker-compose restart mpr-webhook
   ```

---

## Advanced Debugging

### Enable Debug Logging

```yaml
env:
  LOG_LEVEL: 'debug'  # debug, info, warn, error
  VERBOSE: 'true'
```

### Check Action Logs

1. Go to Actions tab in GitHub
2. Click on failed workflow run
3. Expand "Multi-Provider Code Review" step
4. Look for error messages

### Download Artifacts

Reports are saved as workflow artifacts:
1. Go to workflow run
2. Scroll to "Artifacts" section
3. Download `multi-provider-review.json` and `multi-provider-review.sarif`

### Test Locally with CLI

```bash
# Clone repo
git clone <your-repo>
cd <your-repo>

# Install CLI
npm install -g multi-provider-code-review

# Review locally
mpr review

# Check cache
ls -la .mpr-cache/

# View analytics
mpr analytics summary
```

### Debug Provider Issues

```bash
# Test specific provider
export REVIEW_PROVIDERS="openrouter/google/gemini-2.0-flash-exp:free"
export OPENROUTER_API_KEY="sk-or-v1-YOUR_KEY"
mpr review --dry-run

# Check provider health
# (Self-hosted only - health checks run automatically)
```

### Common Error Codes

| Error Code | Meaning | Solution |
|------------|---------|----------|
| `ENOENT` | File not found | Check file paths, ensure `fetch-depth: 0` in workflow |
| `EACCES` | Permission denied | Check file permissions, token scopes |
| `ETIMEDOUT` | Operation timed out | Increase timeout, check network |
| `ERESOLVE` | Dependency conflict | Clear cache, reinstall dependencies |
| `ERR_MODULE_NOT_FOUND` | Missing dependency | Run `npm install`, rebuild native modules |

---

## Getting Help

### Check Documentation
- [README.md](../README.md) - Quick start guide
- [Self-Hosted Guide](./self-hosted.md) - Docker deployment
- [Analytics Guide](./analytics.md) - Dashboard setup
- [Plugin Development](./plugins.md) - Custom providers

### Report Issues
If you've tried the solutions above and still have issues:

1. **Check existing issues:** [GitHub Issues](https://github.com/keithah/multi-provider-code-review/issues)
2. **Create new issue with:**
   - Error message (full stack trace)
   - Configuration (sanitized - no API keys!)
   - Steps to reproduce
   - Environment (OS, Node version, runner type)
   - Relevant logs (from Actions or Docker)

### Community Support
- **Discussions:** Use GitHub Discussions for questions
- **Examples:** Check `__tests__` directory for usage examples
- **Source Code:** All code is open source - explore to understand behavior

---

## Quick Fixes Checklist

- [ ] Node.js version ≥ 20
- [ ] All required API keys set in GitHub Secrets
- [ ] `GITHUB_TOKEN` has `pull-requests: write` permission
- [ ] Workflow has `fetch-depth: 0` for incremental review
- [ ] Provider model names are correct
- [ ] No placeholder values in environment variables
- [ ] Budget limits not exceeded
- [ ] File patterns (include/exclude) are correct
- [ ] PR is not labeled with skip labels
- [ ] Webhook secret is secure (32+ characters)
- [ ] Docker container has built dist files
- [ ] Cache directory is writable
- [ ] Network allows outbound HTTPS

---

**Last Updated:** 2026-01-25 (v0.2.1)
