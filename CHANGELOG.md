# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.3.0] - 2026-01-28

### Added

#### Scalability & Reliability

- **Token-Aware Batching** - Intelligent file batching based on LLM context windows:
  - Automatic batch size calculation using token estimation
  - Supports models with varying context limits (4k to 1M tokens)
  - Greedy bin-packing algorithm for optimal batch distribution
  - Conservative token estimation with 20% safety margin
  - Per-model context window configuration
  - Prevents context window overflows that caused review failures
  - Implementation: `src/utils/token-estimation.ts` with `calculateOptimalBatchSize()`

- **Circuit Breaker Pattern** - Automatic provider failure handling:
  - 3-state machine: CLOSED → OPEN → HALF_OPEN
  - Configurable failure threshold (default: 3 consecutive failures)
  - Automatic cooldown period (default: 5 minutes)
  - Single probe request during recovery testing
  - Persistent state across process restarts
  - In-memory fallback when storage unavailable
  - Concurrency-safe with promise-chain locks
  - Lock cleanup timer prevents deadlocks (10s timeout)
  - Implementation: `src/providers/circuit-breaker.ts`

- **Live Progress Tracking** - Real-time PR status updates:
  - Progress comment updated during review execution
  - Shows provider health status, file batches, and completion percentage
  - Reuses single comment to avoid spam
  - Automatic retry with exponential backoff on GitHub API failures
  - Rate limit tracking and header inspection
  - Implementation: `src/github/comment-poster.ts`, `src/github/rate-limit.ts`

- **Provider Discovery** - Automatic fallback provider discovery:
  - Discovers healthy free providers when configured providers fail
  - Health checks for provider availability
  - Filters out blocked/paid providers after 402 responses
  - Broadened discovery pool with extra health-check retries
  - Allows fallback with healthy OpenCode providers
  - Records health check successes for reliability tracking
  - Implementation: `src/providers/registry.ts`

#### Developer Experience

- **Enhanced Test Coverage** - Comprehensive test improvements:
  - Graph cloning independence verification
  - Circular reference handling tests
  - Provider sorting by reliability tests
  - Circuit breaker concurrency tests
  - Total: 676 tests passing across 65 test suites

- **Test Artifacts Management** - Clean git working tree:
  - `.gitignore` updated to exclude `.mpr-cache-test-*` directories
  - Excludes test backup files (`__tests__/**/*.bak*`)
  - Excludes implementation plans (`IMPLEMENTATION_PLANS.md`)

### Changed

#### Performance Improvements

- **Token Estimation Safety Margin** - Increased from 1.1x to 1.2x (10% → 20%):
  - Accounts for language-specific tokenization differences
  - Handles Unicode/emoji content more accurately
  - Accommodates long identifiers in some codebases
  - Prevents context window overflows with model-specific tokenizer variations
  - Updated: `src/utils/token-estimation.ts:estimateTokensConservative()`

#### Reliability Enhancements

- **Circuit Breaker Storage** - Graceful degradation with in-memory fallback:
  - Tracks storage health (`storageAvailable` flag)
  - Falls back to in-memory state on storage failures
  - Always updates in-memory first for immediate consistency
  - Best-effort persistence to disk
  - Prevents circuit breaker failures from blocking reviews
  - Updated: `src/providers/circuit-breaker.ts`

- **Provider Health Checks** - More aggressive retry strategy:
  - Extra retries for health checks before marking providers unhealthy
  - Success recording for reliability tracking
  - Better recovery from transient network issues
  - Updated: `src/providers/registry.ts`

#### Code Quality

- **Graph Builder Validation** - Fixed line number validation:
  - Changed from `>= 0` to `>= 1` (lines are 1-indexed in editors)
  - Clearer error messages for invalid definitions
  - Updated: `src/analysis/context/graph-builder.ts:112`

- **Path Matcher Security** - Enhanced input validation:
  - Removed control characters from dangerous chars regex (lint fix)
  - Updated error messages to match actual allowlist
  - Consistent documentation across comments and errors
  - Updated: `src/analysis/path-matcher.ts`

- **OpenCode Provider** - Removed unused variables:
  - Cleaned up timeout race condition handling
  - Lint warning fixes
  - Updated: `src/providers/opencode.ts`

### Fixed

#### Critical Fixes

