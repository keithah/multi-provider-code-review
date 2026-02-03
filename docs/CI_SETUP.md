# CI Setup for OAuth CLI Providers

## Overview

This guide explains how to use Gemini CLI, Codex CLI, and Claude Code CLI in GitHub Actions workflows. These tools use OAuth authentication and store credentials locally, which requires special setup for CI environments.

## Authentication Strategy

The general approach for all three CLIs is:

1. **Extract credential files** from your local machine (where you're already authenticated)
2. **Store credentials as GitHub Secrets** (encrypted storage)
3. **Restore credentials** in the CI runner before running reviews

## Prerequisites

- You must be authenticated with each CLI locally before extracting credentials
- GitHub repository with Actions enabled
- GitHub CLI (`gh`) installed for managing secrets (optional but recommended)

---

## Quick Start: Automated Setup

If you have all three CLIs authenticated locally and `gh` installed, you can set up all secrets with these commands:

### For Current Repository

```bash
# Claude Code (macOS Keychain)
security find-generic-password -s "Claude Code-credentials" -w 2>/dev/null | gh secret set CLAUDE_CODE_OAUTH

# Codex CLI
cat ~/.codex/auth.json | gh secret set CODEX_AUTH_JSON
cat ~/.codex/config.toml | gh secret set CODEX_CONFIG_TOML

# Gemini CLI
cat ~/.gemini/oauth_creds.json | gh secret set GEMINI_OAUTH_CREDS
cat ~/.gemini/settings.json | gh secret set GEMINI_SETTINGS

# Verify secrets were created
gh secret list
```

### For Another Repository

Add `--repo owner/repo-name` to each command:

```bash
# Example for setting secrets in another repository
security find-generic-password -s "Claude Code-credentials" -w 2>/dev/null | \
  gh secret set CLAUDE_CODE_OAUTH --repo keithah/my-repo

cat ~/.codex/auth.json | gh secret set CODEX_AUTH_JSON --repo keithah/my-repo
cat ~/.codex/config.toml | gh secret set CODEX_CONFIG_TOML --repo keithah/my-repo
cat ~/.gemini/oauth_creds.json | gh secret set GEMINI_OAUTH_CREDS --repo keithah/my-repo
cat ~/.gemini/settings.json | gh secret set GEMINI_SETTINGS --repo keithah/my-repo
```

**✅ That's it!** Your repository now has all the required secrets. Jump to the [Complete Workflow Example](#complete-github-actions-workflow-example) to set up your workflow.

---

## Detailed Setup (Manual Method)

If you prefer to understand the process or need to set up secrets manually, follow the detailed instructions below for each CLI.

---

## Claude Code CLI

Claude Code stores credentials in the macOS Keychain on macOS systems, or in configuration files on Linux.

### macOS Setup

#### 1. Extract Credentials

```bash
# Extract OAuth credentials from macOS Keychain
security find-generic-password -s "Claude Code-credentials" -w > claude-oauth.json

# Verify the file contains valid JSON
cat claude-oauth.json | jq .
```

Expected format:
```json
{
  "claudeAiOauth": {
    "accessToken": "sk-ant-oat01-...",
    "refreshToken": "sk-ant-ort01-..."
  }
}
```

#### 2. Create GitHub Secret

```bash
# Using GitHub CLI
gh secret set CLAUDE_CODE_OAUTH --body "$(cat claude-oauth.json)"

# Clean up local copy
rm claude-oauth.json
```

Or manually via GitHub UI:
- Go to repository **Settings** → **Secrets and variables** → **Actions**
- Click **New repository secret**
- Name: `CLAUDE_CODE_OAUTH`
- Value: Paste the JSON content

#### 3. Restore in CI Workflow

For **Ubuntu runners** (Linux):

```yaml
- name: Setup Claude Code
  if: ${{ secrets.CLAUDE_CODE_OAUTH != '' }}
  run: |
    mkdir -p ~/.config/claude
    echo '${{ secrets.CLAUDE_CODE_OAUTH }}' > ~/.config/claude/credentials.json
    chmod 600 ~/.config/claude/credentials.json
```

For **macOS runners**:

```yaml
- name: Setup Claude Code (macOS)
  if: ${{ secrets.CLAUDE_CODE_OAUTH != '' }}
  run: |
    echo '${{ secrets.CLAUDE_CODE_OAUTH }}' | \
      security add-generic-password -U -s "Claude Code-credentials" -a "$USER" -w -
```

### Linux/CI Setup

On Linux systems, Claude Code may store credentials in `~/.config/claude/` instead of a keychain:

```bash
# Check for credential files
ls -la ~/.config/claude/
ls -la ~/.claude/

# If found, create secret from the credentials file
gh secret set CLAUDE_CODE_OAUTH --body "$(cat ~/.config/claude/credentials.json)"
```

---

## Codex CLI

Codex CLI stores credentials in `~/.codex/auth.json` and configuration in `~/.codex/config.toml`.

### 1. Extract Credentials

```bash
# View auth credentials (contains OAuth tokens)
cat ~/.codex/auth.json

# View configuration (contains model preferences)
cat ~/.codex/config.toml
```

**auth.json** format:
```json
{
  "OPENAI_API_KEY": null,
  "tokens": {
    "id_token": "eyJ...",
    "access_token": "eyJ...",
    "refresh_token": "rt_...",
    "account_id": "b0f8da58-..."
  },
  "last_refresh": "2026-01-29T04:23:05.356145Z"
}
```

**config.toml** format:
```toml
profile = "default"

[profiles.default]
model = "gpt-5.1-codex-max"
sandbox_mode = "danger-full-access"
approval_policy = "never"
```

### 2. Create GitHub Secrets

```bash
# Store both auth and config
gh secret set CODEX_AUTH_JSON --body "$(cat ~/.codex/auth.json)"
gh secret set CODEX_CONFIG_TOML --body "$(cat ~/.codex/config.toml)"
```

### 3. Restore in CI Workflow

```yaml
- name: Setup Codex
  if: ${{ secrets.CODEX_AUTH_JSON != '' }}
  run: |
    mkdir -p ~/.codex
    echo '${{ secrets.CODEX_AUTH_JSON }}' > ~/.codex/auth.json
    echo '${{ secrets.CODEX_CONFIG_TOML }}' > ~/.codex/config.toml
    chmod 600 ~/.codex/auth.json ~/.codex/config.toml
```

---

## Gemini CLI

Gemini CLI stores OAuth credentials in `~/.gemini/oauth_creds.json` and settings in `~/.gemini/settings.json`.

### 1. Extract Credentials

```bash
# View OAuth credentials
cat ~/.gemini/oauth_creds.json

# View settings (optional, but recommended)
cat ~/.gemini/settings.json
```

**oauth_creds.json** format:
```json
{
  "access_token": "ya29.a0...",
  "scope": "https://www.googleapis.com/auth/cloud-platform ...",
  "token_type": "Bearer",
  "id_token": "eyJ...",
  "expiry_date": 1769924118458,
  "refresh_token": "1//03E3HWTak..."
}
```

### 2. Create GitHub Secrets

```bash
gh secret set GEMINI_OAUTH_CREDS --body "$(cat ~/.gemini/oauth_creds.json)"
gh secret set GEMINI_SETTINGS --body "$(cat ~/.gemini/settings.json)"
```

### 3. Restore in CI Workflow

```yaml
- name: Setup Gemini
  if: ${{ secrets.GEMINI_OAUTH_CREDS != '' }}
  run: |
    mkdir -p ~/.gemini
    echo '${{ secrets.GEMINI_OAUTH_CREDS }}' > ~/.gemini/oauth_creds.json
    echo '${{ secrets.GEMINI_SETTINGS }}' > ~/.gemini/settings.json
    chmod 600 ~/.gemini/oauth_creds.json ~/.gemini/settings.json
```

---

## Complete GitHub Actions Workflow Example

**⚠️ Important:** The workflow in this repository (`.github/workflows/multi-provider-review.yml`) has been updated to properly create CLI configuration files from secrets. If you're using an older version of this action, make sure to update to the latest version or copy the credential setup steps shown below.

Here's a complete workflow that sets up all three CLIs and runs multi-provider code review:

```yaml
name: Multi-Provider Code Review

on:
  pull_request:
    types: [opened, synchronize, reopened]

jobs:
  review:
    runs-on: ubuntu-latest

    permissions:
      contents: read
      pull-requests: write

    steps:
      - name: Checkout code
        uses: actions/checkout@v4
        with:
          fetch-depth: 0  # Full history for better context

      # Install CLI tools
      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '20'

      - name: Install Gemini CLI
        run: npm install -g @google/gemini-cli

      - name: Install Codex CLI
        run: npm install -g codex-cli

      - name: Install Claude Code CLI
        run: |
          # Install Claude Code (adjust for your preferred installation method)
          # Example using curl (check official docs for latest)
          curl -fsSL https://claude.ai/install.sh | sh
          # Or: npm install -g @anthropic-ai/claude-code

      # Restore OAuth credentials
      - name: Setup Claude Code
        if: ${{ secrets.CLAUDE_CODE_OAUTH != '' }}
        run: |
          mkdir -p ~/.config/claude
          echo '${{ secrets.CLAUDE_CODE_OAUTH }}' > ~/.config/claude/credentials.json
          chmod 600 ~/.config/claude/credentials.json

      - name: Setup Codex
        if: ${{ secrets.CODEX_AUTH_JSON != '' }}
        run: |
          mkdir -p ~/.codex
          echo '${{ secrets.CODEX_AUTH_JSON }}' > ~/.codex/auth.json
          echo '${{ secrets.CODEX_CONFIG_TOML }}' > ~/.codex/config.toml
          chmod 600 ~/.codex/auth.json ~/.codex/config.toml

      - name: Setup Gemini
        if: ${{ secrets.GEMINI_OAUTH_CREDS != '' }}
        run: |
          mkdir -p ~/.gemini
          echo '${{ secrets.GEMINI_OAUTH_CREDS }}' > ~/.gemini/oauth_creds.json
          echo '${{ secrets.GEMINI_SETTINGS }}' > ~/.gemini/settings.json
          chmod 600 ~/.gemini/oauth_creds.json ~/.gemini/settings.json

      # Run multi-provider code review
      - name: Run Multi-Provider Code Review
        run: npx multi-provider-code-review
        env:
          GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
          # Optional: Specify which providers to use
          # REVIEW_PROVIDERS: "claude/sonnet,codex/gpt-5.1-codex-max,gemini/gemini-2.0-flash"
```

---

## Configuration Examples

### Using Specific Models

Set the `REVIEW_PROVIDERS` environment variable to specify which providers and models to use:

```yaml
- name: Run Code Review
  run: npx multi-provider-code-review
  env:
    GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
    REVIEW_PROVIDERS: "claude/sonnet,claude/opus,codex/gpt-5.1-codex-max,gemini/gemini-2.0-flash,gemini/gemini-1.5-pro"
```

### Using Configuration File

Create `.multi-provider-review.json` in your repository:

```json
{
  "providers": [
    "claude/sonnet",
    "codex/gpt-5.1-codex-max",
    "gemini/gemini-2.0-flash"
  ],
  "providerLimit": 3,
  "timeout": 60000
}
```

---

## Security Considerations

### Secret Management

1. **Never commit credentials** to your repository
   - Add credential files to `.gitignore`
   - Use GitHub Secrets for CI/CD

2. **Secret Rotation**
   - OAuth tokens expire and should be refreshed periodically
   - Update GitHub Secrets when you re-authenticate locally

3. **Least Privilege**
   - Only grant necessary permissions to GitHub Actions tokens
   - Use repository secrets, not organization/environment secrets unless needed

4. **Audit Logs**
   - Monitor GitHub Actions logs for suspicious activity
   - Review secret usage in repository audit logs

### Token Scopes

Verify OAuth scopes are appropriate:

- **Claude Code**: Should only request access to Claude AI API
- **Codex**: Requires OpenAI account with ChatGPT Pro subscription
- **Gemini**: Requires Google Cloud project with appropriate API access

### Preventing Exposure

GitHub Actions automatically masks secrets in logs, but be cautious:

```yaml
# ❌ BAD: Could expose secrets in logs
- run: echo "Token: ${{ secrets.CLAUDE_CODE_OAUTH }}"

# ✅ GOOD: Write directly to file
- run: echo '${{ secrets.CLAUDE_CODE_OAUTH }}' > ~/.config/claude/credentials.json
```

---

## Troubleshooting

### Claude Code Authentication Fails

**Symptom**: `Error: Claude Code CLI is not available`

**Solutions**:
1. Verify binary installation:
   ```bash
   which claude
   claude --version
   ```

2. Check credential file location:
   ```bash
   # Linux
   ls -la ~/.config/claude/credentials.json

   # macOS (keychain)
   security find-generic-password -s "Claude Code-credentials"
   ```

3. Test authentication locally:
   ```bash
   claude --model sonnet "Hello, world"
   ```

### Codex Model Not Found

**Symptom**: `Error: Model gpt-5.1-codex-max not found`

**Solutions**:
1. Verify your OpenAI account subscription:
   - ChatGPT Pro subscription required for Codex models

2. Check available models:
   ```bash
   codex --list-models
   ```

3. Ensure `config.toml` is correctly restored:
   ```bash
   cat ~/.codex/config.toml
   ```

### Gemini Token Expired

**Symptom**: `Error: Invalid credentials` or `Error: Token expired`

**Solutions**:
1. Google OAuth tokens expire after ~1 hour of inactivity
2. Re-authenticate locally:
   ```bash
   gemini auth login
   ```

3. Extract fresh credentials:
   ```bash
   gh secret set GEMINI_OAUTH_CREDS --body "$(cat ~/.gemini/oauth_creds.json)"
   ```

### Rate Limiting

All three CLIs may encounter rate limits:

- **Claude Code**: Anthropic API rate limits (depends on plan)
- **Codex**: OpenAI rate limits (ChatGPT Pro: ~50 messages/3 hours)
- **Gemini**: Google Cloud quota limits

**Mitigation**:
- Use `providerLimit` config to reduce concurrent requests
- Add retry logic with exponential backoff
- Distribute load across multiple providers

### CI/CD Performance

**Symptom**: Workflows timeout or run slowly

**Solutions**:
1. Reduce `providerLimit` to avoid concurrent CLI spawns:
   ```json
   {
     "providerLimit": 2,
     "timeout": 120000
   }
   ```

2. Use faster models for CI:
   ```env
   REVIEW_PROVIDERS="claude/haiku,gemini/gemini-2.0-flash"
   ```

3. Enable caching (if supported by your setup):
   ```yaml
   - uses: actions/cache@v3
     with:
       path: ~/.cache/multi-provider-review
       key: review-cache-${{ github.sha }}
   ```

---

## Platform-Specific Notes

### Ubuntu Runners (ubuntu-latest)

- All credential files stored in standard user home directory (`~/.config/`, `~/.codex/`, `~/.gemini/`)
- File permissions must be `600` for security
- No keychain access - use file-based credentials

### macOS Runners (macos-latest, macos-13)

- Claude Code may use macOS Keychain
- Use `security` command to add keychain items
- File-based fallback also supported

### Windows Runners (windows-latest)

- **Not currently tested** - credential paths may differ
- Use PowerShell equivalents:
  ```powershell
  New-Item -ItemType Directory -Force -Path "$env:USERPROFILE\.codex"
  Set-Content -Path "$env:USERPROFILE\.codex\auth.json" -Value '${{ secrets.CODEX_AUTH_JSON }}'
  ```

---

## Additional Resources

- [Claude Code CLI Documentation](https://docs.anthropic.com/claude-code)
- [Codex CLI Documentation](https://github.com/openai/codex-cli)
- [Gemini CLI Documentation](https://github.com/google/gemini-cli)
- [GitHub Actions Secrets](https://docs.github.com/en/actions/security-guides/encrypted-secrets)

---

## Summary Checklist

- [ ] Authenticate with each CLI locally
- [ ] Extract credential files
- [ ] Create GitHub Secrets
- [ ] Update workflow to restore credentials
- [ ] Install CLI binaries in workflow
- [ ] Test workflow with a test PR
- [ ] Monitor for credential expiration
- [ ] Set up secret rotation schedule
