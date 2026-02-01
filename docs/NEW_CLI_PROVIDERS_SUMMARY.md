# New CLI Providers Implementation Summary

## Overview

Successfully implemented support for three OAuth-based CLI providers:
- **Claude Code CLI** (`claude/<model>`)
- **Codex CLI** (`codex/<model>`)
- **Gemini CLI** (`gemini/<model>`)

## Files Created

### Provider Implementations
1. **src/providers/claude-code.ts** - Claude Code CLI provider
2. **src/providers/codex.ts** - Codex CLI provider
3. **src/providers/gemini.ts** - Gemini CLI provider

### Documentation
4. **docs/CI_SETUP.md** - Comprehensive CI/CD setup guide for OAuth CLIs
5. **docs/NEW_CLI_PROVIDERS_SUMMARY.md** - This summary file

### Tests
6. **__tests__/unit/providers/new-cli-providers.test.ts** - Provider validation tests
7. **__tests__/unit/providers/registry-cli-providers.test.ts** - Registry integration tests

## Files Modified

### Core Files
1. **src/providers/base.ts** - Updated validation pattern to support new provider prefixes
2. **src/providers/registry.ts** - Added imports and instantiation logic for new providers
3. **README.md** - Added "Supported Providers" section with OAuth CLI documentation

## Implementation Details

### Provider Features

All three providers follow the same pattern as `OpenCodeProvider`:

- ✅ Binary resolution with fallback paths
- ✅ Temporary file creation for prompts (avoids shell injection)
- ✅ Process timeout handling with process group killing
- ✅ Health check via binary availability verification
- ✅ JSON finding extraction from responses
- ✅ Proper error handling and logging

### Provider-Specific Details

#### Claude Code Provider
- Binary paths: `claude`, `/usr/local/bin/claude`, `~/.local/bin/claude`
- Command: `claude --model <model> --print --no-session-persistence --output-format json <prompt-file>`
- Credentials: macOS Keychain or `~/.config/claude/credentials.json`

#### Codex Provider
- Binary paths: `codex`, `codex-cli`
- Command: `codex --model <model> --dangerously-bypass-approvals-and-sandbox -c approval_policy=never <prompt>`
- Credentials: `~/.codex/auth.json`, `~/.codex/config.toml`

#### Gemini Provider
- Binary paths: `gemini`, `npx @google/gemini-cli`
- Command: `gemini --model <model> --prompt <prompt-file> --output-format json --approval-mode yolo`
- Credentials: `~/.gemini/oauth_creds.json`, `~/.gemini/settings.json`

## Test Results

All tests passing:

### New Provider Tests
```
✓ should validate claude/ provider names
✓ should validate codex/ provider names
✓ should validate gemini/ provider names
✓ should still validate existing provider patterns
✓ should reject invalid provider patterns
✓ should create provider with correct name format (all 3 providers)
✓ should create provider for different models (all 3 providers)
```

### Registry Integration Tests
```
✓ should instantiate Claude Code providers
✓ should instantiate Codex providers
✓ should instantiate Gemini providers
✓ should instantiate mixed provider types
✓ should skip invalid provider names
```

**Total: 16 new tests, 100% passing**

## Build Verification

✅ TypeScript compilation successful
✅ All provider classes bundled correctly
✅ Validation patterns included in bundle
✅ Registry instantiation logic working
✅ No regressions in existing tests

## Usage Examples

### Local Development

```bash
# Set providers via environment variable
export REVIEW_PROVIDERS="claude/sonnet,codex/gpt-5.1-codex-max,gemini/gemini-2.0-flash"

# Run review
mpr review
```

### GitHub Actions

```yaml
- name: Run Multi-Provider Review
  run: npx multi-provider-code-review
  env:
    GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
    REVIEW_PROVIDERS: "claude/sonnet,claude/opus,codex/gpt-5.1-codex-max,gemini/gemini-2.0-flash"
```

### Configuration File

```json
{
  "providers": [
    "claude/sonnet",
    "claude/opus",
    "codex/gpt-5.1-codex-max",
    "gemini/gemini-2.0-flash",
    "gemini/gemini-1.5-pro"
  ],
  "providerLimit": 5
}
```

## GitHub Actions CI/CD Setup

See **[docs/CI_SETUP.md](./CI_SETUP.md)** for complete instructions on:

1. Extracting OAuth credentials from local machine
2. Storing credentials as GitHub Secrets
3. Restoring credentials in CI workflows
4. Complete workflow examples
5. Security considerations
6. Troubleshooting guide

### Quick Setup Summary

For each CLI:

1. **Extract credentials** (local machine)
   ```bash
   # Claude Code (macOS)
   security find-generic-password -s "Claude Code-credentials" -w > claude-oauth.json

   # Codex
   cat ~/.codex/auth.json

   # Gemini
   cat ~/.gemini/oauth_creds.json
   ```

2. **Create GitHub Secrets**
   ```bash
   gh secret set CLAUDE_CODE_OAUTH --body "$(cat claude-oauth.json)"
   gh secret set CODEX_AUTH_JSON --body "$(cat ~/.codex/auth.json)"
   gh secret set GEMINI_OAUTH_CREDS --body "$(cat ~/.gemini/oauth_creds.json)"
   ```