- **Workflow Concurrency** - Fixed cross-event cancellation bug:
  - Event-specific concurrency group prefixes prevent collision
  - PR events: `pr-{number}-{sha}`
  - Push events: `push-{sha}`
  - Workflow dispatch: `dispatch-{pr}-{sha}`
  - Prevents `pull_request` from canceling `push` workflows
  - Fixed: `.github/workflows/multi-provider-review.yml:11`

- **Fork PR Security** - Hard fail on unexpected secret access:
  - Explicit check for OPENROUTER_API_KEY in fork PRs
  - Exits with error code 1 to prevent workflow execution
  - Prevents repository misconfiguration from exposing secrets
  - Fixed: `.github/workflows/multi-provider-review.yml:79-86`

- **Circuit Breaker Race Condition** - Fixed lock cleanup timing:
  - Moved `clearTimeout()` before `release()` in finally block
  - Prevents timer from firing between release and clear
  - Eliminates race condition in concurrent lock acquisition
  - Fixed: `src/providers/circuit-breaker.ts:314-316`

#### Test Fixes

- **Graph Incremental Tests** - Updated to use correct API methods:
  - Changed `getCalls()` to `getDefinition()`
  - Changed `getSymbolsInFile()` to `getFileSymbols()`
  - Added clone independence verification test
  - Enhanced circular reference handling test
  - Fixed: `__tests__/unit/analysis/graph-incremental.test.ts`

- **Provider Registry Tests** - Added sorting verification:
  - Asserts provider order matches reliability scores
  - Verifies highest reliability providers selected first
  - Tests exploration rate configurations
  - Fixed: `__tests__/unit/providers/registry-reliability.test.ts`

### Breaking Changes

⚠️ **Cache Version Bump** - Cache schema updated from v3 to v4:
- **Impact**: Previous cache entries will be invalidated
- **Reason**: Added data field validation and schema changes
- **Migration**: Cache will automatically rebuild on first run after upgrade
- **Performance**: First review after upgrade may be slower (no cache hits)

⚠️ **Configuration Schema Changes** - New required fields:
- `providerExplorationRate` (default: 0.3) - Controls exploit/explore balance
- `providerSelectionStrategy` (default: 'reliability') - Provider selection algorithm

### Migration Guide

#### Upgrading from v0.2.x to v0.3.0

1. **Update Configuration** (optional, defaults provided):
   ```yaml
   # Add to your .github/multi-provider-review.yml if you want custom values
   providerExplorationRate: 0.3  # 30% exploration, 70% exploitation
   providerSelectionStrategy: reliability  # or 'random'
   ```

2. **Clear Cache** (optional, for clean slate):
   ```bash
   rm -rf .mpr-cache
   ```

3. **Update Workflow** (if you have custom workflow):
   - Review concurrency group configuration
   - Ensure fork PR secret handling is in place
   - Update to latest workflow from `.github/workflows/multi-provider-review.yml`

4. **Provider Configuration**:
   - No changes needed - existing provider lists work as-is
   - Circuit breaker automatically manages unhealthy providers
   - Fallback discovery finds alternatives if configured providers fail

5. **First Run After Upgrade**:
   - Expect cache rebuild (slower first review)
   - Circuit breaker starts with clean state (all providers healthy)
   - Progress tracking will show new status format

#### Rollback Procedure

If you need to rollback to v0.2.1:

1. **Checkout Previous Version**:
   ```bash
   git checkout v0.2.1
   npm install
   ```

2. **Clear v4 Cache**:
   ```bash
   rm -rf .mpr-cache
   ```

3. **Restore Workflow** (if modified):
   ```bash
   git checkout v0.2.1 -- .github/workflows/multi-provider-review.yml
   git commit -m "Rollback to v0.2.1 workflow"
   git push
   ```

4. **Known Rollback Issues**:
   - Circuit breaker state will be lost (all providers reset to healthy)
   - Progress comments may have different format
   - Token-aware batching reverts to fixed batch sizes

5. **Report Rollback**:
   - If you needed to rollback, please report the issue: https://github.com/anthropics/multi-provider-code-review/issues
   - Include error messages, workflow logs, and configuration

### Monitoring Recommendations

#### Key Metrics to Track

1. **Circuit Breaker Health**:
   - Monitor circuit state changes (CLOSED → OPEN transitions)
   - Track provider failure rates
   - Alert on providers stuck in OPEN state for > 1 hour
   - Check logs for: `Circuit opened for`, `Circuit closed for`

