# Pitfalls Research: Path-Based Configuration in CI/Analysis Tools

**Domain:** Path-based behavior control in code analysis and CI systems
**Researched:** 2026-02-05
**Confidence:** HIGH

## Critical Pitfalls

### Pitfall 1: Overlapping Pattern Precedence Ambiguity

**What goes wrong:**
Multiple glob patterns match the same file, but the intended behavior is unclear because precedence rules aren't documented or tested. Example: `**/*.test.ts` (light review) and `src/auth/**` (thorough review) both match `src/auth/login.test.ts`. Which intensity wins?

**Why it happens:**
- Developers add patterns incrementally without considering interactions
- Pattern order seems arbitrary, users assume "last match wins" or "first match wins"
- Configuration systems often lack explicit precedence documentation
- Test coverage focuses on individual patterns, not overlapping scenarios

**How to avoid:**
- Document explicit precedence rules (e.g., "highest intensity wins" or "last matching pattern wins")
- Add validation that warns on overlapping patterns at config load time
- Test specifically for overlap scenarios in test suite
- Log which pattern matched and why in runtime (for debugging)

**Warning signs:**
- Config file has patterns where one is a subset of another (`**/*.ts` and `src/**/*.ts`)
- Users report unexpected behavior: "Why is this test file getting thorough review?"
- No tests exist for files matching multiple patterns
- Configuration grows organically without refactoring

**Phase to address:**
Phase 1 (Config Validation) - Detect overlaps at startup and log warnings. Document precedence in user-facing docs.

---

### Pitfall 2: Exclusion Pattern Ineffectiveness (Re-inclusion Anti-Pattern)

**What goes wrong:**
Users try to re-include a file after excluding its parent directory. Example: Exclude `node_modules/**` but then try to include `node_modules/my-package/**` for review. The inclusion pattern is silently ignored because the parent was already excluded.

**Why it happens:**
- Gitignore-style pattern matching uses directory-level pruning for performance
- Once a directory is excluded, filesystem traversal skips it entirely
- Include patterns never see files inside excluded directories
- This optimization is undocumented in most tools

**How to avoid:**
- Validate at config load: detect when inclusion pattern is under excluded directory
- Throw error or warning: "Cannot re-include files under excluded directory X"
- Document limitation clearly: "Exclusions apply at directory level, not file level"
- Suggest alternatives: use more specific exclusions or invert logic

**Warning signs:**
- Config has both exclusion and inclusion patterns for nested paths
- Users report: "My inclusion pattern isn't working"
- Pattern like `!important.txt` appears after `**/*.txt` in ignore file
- No validation logic exists for inclusion/exclusion conflicts

**Phase to address:**
Phase 1 (Config Validation) - Add validation rule that detects re-inclusion anti-pattern. Provide actionable error message with suggested fix.

---

### Pitfall 3: Performance Degradation from Complex Patterns

**What goes wrong:**
Glob patterns with nested quantifiers, brace expansion, or excessive wildcards cause exponential matching time. Example: `src/{a,b,c}/**/{x,y,z}/**/*.{ts,tsx,js,jsx}` takes seconds per file instead of milliseconds. On a 10,000-file PR, review times out.

**Why it happens:**
- Regex engines can exhibit catastrophic backtracking with certain patterns
- Developers optimize for expressiveness, not performance
- No budget enforcement on pattern complexity
- Performance testing focuses on small repos (10-100 files), not large PRs (1000+ files)

**How to avoid:**
- Implement complexity scoring: wildcards × 2 + braces × 3, reject if score > threshold (e.g., 50)
- Pre-compile patterns at config load and measure compilation time
- Cache pattern match results per `(file, pattern)` pair to avoid redundant matching
- Use simpler library (like `minimatch`) instead of full regex for basic globs
- Document performance characteristics: "Each brace expansion multiplies complexity"

**Warning signs:**
- Pattern contains `{...}` nested inside `**` (multiplicative complexity)
- Review takes >1 second per file on average
- Users report timeouts on large PRs
- No complexity limits in validation logic
- Pattern length exceeds 200 characters

**Phase to address:**
Phase 1 (Config Validation) - Implement complexity scoring and reject patterns above threshold. Already exists in PathMatcher (MAX_COMPLEXITY_SCORE = 50).

---

### Pitfall 4: Path Separator Platform Inconsistency

