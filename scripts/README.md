# Development Scripts

This directory contains helper scripts for development workflows.

## Available Scripts

### pre-commit.sh

Pre-commit hook that runs before each commit to ensure code quality.

**What it checks:**
- ✅ Type checking (TypeScript)
- ✅ Linting (ESLint)
- ✅ Unit tests (fast tests only)
- ✅ Build verification

**Installation:**
```bash
npm run hooks:install
```

Or manually:
```bash
ln -s ../../scripts/pre-commit.sh .git/hooks/pre-commit
```

**Usage:**
The hook runs automatically on `git commit`. To skip:
```bash
git commit --no-verify
```

**Performance:**
- Runs only fast unit tests (not integration tests or benchmarks)
- Typical execution time: 5-10 seconds
- Provides fast feedback before push

### install-hooks.sh

Installer script for git hooks.

**Usage:**
```bash
npm run hooks:install
```

Or directly:
```bash
bash scripts/install-hooks.sh
```

## Recommended Workflow

1. **Initial Setup:**
   ```bash
   npm install
   npm run hooks:install
   ```

2. **Development:**
   - Make changes
   - Run tests: `npm test`
   - Commit: `git commit` (hook runs automatically)
   - Push: `git push`

3. **Before Creating PR:**
   ```bash
   npm run test:coverage  # Check coverage
   npm run benchmark      # Run performance tests
   npm run lint           # Final lint check
   npm run build:prod     # Production build
   ```

## CI/CD Integration

The pre-commit checks mirror what runs in CI, ensuring:
- Early detection of issues
- Faster CI feedback cycles
- Reduced failed CI builds
- Better developer experience

## Customization

To modify pre-commit checks, edit `scripts/pre-commit.sh`. Consider:
- Adding format checking
- Running security scans
- Checking commit message format
- Validating branch names

## Troubleshooting

**Hook not running:**
```bash
# Check if hook is installed
ls -la .git/hooks/pre-commit

# Reinstall if needed
npm run hooks:install
```

**Hook failing unexpectedly:**
```bash
# Run checks manually to see details
npm run typecheck
npm run lint
npm run test:unit
npm run build
```

**Need to skip hook temporarily:**
```bash
# Not recommended, but useful in emergencies
git commit --no-verify
```