2. **Token Estimation Accuracy**:
   - Monitor context window overflow errors (should be near zero)
   - Track batch sizes and utilization percentages
   - Alert on utilization > 90% (indicates safety margin is needed)
   - Check logs for: `Context window has sufficient headroom`

3. **Progress Tracking**:
   - Monitor GitHub API rate limit consumption
   - Track comment update frequency
   - Alert on rate limit errors or 5xx responses
   - Check logs for: `Rate limit`, `GitHub API error`

4. **Provider Discovery**:
   - Track fallback provider activation frequency
   - Monitor discovery success/failure rates
   - Alert if no healthy providers found
   - Check logs for: `Discovering fallback providers`, `Health check`

#### Alerting Setup

```bash
# Example: Monitor circuit breaker for stuck OPEN states
grep "Circuit opened for" logs.txt | \
  awk '{print $NF}' | sort | uniq -c | \
  awk '$1 > 3 {print "ALERT: Provider", $2, "opened", $1, "times"}'

# Example: Check token estimation overflows
grep "exceeds context window" logs.txt | wc -l

# Example: Track rate limit consumption
grep "Rate limit" logs.txt | tail -n 20
```

#### Dashboard Queries

If using structured logging (JSON):

```javascript
// Circuit breaker state distribution
SELECT provider, state, COUNT(*)
FROM circuit_events
WHERE timestamp > NOW() - INTERVAL '1 hour'
GROUP BY provider, state

// Token utilization histogram
SELECT
  CASE
    WHEN utilization < 50 THEN 'Low'
    WHEN utilization < 75 THEN 'Medium'
    WHEN utilization < 90 THEN 'High'
    ELSE 'Critical'
  END AS utilization_band,
  COUNT(*) as requests
FROM batch_events
GROUP BY utilization_band

// Provider health over time
SELECT
  DATE_TRUNC('hour', timestamp) as hour,
  provider,
  AVG(CASE WHEN success THEN 1 ELSE 0 END) as success_rate
FROM health_checks
GROUP BY hour, provider
ORDER BY hour DESC
```

### Performance

- **Batch Processing**: Reviews now scale to hundreds of files without context overflow
- **Circuit Breaker**: Eliminates wasted API calls to unhealthy providers
- **Progress Tracking**: Minimal overhead (<1% of review time)
- **In-Memory Fallback**: Zero degradation if storage temporarily unavailable

### Security

- **Fork PR Protection**: Hard fail prevents secret exposure via repository misconfiguration
- **Path Validation**: Enhanced input sanitization in path matching
- **Workflow Isolation**: Fixed concurrency collision prevents cross-event interference

### Tests

- **676 tests passing** across 65 test suites (100% pass rate)
- New test coverage:
  - Circuit breaker concurrency and state transitions
  - Token estimation with various content types
  - Graph cloning independence
  - Provider sorting by reliability
  - Workflow concurrency group generation

### Branch

- All changes on `phase1-batching-circuit` branch
- Ready for merge to `main`
- Includes comprehensive test coverage and documentation

---

## [0.2.1] - 2026-01-25

### Added

#### User Experience Improvements
- **Code Snippets in Inline Comments** - Inline review comments now include code context (3 lines before/after) with syntax highlighting and line numbers, making it easier to understand findings without switching files
- **CLI Colors & Progress Indicators** - New centralized color utility (`src/cli/colors.ts`) with:
  - Semantic colors (error, warn, success, critical, major, minor)
  - Spinner class for progress indication
  - Progress bars for long-running operations
  - Table formatting and boxed messages
  - Respects `NO_COLOR` environment variable and TTY detection
- **Dismiss/Suppress Functionality** - Documented existing feature to suppress findings by adding 👎 reaction to inline comments:
  - Suppressed findings won't appear in future reviews
  - Works per-PR with incremental reviews
  - Case-insensitive matching on file:line:title

#### Documentation
- **User Guide** (`docs/user-guide.md`) - Comprehensive guide covering:
  - How to dismiss findings with reactions
  - Feedback learning system
  - Tips for effective review management
  - Quiet mode, severity filtering, and dry-run usage
- **Performance Guide** (`docs/PERFORMANCE.md`) - Optimization strategies including:
  - Performance characteristics and targets
  - 8 optimization strategies (incremental review, provider selection, parallel execution, etc.)
  - Performance monitoring with analytics
  - Troubleshooting slow reviews
  - Configuration examples (speed/quality/cost optimized)
