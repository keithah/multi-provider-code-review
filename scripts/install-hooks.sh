#!/bin/bash
#
# Install git hooks for development
#

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
HOOKS_DIR="$REPO_ROOT/.git/hooks"

echo "📦 Installing git hooks..."
echo ""

# Create hooks directory if it doesn't exist
mkdir -p "$HOOKS_DIR"

# Install pre-commit hook
if [ -f "$HOOKS_DIR/pre-commit" ]; then
  echo "⚠️  pre-commit hook already exists"
  read -p "Overwrite? (y/N) " -n 1 -r
  echo
  if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    echo "Skipping pre-commit hook"
    exit 0
  fi
fi

ln -sf "../../scripts/pre-commit.sh" "$HOOKS_DIR/pre-commit"
echo "✅ Installed pre-commit hook"
echo ""

echo "🎉 Git hooks installed successfully!"
echo ""
echo "The pre-commit hook will run:"
echo "  • Type checking"
echo "  • Linting"
echo "  • Unit tests"
echo "  • Build verification"
echo ""
echo "To skip the hook: git commit --no-verify"