3. **Restore in workflow**
   ```yaml
   - name: Setup CLIs
     run: |
       mkdir -p ~/.config/claude ~/.codex ~/.gemini
       echo '${{ secrets.CLAUDE_CODE_OAUTH }}' > ~/.config/claude/credentials.json
       echo '${{ secrets.CODEX_AUTH_JSON }}' > ~/.codex/auth.json
       echo '${{ secrets.GEMINI_OAUTH_CREDS }}' > ~/.gemini/oauth_creds.json
       chmod 600 ~/.config/claude/credentials.json ~/.codex/auth.json ~/.gemini/oauth_creds.json
   ```

## Verification Steps

### 1. Local Testing (Prerequisites: CLIs installed and authenticated)

```bash
# Test provider validation
npm test -- __tests__/unit/providers/new-cli-providers.test.ts

# Test registry integration
npm test -- __tests__/unit/providers/registry-cli-providers.test.ts

# Full test suite
npm run test:unit
```

### 2. Build Verification

```bash
# Build project
npm run build

# Verify providers in bundle
node -e "
const fs = require('fs');
const code = fs.readFileSync('./dist/index.js', 'utf8');
console.log('ClaudeCodeProvider:', code.includes('ClaudeCodeProvider') ? '✓' : '✗');
console.log('CodexProvider:', code.includes('CodexProvider') ? '✓' : '✗');
console.log('GeminiProvider:', code.includes('GeminiProvider') ? '✓' : '✗');
"
```

### 3. End-to-End Testing (Requires CLI installation)

```bash
# Install CLIs
npm install -g @google/gemini-cli
npm install -g codex-cli
# Install claude (see official docs)

# Authenticate each CLI
claude auth login
codex auth login
gemini auth login

# Test with dry-run
export REVIEW_PROVIDERS="claude/sonnet,codex/gpt-5.1-codex-max,gemini/gemini-2.0-flash"
mpr review --dry-run

# Test actual review
mpr review HEAD~1
```

## Known Limitations

1. **Binary Availability**: Providers will be skipped if CLI is not installed
2. **Authentication**: Requires manual authentication before first use
3. **Token Expiration**: OAuth tokens may expire (varies by provider)
4. **Rate Limits**:
   - Claude Code: Depends on Anthropic plan
   - Codex: ChatGPT Pro limits (~50 messages/3 hours)
   - Gemini: Google Cloud quota
5. **Platform Support**:
   - Tested on macOS and Linux
   - Windows support not verified

## Security Considerations

✅ All credential files created with `0600` permissions (owner read/write only)
✅ Temporary prompt files in secure directories (`0700` permissions)
✅ GitHub Secrets automatically masked in workflow logs
✅ Process group killing prevents zombie processes
✅ Validation prevents shell injection in provider names

## Future Enhancements

Potential improvements for future versions:

1. **Auto-Discovery**: Detect installed CLIs and add to provider list automatically
2. **Token Refresh**: Implement automatic OAuth token refresh
3. **Model Discovery**: Query CLIs for available models dynamically
4. **Streaming Support**: Use streaming JSON output for real-time feedback
5. **Multi-Account**: Support multiple OAuth accounts per CLI
6. **Cost Tracking**: Track usage costs for CLI providers
7. **Caching**: Cache CLI responses to reduce API calls

## Migration Guide

For existing users upgrading to this version:

### No Breaking Changes
- All existing provider configurations continue to work
- No changes required to existing workflows
- New providers are opt-in via configuration

### Adding New Providers

**Option 1: Environment Variable**
```bash
# Add to existing providers
export REVIEW_PROVIDERS="openrouter/google/gemini-2.0-flash-exp:free,claude/sonnet,codex/gpt-5.1-codex-max"
```

**Option 2: Configuration File**
```json
{
  "providers": [
    "openrouter/google/gemini-2.0-flash-exp:free",
    "opencode/minimax-m2.1-free",
    "claude/sonnet",
    "codex/gpt-5.1-codex-max",
    "gemini/gemini-2.0-flash"
  ]
}
```

## Documentation Links

- **[CI Setup Guide](./CI_SETUP.md)** - Complete CI/CD configuration
- **[README.md](../README.md#supported-providers)** - Main documentation with provider overview
- **[User Guide](./user-guide.md)** - General usage instructions

## Support

For issues or questions:
- **GitHub Issues**: [Report bugs](https://github.com/keithah/multi-provider-code-review/issues)
- **Documentation**: Check [docs/](./docs/) directory
- **CI/CD Help**: See [CI_SETUP.md](./CI_SETUP.md) troubleshooting section

## Changelog

### v0.2.1 - OAuth CLI Providers

**Added:**
- Claude Code CLI provider support (`claude/<model>`)
- Codex CLI provider support (`codex/<model>`)
- Gemini CLI provider support (`gemini/<model>`)
- Comprehensive CI/CD setup documentation
- 16 new unit tests for provider validation and registry integration

**Modified:**
- Provider validation regex to support new prefixes
- README with OAuth provider documentation
- Provider registry with new instantiation logic

**Testing:**
- ✅ 16 new tests (100% passing)
- ✅ No regressions in existing tests
- ✅ TypeScript compilation successful
- ✅ Bundle verification complete
