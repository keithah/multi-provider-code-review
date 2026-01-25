# Security Guide

## Overview

Multi-Provider Code Review implements security best practices:

- **Secrets detection**: Scans for 15+ types of hardcoded credentials
- **Input validation**: Prevents path traversal and injection attacks
- **Budget limits**: Prevents cost-based denial of service
- **Secure dependencies**: Regular security audits and updates
- **Least privilege**: Minimal GitHub token permissions required

## Built-in Security Features

### 1. Secrets Detection

The action automatically scans code changes for exposed credentials:

**Detected secret types:**
- AWS access keys and secret keys
- Google Cloud API keys and service account JSON
- Azure connection strings and client secrets
- Private keys (RSA, DSA, EC, OpenSSH, PGP)
- Slack tokens
- GitHub personal access tokens
- Generic API keys
- Database connection strings with credentials
- JWT tokens
- Payment provider keys (Stripe, PayPal)
- Communication service keys (Twilio, SendGrid, MailChimp)
- Hardcoded passwords

**How it works:**
```typescript
// Findings are created with 'critical' severity
{
  severity: 'critical',
  title: 'Possible AWS access key',
  message: 'Rotate the key immediately and remove it from source control.'
}
```

**Configuration:**
```yaml
- ENABLE_SECURITY: true  # Enable secrets scanning (recommended: always true)
```

**Exclusions:**
- Test files are automatically excluded
- Secrets in `__tests__/`, `*.test.ts`, `*.spec.js` are ignored
- Pattern matches are case-sensitive for precision

### 2. Input Validation

All user inputs are validated to prevent security vulnerabilities:

**Path Traversal Protection:**
```typescript
// Prevents: ../../etc/passwd
validateFilePath(filePath);  // Throws if contains '..'

// Enhanced validation with base directory restriction
const safePath = validateFilePath(userPath, '/safe/base');
// Throws if resolved path escapes base directory
```

**API Key Validation:**
```typescript
// Ensures API keys are properly formatted
validateApiKey(key, 'OpenAI');  // Checks length and format
```

**Configuration Validation:**
```typescript
// Validates all config before use
validateConfig(config);
// Checks: numeric bounds, enum values, array types, etc.
```

**Additional protections:**
- PR numbers must be positive integers
- Timeouts must be reasonable (1s - 600s)
- Budget limits must be non-negative
- Model IDs must be properly formatted
- File paths checked for:
  - Directory traversal (`..`)
  - Control characters (0x00-0x1F)
  - Double slashes (`//`)
  - Suspicious patterns

### 3. Budget Protection

Prevent cost-based denial of service:

```yaml
- BUDGET_MAX_USD: 0.50  # Hard limit per review
```

**How it works:**
- Checks cost before each provider execution
- Halts immediately when budget exceeded
- Returns partial results if budget hit mid-review
- Logs budget status to Action logs

**Recommended limits:**
- Development/staging: $0.10 - $0.50
- Production (routine): $0.50 - $1.00
- Production (critical): $1.00 - $5.00

### 4. Timeout Protection

All operations have timeout limits to prevent resource exhaustion:

```yaml
- RUN_TIMEOUT_SECONDS: 300      # Total review timeout
- PROVIDER_TIMEOUT_MS: 30000    # Per-provider timeout
- GRAPH_TIMEOUT_SECONDS: 10     # Graph analysis timeout
```

**Benefits:**
- Prevents infinite loops in provider calls
- Limits resource consumption
- Ensures predictable execution time
- Gracefully handles hung providers

### 5. Rate Limiting

Built-in provider rate limiting:

```typescript
// Automatic backoff on rate limit errors
if (response.status === 429) {
  const retryAfter = response.headers['retry-after'];
  await sleep(retryAfter * 1000);
  // Retry with exponential backoff
}
```

**Configuration:**
```yaml
- PROVIDER_RETRIES: 3           # Max retry attempts
- PROVIDER_MAX_PARALLEL: 5      # Concurrent provider calls
```

**Protection against:**
- API rate limit violations
- Provider billing overages
- Service degradation from excessive requests

## Dependency Security

### Current Status

**Moderate severity (3 vulnerabilities):**
- Package: `undici` (HTTP client)
- Issue: Unbounded decompression in HTTP responses
- Impact: Potential resource exhaustion (DoS)
- Affected: Transitive dependency via `@actions/github`

