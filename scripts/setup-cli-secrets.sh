#!/bin/bash
# Setup CLI OAuth secrets for GitHub Actions
# Usage: ./scripts/setup-cli-secrets.sh [repository] [--org organization]
#
# Examples:
#   ./scripts/setup-cli-secrets.sh keithah/my-repo          # For a specific repo
#   ./scripts/setup-cli-secrets.sh --org xbmc              # For all repos in an organization
#   ./scripts/setup-cli-secrets.sh                          # For current repo

set -e

SECRETS_DIR="/tmp/cli-secrets-export"

# Colors for output
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${BLUE}=== GitHub Actions CLI OAuth Secrets Setup ===${NC}"
echo ""

# Check if secrets exist
if [ ! -d "$SECRETS_DIR" ] || [ ! -f "$SECRETS_DIR/claude-oauth.json" ]; then
  echo -e "${YELLOW}⚠️  Credential files not found in $SECRETS_DIR${NC}"
  echo ""
  echo "Extracting credentials from local CLIs..."
  mkdir -p "$SECRETS_DIR"

  # Extract Claude Code credentials
  if security find-generic-password -s "Claude Code-credentials" -w > "$SECRETS_DIR/claude-oauth.json" 2>/dev/null; then
    echo "✅ Claude Code credentials extracted"
  else
    echo "⚠️  Claude Code credentials not found in Keychain"
  fi

  # Extract Codex credentials
  if [ -f ~/.codex/auth.json ]; then
    cp ~/.codex/auth.json "$SECRETS_DIR/codex-auth.json"
    echo "✅ Codex auth extracted"
  else
    echo "⚠️  Codex auth not found"
  fi

  if [ -f ~/.codex/config.toml ]; then
    cp ~/.codex/config.toml "$SECRETS_DIR/codex-config.toml"
    echo "✅ Codex config extracted"
  else
    echo "⚠️  Codex config not found"
  fi

  # Extract Gemini credentials
  if [ -f ~/.gemini/oauth_creds.json ]; then
    cp ~/.gemini/oauth_creds.json "$SECRETS_DIR/gemini-oauth.json"
    echo "✅ Gemini OAuth credentials extracted"
  else
    echo "⚠️  Gemini OAuth credentials not found"
  fi

  if [ -f ~/.gemini/settings.json ]; then
    cp ~/.gemini/settings.json "$SECRETS_DIR/gemini-settings.json"
    echo "✅ Gemini settings extracted"
  else
    echo "⚠️  Gemini settings not found"
  fi

  echo ""
fi

# Parse arguments
TARGET_REPO=""
TARGET_ORG=""

while [[ $# -gt 0 ]]; do
  case $1 in
    --org)
      TARGET_ORG="$2"
      shift 2
      ;;
    *)
      TARGET_REPO="$1"
      shift
      ;;
  esac
done

# Function to set secrets for a repository
set_repo_secrets() {
  local repo=$1
  echo -e "${BLUE}Setting secrets for repository: $repo${NC}"

  if [ -f "$SECRETS_DIR/claude-oauth.json" ]; then
    gh secret set CLAUDE_CODE_OAUTH --repo "$repo" --body "$(cat $SECRETS_DIR/claude-oauth.json)"
    echo "  ✅ CLAUDE_CODE_OAUTH"
  fi

  if [ -f "$SECRETS_DIR/codex-auth.json" ]; then
    gh secret set CODEX_AUTH_JSON --repo "$repo" --body "$(cat $SECRETS_DIR/codex-auth.json)"
    echo "  ✅ CODEX_AUTH_JSON"
  fi

  if [ -f "$SECRETS_DIR/codex-config.toml" ]; then
    gh secret set CODEX_CONFIG_TOML --repo "$repo" --body "$(cat $SECRETS_DIR/codex-config.toml)"
    echo "  ✅ CODEX_CONFIG_TOML"
  fi

  if [ -f "$SECRETS_DIR/gemini-oauth.json" ]; then
    gh secret set GEMINI_OAUTH_CREDS --repo "$repo" --body "$(cat $SECRETS_DIR/gemini-oauth.json)"
    echo "  ✅ GEMINI_OAUTH_CREDS"
  fi

  if [ -f "$SECRETS_DIR/gemini-settings.json" ]; then
    gh secret set GEMINI_SETTINGS --repo "$repo" --body "$(cat $SECRETS_DIR/gemini-settings.json)"
    echo "  ✅ GEMINI_SETTINGS"
  fi

  echo ""
}

# Function to set secrets for an organization
set_org_secrets() {
  local org=$1
  echo -e "${BLUE}Setting secrets for organization: $org${NC}"
  echo ""
  echo "Note: Organization secrets will be visible to all repos in the org."
  echo "You'll need to set visibility for each secret."
  echo ""

  if [ -f "$SECRETS_DIR/claude-oauth.json" ]; then
    gh secret set CLAUDE_CODE_OAUTH --org "$org" --visibility all --body "$(cat $SECRETS_DIR/claude-oauth.json)"
    echo "  ✅ CLAUDE_CODE_OAUTH"
  fi

  if [ -f "$SECRETS_DIR/codex-auth.json" ]; then
    gh secret set CODEX_AUTH_JSON --org "$org" --visibility all --body "$(cat $SECRETS_DIR/codex-auth.json)"
    echo "  ✅ CODEX_AUTH_JSON"
  fi

  if [ -f "$SECRETS_DIR/codex-config.toml" ]; then
    gh secret set CODEX_CONFIG_TOML --org "$org" --visibility all --body "$(cat $SECRETS_DIR/codex-config.toml)"
    echo "  ✅ CODEX_CONFIG_TOML"
  fi

  if [ -f "$SECRETS_DIR/gemini-oauth.json" ]; then
    gh secret set GEMINI_OAUTH_CREDS --org "$org" --visibility all --body "$(cat $SECRETS_DIR/gemini-oauth.json)"
    echo "  ✅ GEMINI_OAUTH_CREDS"
  fi

  if [ -f "$SECRETS_DIR/gemini-settings.json" ]; then
    gh secret set GEMINI_SETTINGS --org "$org" --visibility all --body "$(cat $SECRETS_DIR/gemini-settings.json)"
    echo "  ✅ GEMINI_SETTINGS"
  fi

  echo ""
  echo -e "${GREEN}Organization secrets created! They are now available to all repos in $org.${NC}"
}

# Execute based on arguments
if [ -n "$TARGET_ORG" ]; then
  # Set organization secrets
  set_org_secrets "$TARGET_ORG"
elif [ -n "$TARGET_REPO" ]; then
  # Set secrets for specific repository
  set_repo_secrets "$TARGET_REPO"
else
  # Set secrets for current repository
  CURRENT_REPO=$(gh repo view --json nameWithOwner -q '.nameWithOwner')
  set_repo_secrets "$CURRENT_REPO"
fi

echo -e "${GREEN}=== Setup complete! ===${NC}"
echo ""
echo "Your CLI OAuth secrets are now configured for GitHub Actions."
echo ""
echo "You can now use these providers in your workflows:"
echo "  • claude/sonnet, claude/opus, claude/haiku"
echo "  • codex/gpt-5.1-codex-max"
echo "  • gemini/gemini-2.0-flash, gemini/gemini-1.5-pro"
echo ""
echo "Example workflow usage:"
echo "  env:"
echo "    REVIEW_PROVIDERS: 'claude/sonnet,codex/gpt-5.1-codex-max,gemini/gemini-2.0-flash'"
echo ""
echo "Clean up credential files when done:"
echo "  rm -rf $SECRETS_DIR"