- **Error Handling Guide** (`docs/ERROR_HANDLING.md`) - Error recovery documentation:
  - 7 error handling patterns (retry logic, graceful degradation, fallbacks, etc.)
  - Common error scenarios and solutions
  - Automatic and manual recovery strategies
  - Monitoring and alerts setup
  - Debugging tips
- **Security Guide** (`docs/SECURITY.md`) - Security best practices:
  - Built-in security features (secrets detection for 15+ types)
  - Input validation and path traversal protection
  - Budget and timeout protection
  - Dependency security audit
  - GitHub token and API key security
  - Self-hosted deployment security
  - Security reporting process
- **Troubleshooting Guide** (`docs/TROUBLESHOOTING.md`) - Common issues and fixes:
  - Installation issues
  - API key problems
  - Provider failures
  - Performance issues
  - GitHub integration problems
  - Advanced debugging techniques

### Changed

#### Code Quality
- **Refactored CLI Formatter** - Updated `src/cli/formatter.ts` to use centralized color utility for better maintainability and consistency
- **Enhanced Comment Poster** - Updated `src/github/comment-poster.ts` to fetch file contents and include code snippets in inline comments
- **Extended GitHub Client** - Added `getFileContent()` method to `src/github/client.ts` for retrieving file contents at specific commits

### Fixed

- **Integration Test** - Fixed github-mock integration test to properly mock `getFileContent()` method
- **All Tests Passing** - 332/332 tests passing (100%), including 26 new tests for code snippets and feedback filtering

### Security

- **Dependency Audit** - Documented 3 moderate severity vulnerabilities in `undici` (transitive dependency):
  - Low risk for typical usage (DoS via malicious HTTP responses)
  - Monitoring for upstream fixes in `@actions/github`
  - Not exposed to user input in GitHub Actions environment
- **Security Review** - Confirmed all security best practices implemented:
  - Secrets detection for 15+ credential types
  - Path traversal protection with enhanced validation
  - Input sanitization for all user inputs
  - Budget limits to prevent cost-based DoS
  - Timeout protection on all operations

### Tests

- Added `__tests__/unit/utils/code-snippet.test.ts` - 14 tests for code snippet extraction:
  - Extract snippet with context
  - Handle first/last lines
  - Format with/without line numbers
  - Language detection for 30+ file types
  - Enhanced comment body creation
- Added `__tests__/unit/github/feedback-filter.test.ts` - 12 tests for dismiss functionality:
  - Load suppressed findings from thumbs-down reactions
  - Filter inline comments based on suppression
  - Case-insensitive matching
  - Error handling for API failures

### Documentation Updates

- Updated README.md with links to all new documentation guides
- Updated version in package.json to 0.2.1
- Updated DEVELOPMENT_PLAN_V2.1.md with production ready status
- Added "Dismiss Findings" to advanced features list

### Performance

- **Existing Optimizations Documented** - All performance optimizations already implemented:
  - Parallel provider execution
  - Async file operations with `Promise.all()`
  - Incremental review caching (6x faster, 80% cheaper)
  - Provider fallbacks for resilience

### Branch

- All changes on `feature/v0.2.1-release-prep` branch
- 8 commits with detailed descriptions
- Ready for merge and release

## [0.2.0] - Previous Release

### Added
- Analytics dashboard with HTML/CSV/JSON reports
- Feedback learning based on 👍/👎 reactions
- Code graph analysis with AST-based dependency tracking
- Auto-fix prompts for AI IDEs (Cursor, Copilot)
- Provider reliability tracking
- Self-hosted deployment with Docker
- Plugin system for custom providers
- Incremental review (6x faster, 80% cheaper)

### Production Ready Features
- 306 tests passing (100% before this release)
- 85%+ test coverage
- Comprehensive benchmarks
- Full Phase 1-3 implementation complete

---

## Notes

### Release Numbering
- **0.2.1** - Documentation and UX improvements (this release)
- **0.2.0** - Analytics, learning, and enterprise features
- **0.1.x** - Initial release with core review functionality

### Upgrade Notes
- No breaking changes in 0.2.1
- All existing configurations remain compatible
- New features are opt-in or enhance existing functionality

### Contributors
All improvements in 0.2.1 co-authored by Claude Sonnet 4.5
