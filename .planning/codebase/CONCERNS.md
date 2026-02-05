# Codebase Concerns

**Analysis Date:** 2026-02-04

## Tech Debt

**Incomplete AST Analysis for Patch-Only Files:**
- Issue: Graph builder only analyzes code fragments from diffs, not full file context. This produces incomplete AST trees missing cross-file relationships, inheritance tracking, and impact radius analysis.
- Files: `src/analysis/context/graph-builder.ts` (lines 734-746, 759-775)
- Impact: Code reviews may miss inheritance-related issues, impact radius underestimated for widely-used files, false negatives on related code changes
- Fix approach: Implement GitHub API fetch for full file contents at specific commit SHA, cache results to minimize API calls, fall back to patch-only on rate limit errors

**Unimplemented Class Inheritance Tracking:**
- Issue: `findDerivedClasses()` returns empty array (stub). Class inheritance is not tracked in code graph.
- Files: `src/analysis/context/graph-builder.ts` (lines 384-400)
- Impact: Changes to base classes won't identify affected derived classes, inheritance-related bugs slip through
- Fix approach: Parse `extends` and `implements` clauses from class declarations in AST, build inheritance map, resolve parent class names to definitions

**Missing Impact Radius Analysis:**
- Issue: `findImpactRadius()` returns stub response with "low" impact. Full impact analysis not implemented.
- Files: `src/analysis/context/graph-builder.ts` (lines 418-445)
- Impact: Reviews underestimate blast radius of changes to core utilities/services, missed cascade effects
- Fix approach: Build reverse dependency graph (who imports this file), calculate transitive impact, identify all affected dependent files

**Dashboard Placeholder Data:**
- Issue: Findings distribution chart shows placeholder data, not aggregated from metrics collector
- Files: `src/analytics/dashboard-generator.ts` (line 261)
- Impact: Dashboard metrics incomplete and misleading for review health tracking
- Fix approach: Connect MetricsCollector findings aggregation to chart generation, implement real data visualization

**Trivial Detector Placeholder Return:**
- Issue: `MetricsCollector.getReviewMetricsChart()` returns empty array as placeholder
- Files: `src/analytics/metrics-collector.ts` (line 215)
- Impact: Metrics export incomplete, analytics disabled
- Fix approach: Implement real metrics aggregation from collection data

## Known Bugs

**Incomplete Semantic Diff Analysis:**
- Symptoms: Formatting-only changes sometimes misclassified as meaningful changes
- Files: `src/analysis/finding-filter.ts` (deduplication logic), `src/analysis/trivial-detector.ts` (formatting detection)
- Trigger: Complex whitespace changes, bracket reformatting, comment repositioning
- Workaround: Manual filtering of trivial findings, review configuration adjustments
- Root cause: Regex-based detection of formatting patterns lacks full AST semantic comparison

**AST Parser Fragility with Patch Content:**
- Symptoms: "code appears to be a fragment (unbalanced braces)" warnings during analysis
- Files: `src/analysis/context/graph-builder.ts` (line 759-762)
- Trigger: Code changes spanning multiple file sections, partial method implementations in diffs
- Workaround: Full file content fetch (when implemented) will solve this
- Root cause: Parser struggles with syntactically incomplete code fragments

## Security Considerations

**Plugin System Has No Sandbox:**
- Risk: Arbitrary Node.js code execution with no isolation, full filesystem/network access, ability to modify process state
- Files: `src/plugins/plugin-loader.ts` (entire file, especially lines 5-30)
- Current mitigation: Hard requirement for `PLUGIN_SECURITY_ACKNOWLEDGED=true` env var, explicit documentation, warning in logs
- Recommendations:
  - Load plugins ONLY in private, self-hosted CI/CD environments
  - NEVER enable in public GitHub Actions workflows
  - Implement allowlist/blocklist for plugin loading
  - Review all plugin code before deployment
  - Document that plugins run with same permissions as parent process
  - Consider plugin capability restrictions if feasible (e.g., restricted require list)

**Environment Variable Exposure:**
- Risk: API keys and secrets in `process.env` accessible to plugins, error logs, and plugin code
- Files: `src/providers/registry.ts` (lines 20, 30, 40, 224, 261), throughout provider instantiation
- Current mitigation: Env vars validated at startup, secrets not logged explicitly
- Recommendations:
  - Audit all error messages for accidental secret inclusion
  - Sanitize environment variable access in logs
  - Use secret masking in CI/CD systems
  - Consider provider-specific secret management instead of global env vars

**Dynamic Code Execution Risk:**
- Risk: Plugin loading uses dynamic `import()` which can execute arbitrary code if plugin paths are influenced by user input
- Files: `src/plugins/plugin-loader.ts` (plugin directory traversal)
- Current mitigation: Plugin directory is configuration-based, not user-influenced in action flow
- Recommendations:
  - Validate plugin paths are within expected directory
  - Use allowlist for which plugins can be loaded
  - Never let PR content influence plugin loading