**Risk assessment:**
- **Low risk** for typical usage
- Exploitable only through malicious HTTP responses
- GitHub Actions environment has resource limits
- Not exposed to user input

**Remediation plan:**
1. Monitor for upstream fixes in `@actions/github`
2. Apply security patches when available without breaking changes
3. Regular `npm audit` runs in CI/CD pipeline

### Dependency Management

**Current practices:**
- Regular dependency updates
- Automated security scanning
- Minimal dependency footprint
- Pin exact versions in package-lock.json

**Dependencies reviewed:**
- `@actions/github`: GitHub API client (official)
- `@octokit/rest`: GitHub REST API (official)
- `openai`: OpenAI SDK (official)
- `anthropic-sdk`: Anthropic SDK (official)
- `tree-sitter`: Code parsing (widely used, audited)
- All others: Standard utility libraries

**Update policy:**
- Security patches: Applied immediately
- Minor updates: Weekly review
- Major updates: Tested before deployment
- Breaking changes: Evaluated for impact

## GitHub Token Security

### Required Permissions

**Minimal permissions needed:**
```yaml
permissions:
  contents: read        # Read repository code
  pull-requests: write  # Post review comments
```

**NOT required:**
- `contents: write` - Action never modifies code
- `admin` - No administrative access needed
- `secrets` - No access to repository secrets

### Token Best Practices

1. **Use built-in GITHUB_TOKEN:**
   ```yaml
   GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
   ```
   - Automatically generated per workflow run
   - Scoped to the repository
   - Expires after workflow completes

2. **Never use Personal Access Tokens (PAT) unless required:**
   - PATs have broader permissions
   - Longer-lived than GITHUB_TOKEN
   - Higher risk if exposed

3. **For fork PRs, use pull_request_target carefully:**
   ```yaml
   # Secure: Runs in base repo context with GITHUB_TOKEN
   on:
     pull_request_target:
   ```
   - Be aware of security implications
   - External contributors can't access secrets
   - Consider using `SKIP_LABELS` to exclude untrusted PRs

### Token Rotation

**If GITHUB_TOKEN is compromised:**
1. GitHub automatically rotates on workflow completion
2. No manual action required
3. New token generated for next run

**If PAT is used and compromised:**
1. Revoke immediately at https://github.com/settings/tokens
2. Audit Actions logs for unauthorized access
3. Generate new PAT with minimal permissions
4. Update repository secrets

## Provider API Key Security

### Secure Storage

**Always use repository secrets:**
```yaml
env:
  OPENROUTER_API_KEY: ${{ secrets.OPENROUTER_API_KEY }}
  OPENAI_API_KEY: ${{ secrets.OPENAI_API_KEY }}
  ANTHROPIC_API_KEY: ${{ secrets.ANTHROPIC_API_KEY }}
```

**Never:**
- Hardcode API keys in workflow files
- Commit keys to repository
- Log keys in Action output
- Share keys across repositories (use organization secrets if needed)

### Key Rotation

**Regular rotation schedule:**
- Free tier keys: Quarterly
- Paid tier keys: Monthly
- After team member departure: Immediately
- After suspected compromise: Immediately

**Rotation process:**
1. Generate new key from provider dashboard
2. Update GitHub repository secret
3. Revoke old key
4. Verify workflow runs successfully

### Key Scoping

**Limit key permissions:**
- OpenRouter: No special scoping available
- OpenAI: Use project-scoped keys when possible
- Anthropic: Workspace-scoped keys recommended
- Custom providers: Use read-only keys if supported

## Self-Hosted Security

### Docker Deployment

**Secure container configuration:**
```dockerfile
# Run as non-root user
USER node

# Drop unnecessary capabilities
RUN setcap cap_net_bind_service=+ep /usr/local/bin/node

# Read-only filesystem where possible
docker run --read-only --tmpfs /tmp multi-provider-review
```

**Environment variables:**
```bash
# Use secrets management, not env files
docker run \
  --env-file /dev/null \
  -e GITHUB_TOKEN=$(vault read -field=token secret/github) \
  -e OPENROUTER_API_KEY=$(vault read -field=key secret/openrouter) \
  multi-provider-review
```

### Network Security

**Firewall rules:**
```bash
# Allow outbound to provider APIs only
# GitHub API
iptables -A OUTPUT -d api.github.com -p tcp --dport 443 -j ACCEPT

# OpenRouter
iptables -A OUTPUT -d openrouter.ai -p tcp --dport 443 -j ACCEPT

# Deny all other outbound by default
iptables -P OUTPUT DROP
```