**What goes wrong:**
Patterns work on Linux/macOS (forward slash `/`) but fail on Windows (backslash `\`). Example: `src\auth\*.ts` matches nothing on Linux; `src/auth/*.ts` fails on Windows if not normalized.

**Why it happens:**
- Developers test on single platform (usually macOS/Linux)
- Windows path handling is an afterthought
- Glob libraries differ in cross-platform support
- Backslash has dual meaning: path separator OR escape character

**How to avoid:**
- Normalize all paths to forward slashes before matching (even on Windows)
- Block backslashes in patterns entirely - throw validation error
- Document: "Always use `/` for path separators, even on Windows"
- Test on Windows in CI pipeline (GitHub Actions supports `runs-on: windows-latest`)

**Warning signs:**
- Pattern validation allows backslashes
- No Windows testing in CI
- Users report: "Pattern works locally but fails in GitHub Actions"
- Path normalization missing in file path processing

**Phase to address:**
Phase 1 (Config Validation) - Reject patterns containing backslashes. Already implemented in PathMatcher.checkAllowedCharacters().

---

### Pitfall 5: Silent Fallback Hides Configuration Errors

**What goes wrong:**
Invalid pattern is silently ignored and system falls back to default behavior. Users think their critical paths are getting thorough review when they're actually getting standard review. Security risk goes undetected.

**Why it happens:**
- "Fail open" design: system prioritizes availability over correctness
- Errors logged but not surfaced to users (logs buried in CI output)
- No validation at config load time - errors only appear at runtime
- Developers assume "it works" because CI is green

**How to avoid:**
- Fail fast at config load time: invalid pattern = fatal error, workflow stops
- If runtime fallback is necessary, log ERROR level and set workflow status to failure
- Add config validation step that runs before review starts
- Provide validation CLI command: `action validate-config` for local testing

**Warning signs:**
- Error handling uses `try/catch` that returns default on exception
- Validation errors use `logger.warn()` instead of throwing
- No unit tests for malformed patterns
- Users discover issues only after production incidents

**Phase to address:**
Phase 1 (Config Validation) - PathMatcher already validates at construction time and throws errors. Ensure orchestrator doesn't catch and suppress these errors.

---

### Pitfall 6: Path Traversal in Pattern Injection

**What goes wrong:**
User-provided patterns contain `..` segments, allowing matching outside intended scope. Example: Pattern `../../secrets/**` could match files outside the repository.

**Why it happens:**
- Patterns come from user-provided config files
- No sanitization on pattern input
- Developers assume patterns are trusted input
- Security reviews focus on code, not config validation

**How to avoid:**
- Reject patterns containing `..` segments (path traversal)
- Validate that patterns cannot escape repository root
- Use allowlist for permitted characters, block dangerous chars (`..`, `\`, backticks, etc.)
- Document: "Patterns must be relative to repository root"

**Warning signs:**
- No validation for `..` in patterns
- Patterns accepted from untrusted sources (PR comments, external APIs)
- Pattern matching uses `path.resolve()` without boundary checks
- Security testing missing for config injection attacks

**Phase to address:**
Phase 1 (Config Validation) - Already implemented in PathMatcher.checkTraversal(). Ensure enabled in production config.

---

### Pitfall 7: Test File Pattern Over-Exclusion

**What goes wrong:**
Pattern intended to reduce test file review inadvertently excludes critical test infrastructure. Example: `**/*.test.ts` set to "light" review, but `setupTests.ts` is mislabeled as test and gets insufficient review, causing production test failures.

**Why it happens:**
- Overly broad patterns: `**/*test*` matches more than intended
- Filename conventions vary: `TestUtils.ts`, `test-helper.ts`, `__tests__/index.ts`
- Configuration prioritizes reducing noise over correctness
- No validation that excluded files are actually tests

**How to avoid:**
- Use specific, conservative patterns: `**/*.test.{ts,js}` not `**/*test*`
- Document which files match (dry-run mode or verbose logging)
- Provide pattern testing tool: "Show me which files match this pattern"
- Review matched file lists during config changes

**Warning signs:**
- Pattern uses wildcards on both sides of identifier: `*test*`
- Users report: "Why isn't this file being reviewed?"
- No tests verify that non-test files aren't matched by test patterns
- Pattern list grows organically without periodic review

**Phase to address:**
Phase 2 (Testing and Documentation) - Add validation that shows which files match which patterns. Provide CLI tool for dry-run testing.

---

## Technical Debt Patterns

Shortcuts that seem reasonable but create long-term problems.

| Shortcut | Immediate Benefit | Long-term Cost | When Acceptable |
|----------|-------------------|----------------|-----------------|
| String matching instead of glob library | Faster initial implementation (30 min) | Can't handle `**`, `{a,b}`, character classes; users expect full glob support | Only for exact string matches, never for wildcards |
| Warn on error instead of fail | CI stays green, doesn't block PRs | Silent failures accumulate; critical paths unprotected | Never acceptable for security-critical paths |
| No pattern complexity limits | Users can express any pattern | ReDoS attacks, timeout issues on large PRs | Only if patterns are hardcoded (not user-provided) |
| Case-insensitive matching by default | Works on Windows and macOS | `Test.ts` and `test.ts` are different files; hides real bugs | Never (case-sensitive is correct default) |
| Caching without invalidation | 10x performance improvement | Stale results after config changes | Acceptable if cache key includes config hash |
| First-match-wins precedence | Simple to implement | Counterintuitive; users expect highest-priority wins | Only if explicitly documented |

---

## Integration Gotchas

Common mistakes when connecting to external services.

| Integration | Common Mistake | Correct Approach |
|-------------|----------------|------------------|
| GitHub Actions paths filter | Using `paths` and `paths-ignore` together on same event - only last one is respected | Use `paths` with `!` prefix for exclusions instead |
| GitHub Actions tag pushes | Expecting path filters to work with tag pushes - they're silently ignored | Use separate workflow for tag pushes OR use `dorny/paths-filter` action |
| SonarQube exclusions | Using both inclusion and exclusion patterns - exclusion always wins even if inclusion is more specific | Use only inclusion OR exclusion for a given category, never both |
| ESLint + Prettier | Configuring path overrides in wrong order - last config doesn't override earlier ones | Put `prettier` config last in `extends` array |
| Minimatch library | Forgetting to set `nonegate: true` and `nocomment: true` - enables pattern injection via `!` and `#` | Always use security options for user-provided patterns |
| Tree-sitter parsing | Attempting to parse incomplete code fragments - parser returns null | Validate parse tree exists before using it |

---

## Performance Traps

Patterns that work at small scale but fail as usage grows.

| Trap | Symptoms | Prevention | When It Breaks |
|------|----------|------------|----------------|
| Linear pattern scan (O(files × patterns)) | Review time increases quadratically with config size | Pre-compile patterns; index by path prefix | >100 patterns or >1000 files |
| No result caching | Same file matched against same pattern multiple times | Cache `(file, pattern) -> boolean` in Map | Large PRs (1000+ files) |
| Synchronous file I/O in match loop | Blocking event loop; CI timeout | Use async/await; batch file reads | >500 files in single batch |
| Regex compilation per match | Pattern compiled 1000s of times | Compile patterns once at config load | >100 files matched |
| Deep recursion in glob expansion | Stack overflow on complex patterns | Use iterative algorithm or library (minimatch) | Pattern depth >10 (e.g., `**/**/**`) |
| Full repo traversal for exclusions | Scans all files even if excluded | Prune excluded directories during traversal | Repos >10k files |

---

## Security Mistakes

Domain-specific security issues beyond general web security.

| Mistake | Risk | Prevention |
|---------|------|------------|
| Command injection via pattern | User pattern `$(rm -rf /)` executed in shell | Never pass patterns to shell; use pure JS glob library |
| ReDoS via catastrophic backtracking | Pattern `(a+)+b` causes exponential time; DoS attack | Limit pattern complexity; use non-backtracking matcher |
| Path traversal via `..` | Pattern `../../etc/passwd` reads outside repo | Reject patterns containing `..` segments |
| Control character injection | Pattern with `\x00` or `\n` breaks parsing | Validate ASCII printable chars only (0x20-0x7E) |
| Unicode homoglyph attack | Pattern uses lookalike chars to bypass validation | Restrict to ASCII; reject Unicode in patterns |
| Pattern injection via negation | User injects `!important/**` to bypass exclusion | Disable negation with `nonegate: true` in minimatch |

---

## UX Pitfalls

Common user experience mistakes in this domain.

| Pitfall | User Impact | Better Approach |
|---------|-------------|-----------------|
| No feedback on which pattern matched | "Why is this file getting thorough review?" | Log matched pattern and reason in review comment |
| Cryptic error messages | "Pattern validation failed" (which pattern? why?) | Include pattern, specific error, and suggested fix |
| No dry-run mode | Can't test patterns without running full review | Provide CLI: `action test-patterns --dry-run` |
| Patterns scattered across files | Must check `.github/workflows/*.yml`, `action.yml`, and config files | Centralize in single config file with schema validation |
| No pattern documentation | Users copy-paste patterns without understanding | Include inline comments in default config explaining each pattern |
| Silent performance degradation | Review gets slower but no warning | Add timeout budget per file; warn when approaching limit |

---

## "Looks Done But Isn't" Checklist

Things that appear complete but are missing critical pieces.

- [ ] **Pattern validation:** Often missing complexity limits - verify MAX_COMPLEXITY_SCORE constant exists and is enforced
- [ ] **Error handling:** Often missing "fail fast" on invalid config - verify constructor throws (doesn't return default)
- [ ] **Platform testing:** Often missing Windows CI runs - verify cross-platform tests exist
- [ ] **Overlap detection:** Often missing conflict warnings - verify test suite includes multi-pattern scenarios
- [ ] **Performance testing:** Often missing large-scale benchmarks - verify tests include 1000+ file scenarios
- [ ] **Security validation:** Often missing injection attack tests - verify test suite includes malicious patterns
- [ ] **Documentation:** Often missing precedence rules - verify user docs explain overlap behavior
- [ ] **Caching:** Often missing cache invalidation - verify cache key includes config version
- [ ] **Logging:** Often missing pattern match debugging - verify logs show which pattern matched which file
- [ ] **Fallback behavior:** Often missing explicit default - verify what happens when no patterns match

---

## Recovery Strategies

When pitfalls occur despite prevention, how to recover.

| Pitfall | Recovery Cost | Recovery Steps |
|---------|---------------|----------------|
| Overlapping patterns causing wrong intensity | LOW | Add precedence rules to docs; log warning on overlap; add tests for specific overlap cases |
| Complex pattern causing timeout | LOW | Add complexity validation; reject pattern at config load; suggest simpler alternative |
| Path separator breaking Windows | MEDIUM | Normalize all paths to `/`; add Windows CI; reject `\` in patterns; update user docs |
| Silent fallback hiding errors | HIGH | Change warn to throw; add config validation step before review; surface errors in PR comments |
| Security pattern injection | CRITICAL | Add character allowlist; reject dangerous chars; add security tests; security audit of all patterns |
| Performance degradation at scale | MEDIUM | Add caching layer; implement pattern indexing; batch file processing; set timeouts |

---

## Pitfall-to-Phase Mapping

How roadmap phases should address these pitfalls.

| Pitfall | Prevention Phase | Verification |
|---------|------------------|--------------|
| Overlapping pattern precedence | Phase 1: Config Validation | Test with overlapping patterns; check logs show precedence |
| Re-inclusion anti-pattern | Phase 1: Config Validation | Test exclusion + inclusion conflict; verify error thrown |
| Complex pattern performance | Phase 1: Config Validation | Test with high-complexity patterns; verify rejection |
| Path separator inconsistency | Phase 1: Config Validation | Test with backslashes; verify error thrown |
| Silent fallback errors | Phase 1: Config Validation | Test with invalid pattern; verify fatal error (not warning) |
| Path traversal injection | Phase 1: Config Validation | Test with `..` patterns; verify rejection |
| Test pattern over-exclusion | Phase 2: Integration Testing | Test edge cases; verify non-test files not matched |
| No dry-run mode | Phase 3: Documentation/Tooling | Add CLI validation command; verify shows matched files |

---

## Sources

### High Confidence (Official Documentation + Context7)
- [VS Code Glob Patterns Documentation](https://code.visualstudio.com/docs/editor/glob-patterns) - Path separator platform issues, glob syntax
- [SonarQube File Exclusion Documentation](https://docs.sonarsource.com/sonarqube-server/instance-administration/analysis-functions/analysis-scope/excluding-files-based-on-file-paths) - Inclusion/exclusion precedence rules
- [GitHub Actions Workflow Syntax](https://docs.github.com/en/actions/writing-workflows/workflow-syntax-for-github-actions) - Path filter limitations
- [GitHub Actions Path Filter Limitations Discussion](https://github.com/orgs/community/discussions/25285) - Tag push path filter bug
- [Git gitignore Documentation](https://git-scm.com/docs/gitignore) - Pattern precedence and re-inclusion impossibility

### Medium Confidence (Technical Articles + Implementation Examples)
- [DeepSource Glob Patterns Guide](https://deepsource.com/blog/glob-file-patterns) - Best practices and common mistakes
- [GitHub dorny/paths-filter Action](https://github.com/dorny/paths-filter) - Advanced path filtering patterns
- [ESLint-Prettier Integration Article (2026)](https://medium.com/@osmion/prettier-eslint-configuration-that-actually-works-without-the-headaches-a8506b710d21) - Config ordering issues
- [Spring Boot Path Matching Strategy (2026)](https://copyprogramming.com/howto/spring-boot-mvc-path-match-strategy) - Performance comparison (PathPatternParser vs AntPathMatcher)
- [AWS Avoiding Fallback in Distributed Systems](https://aws.amazon.com/builders-library/avoiding-fallback-in-distributed-systems/) - Why fallback strategies fail

### Project Context (High Confidence - Actual Codebase)
- PathMatcher implementation (`src/analysis/path-matcher.ts`) - Already implements: complexity scoring (MAX_COMPLEXITY_SCORE=50), pattern validation, character allowlist, path traversal prevention, caching
- Security validation includes: ReDoS prevention, control character rejection, minimatch with `nonegate: true` and `nocomment: true`

---

*Pitfalls research for: Multi-Provider Code Review (Path-Based Intensity Feature v1.0)*
*Researched: 2026-02-05*