**Provider Configuration Injection:**
- Risk: `REVIEW_PROVIDERS` env var can be hijacked to load untrusted providers
- Files: `src/providers/registry.ts` (line 30)
- Current mitigation: Used only when explicit env var set, falls back to defaults/discovery
- Recommendations:
  - Restrict REVIEW_PROVIDERS to specific known provider names
  - Validate provider names against allowlist before instantiation
  - Log provider selection decisions

## Performance Bottlenecks

**Large File Orchestrator:**
- Problem: `ReviewOrchestrator` is 1025 lines with many responsibilities
- Files: `src/core/orchestrator.ts`
- Cause: Consolidation of review workflow logic, component management, and error handling
- Improvement path: Break into focused orchestrators (AnalysisOrchestrator, OutputOrchestrator, CacheOrchestrator)

**Graph Builder Size:**
- Problem: `CodeGraphBuilder` is 997 lines, complex AST parsing and graph construction
- Files: `src/analysis/context/graph-builder.ts`
- Cause: Multiple extraction methods (definitions, imports, calls, validation) in single class
- Improvement path: Extract parsing logic into separate concern (DefinitionExtractor, ImportExtractor), use composition

**Finding Filter Complexity:**
- Problem: `FindingFilter` is 956 lines with numerous rule branches
- Files: `src/analysis/finding-filter.ts`
- Cause: Many detection heuristics and downgrade rules consolidated in single filter
- Improvement path: Use strategy pattern for filter rules, separate lint detection from security detection

**Provider Registry High Complexity:**
- Problem: `ProviderRegistry` is 542 lines handling provider discovery, instantiation, selection, rate limiting
- Files: `src/providers/registry.ts`
- Cause: Multiple provider sources (OpenRouter, OpenCode, local, plugins), discovery logic, filtering
- Improvement path: Extract discovery into separate service (ModelDiscoveryService), separate selection strategy

## Fragile Areas

**AST Fragment Analysis Relies on Heuristics:**
- Files: `src/analysis/context/graph-builder.ts` (lines 759-762, 790+ for `looksLikeFragment()`)
- Why fragile: Detection of unbalanced braces is regex-based and context-unaware. May incorrectly skip valid changes or attempt to parse invalid fragments
- Safe modification:
  - Always test changes with complex code patterns (nested generics, multiline lambdas, object literals)
  - Consider full file fetch implementation as replacement
  - Add comprehensive tests for edge cases
- Test coverage: Fragile heuristics have minimal test coverage, recommend adding integration tests

**Error Handling in Provider Discovery:**
- Files: `src/providers/registry.ts` (lines 34-70, discovery fallback logic)
- Why fragile: Discovery can fail partially (OpenRouter succeeds, OpenCode fails), leading to incomplete provider lists. Fallback to static providers may mask actual issues
- Safe modification:
  - Log detailed discovery results before fallback
  - Track discovery failures per source for debugging
  - Don't silently hide discovery errors in logs
- Test coverage: Happy path tested, error recovery path needs more scenarios

**Finding Filter Rule Ordering:**
- Files: `src/analysis/finding-filter.ts` (lines 84-160, filter decision logic)
- Why fragile: Rule evaluation order matters (test file check, security check, style check). Changing order could produce different filter results
- Safe modification:
  - Document rule precedence and why it matters
  - Add tests that validate specific rule ordering
  - Consider explicit priority enum instead of if-else chains
- Test coverage: Individual rules tested, interaction between rules underspecified

**Cache State Consistency:**
- Files: `src/cache/manager.ts`, `src/providers/circuit-breaker.ts` (state persistence)
- Why fragile: Multiple components write to cache (circuit breaker state, graph cache, incremental review data). Concurrent access could corrupt state
- Safe modification:
  - Use locks for all cache writes
  - Validate cache format before deserializing
  - Implement rollback on corruption
- Test coverage: Basic cache operations tested, concurrent access scenarios missing

**Plugin Loading with Security Acknowledgment:**
- Files: `src/plugins/plugin-loader.ts` (lines 76-101)
- Why fragile: Security acknowledgment is environment variable string comparison. Easy to bypass if not fully understood
- Safe modification:
  - Require explicit BOTH acknowledgment env vars (e.g., PLUGIN_SECURITY_UNDERSTOOD + PLUGIN_SECURITY_ACKNOWLEDGED)
  - Log plugin loading attempts with stack traces for audit trail
  - Consider runtime checks beyond env var
- Test coverage: Security blocking tested, but practical bypass scenarios not covered

## Scaling Limits

**Memory Growth with Large Codebases:**
- Current capacity: CodeGraph stores entire codebase in memory (definitions, imports, calls maps)
- Limit: ~10k files with millions of definitions will consume significant heap memory
- Scaling path: Implement lazy-loading for graph data, use database backend for large repos, add memory monitoring

