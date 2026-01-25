# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

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