**TLS/SSL:**
- All provider connections use HTTPS
- Certificate validation enabled by default
- No plaintext API communication

### Webhook Security

**Webhook validation:**
```typescript
// Verify GitHub webhook signature
import { createHmac } from 'crypto';

function verifyWebhook(payload: string, signature: string, secret: string): boolean {
  const hmac = createHmac('sha256', secret);
  hmac.update(payload);
  const expectedSignature = `sha256=${hmac.digest('hex')}`;
  return signature === expectedSignature;
}
```

**Configuration:**
```yaml
# Set webhook secret in GitHub repository settings
# Use same secret in self-hosted deployment
WEBHOOK_SECRET: <strong-random-secret>
```

### Data Privacy

**Local data storage:**
- Cache directory: `.mpr-cache/`
- Contains: Previous review results, analytics data
- **Does NOT contain**: API keys, GitHub tokens, secrets

**Sensitive data handling:**
- Provider API responses: Not persisted to disk
- PR diffs: Cached temporarily, cleared on TTL expiration
- Findings: Stored without context code (only line numbers + messages)

**Compliance:**
- GDPR: No personal data collected
- SOC 2: Suitable for compliant deployments
- HIPAA: Not designed for healthcare data (requires additional controls)

## Security Reporting

### Reporting Vulnerabilities

**If you discover a security vulnerability:**

1. **DO NOT** open a public GitHub issue
2. **DO** email security report to maintainers
3. **DO** include:
   - Description of vulnerability
   - Steps to reproduce
   - Potential impact
   - Suggested fix (if any)

### Response Timeline

- **Acknowledgment**: Within 48 hours
- **Assessment**: Within 1 week
- **Fix**: Critical issues within 2 weeks, others within 30 days
- **Disclosure**: Coordinated disclosure after fix is released

## Security Checklist

### For GitHub Actions Users

- [ ] Use `GITHUB_TOKEN`, not Personal Access Token
- [ ] Store provider API keys in repository secrets
- [ ] Enable secrets scanning (`ENABLE_SECURITY: true`)
- [ ] Set reasonable budget limits
- [ ] Review provider permissions and scopes
- [ ] Enable Dependabot for security updates
- [ ] Monitor Action logs for errors
- [ ] Rotate API keys regularly

### For Self-Hosted Users

- [ ] Run container as non-root user
- [ ] Use secrets management (Vault, AWS Secrets Manager)
- [ ] Configure firewall rules
- [ ] Enable webhook signature validation
- [ ] Set up TLS for webhook endpoints
- [ ] Monitor container logs for suspicious activity
- [ ] Implement log aggregation and alerting
- [ ] Regular security updates (OS, Node.js, dependencies)
- [ ] Backup and rotation of cache directory
- [ ] Network segmentation (DMZ for webhook server)

## Best Practices

### Code Review Security

1. **Review provider responses** for sensitive data leaks
2. **Don't trust LLM outputs blindly** - validate suggestions
3. **Use incremental review** to limit exposure of full codebase
4. **Skip untrusted PRs** with `SKIP_LABELS`
5. **Monitor costs** for unusual activity (potential abuse)

### Configuration Security

1. **Minimal provider set** - only use what you need
2. **Conservative timeouts** - prevent resource exhaustion
3. **Budget limits** - protect against cost attacks
4. **Dry run mode** - test config changes safely
5. **Audit logs** - review Action logs regularly

### Operational Security

1. **Principle of least privilege** - minimal GitHub permissions
2. **Defense in depth** - multiple security layers
3. **Regular updates** - keep dependencies current
4. **Incident response plan** - know what to do if compromised
5. **Security monitoring** - alerts for anomalies

## Additional Resources

- [GitHub Actions Security Hardening](https://docs.github.com/en/actions/security-guides/security-hardening-for-github-actions)
- [OWASP API Security Top 10](https://owasp.org/www-project-api-security/)
- [CWE Top 25 Software Weaknesses](https://cwe.mitre.org/top25/)
- [NIST Cybersecurity Framework](https://www.nist.gov/cyberframework)

## See Also

- [Error Handling Guide](ERROR_HANDLING.md) - Resilience and recovery
- [Troubleshooting Guide](TROUBLESHOOTING.md) - Common issues
- [Self-Hosted Deployment](self-hosted.md) - Production setup