**Concurrent Analysis Limited by Provider Rate Limits:**
- Current capacity: `config.providerMaxParallel` controls queue depth, typically 3-5 concurrent requests
- Limit: Large code review batches queue up, increasing latency. Rate limiter may block all providers simultaneously
- Scaling path: Implement adaptive concurrency based on provider reliability, use circuit breaker to skip failing providers faster

**Cache Directory Growth:**
- Current capacity: Cache stores graph serialization, incremental analysis state, metrics (no size limit configured)
- Limit: Long-running instances accumulate cache entries without pruning
- Scaling path: Implement cache TTL (time-to-live) for old entries, add cache size limit with LRU eviction

**LLM Context Window Limitations:**
- Current capacity: Prompt builder concatenates findings, context snippets - may exceed token limits for large changes
- Limit: PRs with 50+ files and 10k+ changed lines may hit context window ceiling
- Scaling path: Implement hierarchical summarization, split large reviews into chunks, prioritize critical findings

## Dependencies at Risk

**tree-sitter Native Bindings:**
- Risk: Node native modules (tree-sitter, tree-sitter-python, tree-sitter-typescript) require compilation per OS/Node version. Installation failures are common.
- Impact: GitHub Actions may fail on new runner images, CI/CD becomes flaky
- Migration plan:
  - Keep prebuilt binaries in repo (not recommended) or
  - Use container-based CI to ensure consistent build environment or
  - Switch to JavaScript-based parser (acorn for JS, espree) for better compatibility

**Optional Dependencies:**
- Risk: `tree-sitter-go` and `tree-sitter-rust` are optional but imported without fallback
- Impact: Go/Rust analysis silently fails if binaries not installed
- Migration plan: Make optional dependency loading explicit with graceful degradation, document installation requirements

**js-yaml Security:**
- Risk: YAML parsing can execute arbitrary code if not configured carefully
- Impact: Malicious YAML in config files could execute code
- Recommendation: Use safe YAML parsing mode, validate config schema with Zod before parsing

**p-queue and p-retry Versions:**
- Risk: External queue/retry logic may have bugs. Changes to these libs could affect provider coordination
- Impact: Provider execution reliability depends on external lib behavior
- Recommendation: Pin versions, add integration tests that verify queue behavior under stress

## Missing Critical Features

**Full File Content Analysis:**
- Problem: Only patch content analyzed, missing cross-file dependencies and inheritance relationships
- Blocks: Can't detect impact radius, inheritance-related bugs, circular dependencies
- Priority: HIGH - core to code review quality

**Dependency Graph Visualization:**
- Problem: Impact analysis exists but no way to visualize dependency relationships for review context
- Blocks: Developers can't understand change impact intuitively
- Priority: MEDIUM - helpful for understanding complex changes

**Provider Performance Profiling:**
- Problem: No detailed latency/cost metrics per provider per model
- Blocks: Can't optimize provider selection for cost/performance tradeoffs
- Priority: MEDIUM - helps with cost optimization

**Autofix Suggestion Refinement:**
- Problem: Autofix prompts generated but minimal validation that suggestions are correct
- Blocks: Unsafe autofix suggestions could be posted
- Priority: HIGH - must validate before posting

**Webhook Signature Verification:**
- Problem: Webhook handler accepts incoming events without GitHub signature validation
- Blocks: Untrusted sources could trigger reviews
- Priority: CRITICAL - security issue

## Test Coverage Gaps

**Plugin Security Boundary Testing:**
- What's not tested: Plugin directory traversal, malicious plugin names, security acknowledgment bypass
- Files: `src/plugins/plugin-loader.ts`
- Risk: Security mitigations not validated, potential for bypass
- Priority: HIGH

**Concurrent Cache Access:**
- What's not tested: Multiple components writing to cache simultaneously, race conditions in cache state
- Files: `src/cache/manager.ts`, `src/providers/circuit-breaker.ts`
- Risk: Cache corruption under concurrency, inconsistent state
- Priority: HIGH

**Provider Discovery Failure Modes:**
- What's not tested: Partial discovery failures (one source succeeds, another fails), discovery timeout handling
- Files: `src/providers/registry.ts` (discovery logic)
- Risk: Silent degradation to fallback providers, masks actual discovery issues
- Priority: MEDIUM

**Large File AST Parsing:**
- What's not tested: Patch-only parsing of large code changes, unbalanced brace detection edge cases
- Files: `src/analysis/context/graph-builder.ts`
- Risk: AST parsing failures on edge cases, incomplete analysis
- Priority: MEDIUM

**Finding Deduplication:**
- What's not tested: Complex deduplication scenarios (similar findings across multiple files, severity changes)
- Files: `src/analysis/finding-filter.ts` (deduplication logic)
- Risk: Duplicate findings not removed, or valid distinct findings removed
- Priority: MEDIUM

**Error Injection in LLM Executor:**
- What's not tested: Provider timeout handling, partial batch failures, health check timeout behavior
- Files: `src/analysis/llm/executor.ts`
- Risk: Error handling not validated, silent failures or incorrect error propagation
- Priority: MEDIUM

---

*Concerns audit: 2026-02-04*
