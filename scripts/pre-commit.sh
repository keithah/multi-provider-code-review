#!/bin/bash
#
# Pre-commit hook for multi-provider code review
#
# Install: ln -s ../../scripts/pre-commit.sh .git/hooks/pre-commit
#
# This hook runs basic checks before commit:
# 1. Type checking
# 2. Linting
# 3. Unit tests
#
# To skip hook: git commit --no-verify

set -e

echo "🔍 Running pre-commit checks..."
echo ""

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Track if any checks fail
FAILED=0

# 1. Type checking
echo "📝 Type checking..."
if npm run typecheck > /dev/null 2>&1; then
  echo -e "${GREEN}✓${NC} Type checking passed"
else
  echo -e "${RED}✗${NC} Type checking failed"
  npm run typecheck
  FAILED=1
fi
echo ""

# 2. Linting
echo "🔧 Linting..."
if npm run lint > /dev/null 2>&1; then
  echo -e "${GREEN}✓${NC} Linting passed"
else
  echo -e "${RED}✗${NC} Linting failed"
  npm run lint
  FAILED=1
fi
echo ""

# 3. Unit tests (fast subset - not integration tests)
echo "🧪 Running unit tests..."
if npm test -- --testPathIgnorePatterns=integration --testPathIgnorePatterns=benchmarks > /dev/null 2>&1; then
  echo -e "${GREEN}✓${NC} Unit tests passed"
else
  echo -e "${RED}✗${NC} Unit tests failed"
  npm test -- --testPathIgnorePatterns=integration --testPathIgnorePatterns=benchmarks
  FAILED=1
fi
echo ""

# 4. Build check
echo "🏗️  Building..."
if npm run build > /dev/null 2>&1; then
  echo -e "${GREEN}✓${NC} Build successful"
else
  echo -e "${RED}✗${NC} Build failed"
  npm run build
  FAILED=1
fi
echo ""

# Summary
if [ $FAILED -eq 0 ]; then
  echo -e "${GREEN}✅ All pre-commit checks passed!${NC}"
  echo ""
  exit 0
else
  echo -e "${RED}❌ Some checks failed. Please fix the issues above.${NC}"
  echo -e "${YELLOW}Tip: Use 'git commit --no-verify' to skip these checks (not recommended)${NC}"
  echo ""
  exit 1
fi
