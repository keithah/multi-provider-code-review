# Feature Research: Path-Based Intensity Control

**Domain:** Path-based resource allocation for code analysis tools
**Researched:** 2026-02-05
**Confidence:** MEDIUM-HIGH

## Feature Landscape

### Table Stakes (Users Expect These)

Features users assume exist. Missing these = product feels incomplete.

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| Glob pattern matching | Standard since ESLint (2013), universal expectation | LOW | Use minimatch/micromatch for consistency with ecosystem |
| Path-based rule exclusions | Core feature in all modern linters (ESLint, golangci-lint) | LOW | Exclude specific checks from specific paths |
| Test file special handling | Universal pattern: `**/*.test.*` gets different rules | LOW | Test files need relaxed rules (no unused vars, more mocks) |
| Directory-based configuration | Users expect `src/core/**` vs `docs/**` to behave differently | MEDIUM | Hierarchical pattern matching with precedence rules |
| Override precedence (last wins) | ESLint standard: later overrides trump earlier ones | LOW | Most specific pattern should win when conflicts occur |
| Multiple patterns per override | Configure behavior for `['*.test.ts', '*.spec.ts']` at once | LOW | Array support for pattern lists |
| Inverse path matching | "Run X on everything EXCEPT tests" pattern | MEDIUM | `path-except` or negation patterns like `!**/*.test.ts` |
| Default fallback intensity | When no pattern matches, use default behavior | LOW | Critical for graceful handling of unmatched files |

### Differentiators (Competitive Advantage)

Features that set the product apart. Not required, but valuable.

| Feature | Value Proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| Provider count per intensity level | Allocate 8 providers for critical paths, 3 for docs | MEDIUM | Direct resource allocation based on importance |
| Timeout scaling by path | Critical code gets 3min timeout, docs get 30sec | LOW | Time budget matches code criticality |
| Prompt depth configuration | Thorough=detailed prompts, light=quick checks | MEDIUM | Already have prompt templates, add depth variants |
| Multi-dimensional intensity | Combine provider count + timeout + prompt depth | HIGH | Holistic resource allocation strategy |
| Learning-informed defaults | Use feedback data to auto-tune intensity mappings | HIGH | Leverage existing provider weight learning |
| Cost-aware intensity | Balance provider count with budget constraints | MEDIUM | Use existing cost tracking to optimize allocation |
| Dynamic intensity adjustment | Start light, escalate to thorough if issues found | HIGH | Adaptive review depth based on findings |
| Consensus threshold by intensity | Thorough=3/5 agreement, light=2/3 agreement | MEDIUM | Lower bar for non-critical code |
| Path-based severity filtering | Critical paths surface minor issues, docs only critical | LOW | Adjust INLINE_MIN_SEVERITY by path |
| Batch size by intensity | Thorough=1 file/batch, light=10 files/batch | LOW | Token-aware batching already exists |
| Incremental cache TTL by path | Core code cache 1 day, docs cache 7 days | LOW | Existing incremental review with TTL variants |
| AST depth by intensity | Thorough=full graph, light=syntax-only | MEDIUM | Integrate with existing graphMaxDepth config |

### Anti-Features (Commonly Requested, Often Problematic)

Features that seem good but create problems.

| Feature | Why Requested | Why Problematic | Alternative |
|---------|---------------|-----------------|-------------|
| Per-file intensity configuration | "Control every file precisely" | Maintenance nightmare, 1000+ line config files, brittle | Use directory/glob patterns, not individual files |
| Automatic intensity detection | "AI determines criticality" | Requires training data, false confidence, unpredictable behavior | Explicit configuration with sensible defaults |
| Real-time intensity adjustment | "Change intensity during review" | Race conditions, inconsistent results, hard to debug | Pre-determined intensity based on static patterns |
| Unlimited provider escalation | "Keep adding providers until consensus" | Cost explosion, diminishing returns after 5-6 providers | Hard caps per intensity level (max 8 providers) |
| Path-based provider selection | "Use Claude for tests, Gemini for docs" | Breaks consensus, inconsistent quality, complex config | Same providers for all paths, vary count only |
| Zero-resource "skip" mode | "Don't review docs at all" | Hidden issues, security blind spots, config as tech debt | Always review, use minimal intensity instead |
| Regex-based patterns | "More powerful than globs" | Security risks (ReDoS), harder to reason about, slower | Glob patterns only, with complexity scoring |
| Intensity inheritance | "Child paths inherit parent intensity" | Confusing precedence, hard to debug, implicit behavior | Explicit patterns only, last-match-wins |
| Negative intensity | "Less than light mode" | Quality floor violation, false economy, support burden | Three levels (thorough/standard/light) is sufficient |
| Path-based prompt templates | "Different prompts per directory" | Prompt drift, inconsistent findings, review quality variance | Single prompt set with depth variants only |

## Feature Dependencies

```
[Glob pattern matching]
    └──required for──> [All path-based features]
                           └──requires──> [Pattern validation]
                                              └──prevents──> [ReDoS attacks]

[Intensity detection]
    └──required for──> [Provider count mapping]
    └──required for──> [Timeout mapping]
    └──required for──> [Prompt depth mapping]

[Provider count per intensity]
    └──conflicts with──> [Budget constraints]
    └──requires──> [Provider discovery limit]

[Path-based rule exclusions]
    └──enhances──> [Test file handling]
    └──enhances──> [Documentation special cases]

[Override precedence]
    └──required for──> [Multiple pattern handling]
    └──prevents──> [Configuration conflicts]

[Learning-informed defaults]
    └──requires──> [Provider weight tracker] (existing)
    └──enhances──> [Cost-aware intensity]

[Dynamic intensity adjustment]
    └──conflicts with──> [Incremental caching]
    └──conflicts with──> [Predictable behavior]

[Multi-dimensional intensity]
    └──requires──> [Provider count mapping]
    └──requires──> [Timeout mapping]
    └──requires──> [Prompt depth mapping]
```

### Dependency Notes

- **Glob patterns are foundation:** Everything else builds on path matching
- **Pattern validation is security-critical:** Prevent ReDoS and memory exhaustion
- **Intensity detection already exists:** Just needs wiring to behavior controls
- **Provider count vs budget tension:** Need smart allocation within constraints
- **Dynamic adjustment breaks caching:** Can't cache results if behavior changes mid-review
- **Multi-dimensional requires all three:** Provider count + timeout + prompt depth must work together

## MVP Definition

### Launch With (v1.0)

Minimum viable product — what's needed to validate the concept.

- [ ] Provider count mapping per intensity (thorough=8, standard=5, light=3) — Core resource allocation
- [ ] Timeout mapping per intensity (thorough=180s, standard=90s, light=30s) — Time budget control
- [ ] Prompt depth mapping per intensity (thorough=detailed, standard=balanced, light=quick) — Quality vs speed tradeoff
- [ ] Validate intensity affects review execution (not just logging) — Prove behavior changes
- [ ] Integration test with path patterns (src/core/** → thorough, docs/** → light) — Real-world validation
- [ ] Preserve existing intensity detection logic (minimatch patterns from config) — Don't break current feature

### Add After Validation (v1.x)

Features to add once core is working.

- [ ] Consensus threshold by intensity — Lower agreement bar for non-critical code
- [ ] Path-based severity filtering — Adjust min severity by path importance
- [ ] Batch size by intensity — More files per batch for light reviews
- [ ] Incremental cache TTL by path — Longer cache for stable/documented code
- [ ] AST depth by intensity — Full graph for thorough, syntax-only for light
- [ ] Learning-informed intensity tuning — Use feedback to optimize mappings
- [ ] Cost-aware provider allocation — Balance intensity with budget constraints
- [ ] Configuration validation warnings — Alert on ineffective patterns

### Future Consideration (v2+)

Features to defer until product-market fit is established.

- [ ] Dynamic intensity adjustment — Escalate on finding high-severity issues
- [ ] Multi-provider intensity optimization — Machine learning for optimal allocation
- [ ] Path-based analytics — Track cost/quality by directory
- [ ] Intensity override via PR labels — Manual escalation for high-risk changes

## Feature Prioritization Matrix

| Feature | User Value | Implementation Cost | Priority |
|---------|------------|---------------------|----------|
| Provider count mapping | HIGH | LOW | P1 |
| Timeout mapping | HIGH | LOW | P1 |
| Prompt depth mapping | HIGH | MEDIUM | P1 |
| Validate behavior changes | HIGH | MEDIUM | P1 |
| Integration tests | HIGH | LOW | P1 |
| Consensus threshold by intensity | MEDIUM | LOW | P2 |
| Path-based severity filtering | MEDIUM | LOW | P2 |
| Batch size by intensity | LOW | LOW | P2 |
| Cache TTL by path | LOW | LOW | P2 |
| AST depth by intensity | MEDIUM | MEDIUM | P2 |
| Learning-informed tuning | HIGH | HIGH | P3 |
| Cost-aware allocation | HIGH | MEDIUM | P3 |
| Dynamic adjustment | MEDIUM | HIGH | P3 |
| Path-based analytics | LOW | MEDIUM | P3 |

**Priority key:**
- P1: Must have for v1.0 launch (wire intensity to behavior)
- P2: Should have, add when possible (optimization and tuning)
- P3: Nice to have, future consideration (advanced intelligence)

## Real-World Patterns from Established Tools

### ESLint Override Patterns

ESLint pioneered path-based configuration with `overrides` blocks:

```javascript
// eslint.config.js
export default [
  {
    files: ["src/**/*.ts"],
    rules: {
      "complexity": ["error", 10],
      "max-lines": ["error", 300]
    }
  },
  {
    files: ["**/*.test.ts"],
    rules: {
      "complexity": "off",  // Tests can be complex
      "max-lines": "off"     // Tests can be long
    }
  }
]
```

**Key insight:** Different rule severity (off/warn/error) by path is standard. We should map this to intensity levels (thorough/standard/light).

**Source:** [ESLint Configuration Files](https://eslint.org/docs/latest/use/configure/configuration-files-deprecated)

### Golangci-lint Path Exclusions

Golangci-lint uses `issues.exclude-rules` for path-based linter selection:

```yaml
# .golangci.yml
issues:
  exclude-rules:
    - path: _test\.go
      linters:
        - gocyclo      # Tests can be cyclomatic
        - errcheck     # Tests often ignore errors
        - dupl         # Tests duplicate patterns
        - gosec        # Tests need unsafe operations

    - path-except: _test\.go
      linters:
        - forbidigo    # Only check tests for forbidden patterns
```

**Key insight:** Path-based linter exclusion reduces noise. We should map this to provider selection (fewer providers for tests).

**Source:** [Golangci-lint Configuration File](https://golangci-lint.run/docs/configuration/file/)

### GitHub Actions Path Filters

GitHub Actions uses `dorny/paths-filter` to conditionally execute jobs based on changed files:

```yaml
# .github/workflows/ci.yml
jobs:
  changes:
    runs-on: ubuntu-latest
    outputs:
      backend: ${{ steps.filter.outputs.backend }}
      frontend: ${{ steps.filter.outputs.frontend }}
      docs: ${{ steps.filter.outputs.docs }}
    steps:
      - uses: dorny/paths-filter@v3
        id: filter
        with:
          filters: |
            backend:
              - 'src/api/**'
              - 'src/core/**'
            frontend:
              - 'src/ui/**'
            docs:
              - 'docs/**'
              - '*.md'

  backend-ci:
    needs: changes
    if: ${{ needs.changes.outputs.backend == 'true' }}
    runs-on: ubuntu-latest-4-cores  # More resources
    timeout-minutes: 20              # Longer timeout
    steps:
      - run: npm run test:integration

  docs-ci:
    needs: changes
    if: ${{ needs.changes.outputs.docs == 'true' }}
    runs-on: ubuntu-latest          # Standard resources
    timeout-minutes: 5               # Quick timeout
    steps:
      - run: npm run lint:docs
```

**Key insight:** Different resource classes and timeouts by path is industry standard. We should map paths to provider counts and review timeouts.

**Source:** [GitHub dorny/paths-filter](https://github.com/dorny/paths-filter)

### CircleCI Path Filtering + Resource Classes

CircleCI combines path filtering with dynamic configuration to allocate different resources:

```yaml
# .circleci/config.yml
version: 2.1

setup: true
orbs:
  path-filtering: circleci/path-filtering@1.0.0

workflows:
  setup-workflow:
    jobs:
      - path-filtering/filter:
          mapping: |
            src/core/.* run-critical-tests true
            src/.* run-standard-tests true
            docs/.* run-docs-check true

# .circleci/continue-config.yml (triggered by path filter)
version: 2.1

workflows:
  critical-tests:
    when: << pipeline.parameters.run-critical-tests >>
    jobs:
      - test-critical:
          resource_class: xlarge     # 8 CPUs, 16GB RAM
          parallelism: 5

  standard-tests:
    when: << pipeline.parameters.run-standard-tests >>
    jobs:
      - test-standard:
          resource_class: medium     # 2 CPUs, 4GB RAM
          parallelism: 2

  docs-check:
    when: << pipeline.parameters.run-docs-check >>
    jobs:
      - lint-docs:
          resource_class: small      # 1 CPU, 2GB RAM
```

**Key insight:** Path-based resource allocation scales from small (docs) to xlarge (critical code). We should map this to 3-8 provider range.

**Source:** [CircleCI Path Filtering](https://circleci.com/developer/orbs/orb/circleci/path-filtering)

### TypeScript-ESLint Project Service

TypeScript-ESLint's project service optimizes performance for monorepos by scoping analysis depth:

```javascript
// eslint.config.js
export default [
  {
    files: ["src/core/**/*.ts"],
    languageOptions: {
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
      }
    },
    rules: {
      "@typescript-eslint/no-floating-promises": "error",  // Type-aware rule
      "@typescript-eslint/await-thenable": "error"
    }
  },
  {
    files: ["docs/**/*.ts"],
    languageOptions: {
      parserOptions: {
        projectService: false  // Skip type checking for docs
      }
    },
    rules: {
      "@typescript-eslint/no-floating-promises": "off"  // Disable expensive rules
    }
  }
]
```

**Key insight:** AST depth (type-aware vs syntax-only) varies by path. We should map `graphMaxDepth` by intensity.

**Source:** [TypeScript-ESLint Project Service](https://typescript-eslint.io/blog/project-service/)

### Monorepo CI Patterns

Monorepo CI systems use path-based triggers with different test strategies:

**Pattern: Selective test execution**
- `packages/core/**` → Full integration test suite (30min, 10 workers)
- `packages/utils/**` → Unit tests only (5min, 2 workers)
- `docs/**` → Linting only (1min, 1 worker)

**Pattern: Dependency-aware testing**
- Nx/Turborepo detect affected projects by file path
- Only run tests for changed code + dependents
- Critical paths trigger broader test suites

**Key insight:** Test depth and parallelism scale with code criticality. We should map provider count and timeout similarly.

**Source:** [Graphite - Testing Strategies for Monorepos](https://graphite.com/guides/testing-strategies-for-monorepos)

### Static Analysis Scan Depth

Security scanning tools differentiate deep vs shallow analysis by resource limits:

**Shallow scan (all endpoints):**
- Quick pattern matching (seconds)
- Basic rule violations
- Low resource usage

**Deep scan (critical paths):**
- Full call graph analysis (minutes)
- Cross-file taint tracking
- High resource usage

**Key insight:** Analysis depth varies by code importance, not just file type. Our intensity levels should mirror this.

**Source:** [Static and Dynamic Code Scanning in DevSecOps](https://blog.purestorage.com/purely-technical/harnessing-static-and-dynamic-code-scanning-in-devsecops/)

## Competitor Feature Analysis

| Feature | ESLint | Golangci-lint | GitHub Actions | CircleCI | Our Approach |
|---------|--------|---------------|----------------|----------|--------------|
| Path-based rule config | ✅ `overrides` | ✅ `exclude-rules` | ✅ `paths-filter` | ✅ `path-filtering` | ✅ Intensity levels |
| Glob pattern matching | ✅ minimatch | ✅ Regex | ✅ Glob | ✅ Regex | ✅ minimatch (existing) |
| Test file special handling | ✅ Common pattern | ✅ `_test.go` standard | ✅ Manual config | ✅ Manual config | ✅ Via intensity |
| Resource allocation by path | ❌ N/A (rules only) | ❌ N/A (linters only) | ✅ Different jobs | ✅ Resource classes | ✅ **DIFFERENTIATOR** |
| Timeout by path | ❌ No timeout config | ✅ Global timeout only | ✅ Per-job timeout | ✅ Per-job timeout | ✅ Per-intensity timeout |
| Provider count scaling | ❌ N/A | ❌ N/A | ⚠️ Manual parallelism | ⚠️ Manual parallelism | ✅ **DIFFERENTIATOR** |
| Prompt depth by path | ❌ N/A | ❌ N/A | ❌ N/A | ❌ N/A | ✅ **DIFFERENTIATOR** |
| Consensus threshold by path | ❌ N/A | ❌ N/A | ❌ N/A | ❌ N/A | ✅ **DIFFERENTIATOR** |
| Cost-aware allocation | ❌ N/A | ❌ N/A | ❌ N/A | ⚠️ Resource pricing | ⚠️ Future (analytics exist) |
| Learning-based tuning | ❌ None | ❌ None | ❌ None | ❌ None | ✅ **DIFFERENTIATOR** (learning exists) |
| AST depth by path | ⚠️ projectService | ❌ Global only | ❌ N/A | ❌ N/A | ⚠️ Future (graphMaxDepth exists) |
| Override precedence | ✅ Last wins | ✅ First wins (exclude) | ✅ Boolean OR | ✅ Mapping | ✅ Last wins (ESLint pattern) |
| Pattern validation | ⚠️ Basic | ❌ None | ❌ None | ❌ None | ✅ Complexity scoring (existing) |

### Competitive Insights

**ESLint (Linting Standard):**
- `overrides` array with glob patterns is the de facto standard
- Last-match-wins precedence is well-understood by developers
- No resource allocation (linting is cheap)
- Sets expectations for path-based configuration UX

**Golangci-lint (Multi-Linter Orchestration):**
- `exclude-rules` enables per-path linter selection
- Inverse matching (`path-except`) enables test-only checks
- Global timeout only, no per-path timeouts
- Shows path-based tool selection is valuable

**GitHub Actions (CI Orchestration):**
- `dorny/paths-filter` is widely adopted (11k+ repos)
- Enables different jobs with different resources by path
- Manual wiring required (not automatic)
- Proves developers want path-based resource allocation

**CircleCI (Enterprise CI):**
- Dynamic config + path filtering is powerful combo
- Resource classes (small/medium/large/xlarge) scale clearly
- Explicit resource allocation prevents waste
- Enterprise pattern: critical code gets premium resources

**Our Differentiators:**
1. **Automatic resource scaling** — Intensity levels abstract provider count, timeout, prompt depth
2. **Multi-dimensional intensity** — Not just "more providers", but holistic behavior change
3. **Learning-based optimization** — Use feedback data to tune intensity mappings over time
4. **Cost-aware allocation** — Balance provider count with budget constraints
5. **Consensus threshold scaling** — Lower agreement bar for non-critical code
6. **Existing infrastructure** — Path matcher, learning system, analytics already built

## Implementation Complexity Notes

### LOW Complexity (1-2 days)

**Provider count mapping:**
- Add `intensityProviderCounts: { thorough: 8, standard: 5, light: 3 }` to config schema
- Wire into provider selection logic (`setup.ts` or `orchestrator.ts`)
- Use detected intensity to slice provider array

**Timeout mapping:**
- Add `intensityTimeouts: { thorough: 180, standard: 90, light: 30 }` to config schema
- Wire into LLM timeout configuration
- Use detected intensity to set request timeout

**Batch size by intensity:**
- Add `intensityBatchSizes` to config schema
- Use in token-aware batching logic (already exists)

**Cache TTL by path:**
- Add `intensityCacheTtl` to config schema
- Wire into incremental review cache logic

**Path-based severity filtering:**
- Add `intensityMinSeverity` to config schema
- Combine with existing `INLINE_MIN_SEVERITY`

### MEDIUM Complexity (3-5 days)

**Prompt depth mapping:**
- Create prompt variants (detailed/balanced/quick) for each template
- Add `intensityPromptDepth` to config schema
- Wire into `PromptBuilder` to select variant by intensity
- Validate all providers work with all depth variants

**Consensus threshold by intensity:**
- Add `intensityConsensusThreshold` to config schema
- Wire into `FindingFilter` consensus logic
- Test edge cases (what if thorough finds nothing but standard finds issues?)

**AST depth by intensity:**
- Add `intensityGraphDepth` to config schema
- Wire into CodeGraph configuration
- May conflict with existing `graphMaxDepth` global setting

**Integration tests:**
- Create test scenarios with path patterns
- Verify provider count, timeout, prompt depth actually change
- Test override precedence and fallback behavior

**Configuration validation:**
- Warn on unreachable patterns
- Validate provider counts within discovery limit
- Check timeout values are reasonable

### HIGH Complexity (1-2 weeks)

**Learning-informed tuning:**
- Analyze provider weight data by path pattern
- Recommend intensity adjustments based on acceptance rates
- Auto-tune intensity mappings over time
- Requires significant analytics and ML work

**Cost-aware allocation:**
- Calculate cost per intensity level
- Balance provider count with budget constraints
- Dynamic provider selection based on spend
- Integrate with existing cost tracking

**Dynamic intensity adjustment:**
- Start with light intensity
- Escalate to thorough if high-severity issues found
- Requires review state management and re-execution
- Breaks incremental caching assumptions

**Path-based analytics:**
- Track cost, quality, acceptance rate by directory
- Generate reports on intensity effectiveness
- Recommend configuration improvements
- Dashboard integration

## Configuration Examples

### Basic: Thorough review for core code

```yaml
# .github/code-review.yml
pathIntensity:
  enabled: true
  defaultIntensity: standard
  patterns:
    - pattern: "src/core/**"
      intensity: thorough
      description: "Critical business logic"

    - pattern: "docs/**"
      intensity: light
      description: "Documentation files"

intensityProviderCounts:
  thorough: 8
  standard: 5
  light: 3

intensityTimeouts:
  thorough: 180  # 3 minutes
  standard: 90   # 1.5 minutes
  light: 30      # 30 seconds

intensityPromptDepth:
  thorough: detailed
  standard: balanced
  light: quick
```

### Advanced: Multi-dimensional intensity

```yaml
# .github/code-review.yml
pathIntensity:
  enabled: true
  defaultIntensity: standard
  patterns:
    - pattern: "src/auth/**"
      intensity: thorough
      description: "Authentication code - security critical"

    - pattern: "src/api/**"
      intensity: thorough
      description: "API layer - customer-facing"

    - pattern: "src/utils/**"
      intensity: standard
      description: "Utilities - standard review"

    - pattern: "**/*.test.ts"
      intensity: light
      description: "Test files - quick checks"

    - pattern: "**/*.md"
      intensity: light
      description: "Documentation - quick checks"

intensityProviderCounts:
  thorough: 8
  standard: 5
  light: 3

intensityTimeouts:
  thorough: 180
  standard: 90
  light: 30

intensityPromptDepth:
  thorough: detailed
  standard: balanced
  light: quick

intensityConsensusThreshold:
  thorough: 0.6   # 3/5 providers
  standard: 0.6   # 3/5 providers
  light: 0.67     # 2/3 providers

intensityMinSeverity:
  thorough: minor      # Surface all issues
  standard: major      # Skip minor issues
  light: critical      # Only critical issues

intensityBatchSizes:
  thorough: 1   # One file per batch for deep analysis
  standard: 3   # Small batches
  light: 10     # Large batches for efficiency

intensityCacheTtl:
  thorough: 1    # Cache 1 day
  standard: 3    # Cache 3 days
  light: 7       # Cache 7 days
```

## Best Practices from Research

### What Works

1. **Explicit over automatic:** Manual configuration beats AI-guessed criticality (ESLint pattern)
2. **Glob patterns over regex:** Safer, more readable, ecosystem standard (GitHub Actions)
3. **Last-match-wins precedence:** Intuitive override behavior (ESLint standard)
4. **Three-tier intensity:** Simple mental model (small/medium/large in CircleCI)
5. **Test file special handling:** Universal pattern across all tools
6. **Resource scaling by criticality:** Enterprise CI standard (CircleCI resource classes)
7. **Path-based exclusions:** Reduce noise without skipping analysis (golangci-lint)
8. **Default fallback:** Graceful handling of unmatched files

### What Doesn't Work

1. **Per-file configuration:** Maintenance nightmare, use directory patterns instead
2. **Automatic intensity detection:** Unpredictable, breaks reproducibility
3. **Regex patterns:** Security risks (ReDoS), use globs instead
4. **Unlimited provider escalation:** Diminishing returns, cost explosion
5. **Path-based provider selection:** Breaks consensus, inconsistent quality
6. **Zero-resource skip mode:** Creates blind spots, hidden issues
7. **Intensity inheritance:** Confusing precedence, hard to debug
8. **Dynamic adjustment mid-review:** Breaks caching, unpredictable behavior

### Key Metrics to Track

- **Cost by intensity level:** Average spend for thorough/standard/light reviews
- **Time by intensity level:** Average duration for each intensity
- **Quality by intensity level:** Acceptance rate for findings by intensity
- **Pattern effectiveness:** Which patterns match most frequently
- **Provider utilization:** How many providers actually used vs allocated
- **Cache hit rate by intensity:** Incremental review effectiveness by path
- **Consensus rate by intensity:** How often providers agree by intensity level

## Security Considerations

### Safe for v1.0

- Pattern validation with complexity scoring (prevents ReDoS) — Already implemented
- Glob patterns only (no regex) — Safer, ecosystem standard
- Hard caps on provider counts (max 8) — Prevents resource exhaustion
- Timeout limits enforced — Prevents runaway reviews
- Pattern length limits (500 chars) — Prevents memory exhaustion
- Explicit configuration only — No automatic intensity detection

### Requires Validation (Post-v1.0)

- Learning-informed tuning — Ensure feedback data can't manipulate intensity
- Dynamic intensity adjustment — Prevent escalation loops
- Cost-aware allocation — Validate budget constraints enforced
- Path-based analytics — Protect sensitive path information

## Open Questions

1. **Provider count vs discovery limit:** If `intensityProviderCounts.thorough=8` but `providerDiscoveryLimit=6`, what happens?
   - **Answer:** Discovery limit is upper bound. Thorough can't use more than discovered. Need validation warning.

2. **Consensus with varying provider counts:** If thorough uses 8 providers but standard uses 5, how does consensus compare findings?
   - **Answer:** Consensus threshold is percentage, so scales naturally. But need to ensure fair comparison.

3. **Cache invalidation on intensity change:** If pattern changes from standard to thorough, should cache invalidate?
   - **Answer:** Yes, intensity affects review behavior. Cache key should include intensity level.

4. **Timeout inheritance:** Does LLM timeout inherit from intensity timeout or vice versa?
   - **Answer:** Intensity timeout is per-review, LLM timeout is per-request. Need separate config.

5. **Batch size conflicts:** If `intensityBatchSizes.light=10` but `batchMaxFiles=5`, which wins?
   - **Answer:** Global `batchMaxFiles` is hard limit. Intensity is preferred size within limit.

6. **Prompt depth compatibility:** Do all providers support detailed/balanced/quick variants?
   - **Answer:** Need to validate. May require provider-specific prompt templates.

7. **Cost projection:** How do we estimate review cost given intensity configuration?
   - **Answer:** Use existing cost tracking with intensity-aware projections. Post-v1.0 feature.

## Sources

### Official Documentation (HIGH confidence)

- [ESLint Configuration Files (Deprecated)](https://eslint.org/docs/latest/use/configure/configuration-files-deprecated) — Override patterns and precedence
- [Golangci-lint Configuration File](https://golangci-lint.run/docs/configuration/file/) — Path-based exclusion rules
- [GitHub dorny/paths-filter](https://github.com/dorny/paths-filter) — Conditional job execution
- [CircleCI Path Filtering Orb](https://circleci.com/developer/orbs/orb/circleci/path-filtering) — Dynamic configuration
- [TypeScript-ESLint Project Service](https://typescript-eslint.io/blog/project-service/) — AST depth optimization

### Community Insights (MEDIUM confidence)

- [Graphite - Testing Strategies for Monorepos](https://graphite.com/guides/testing-strategies-for-monorepos) — Selective test execution
- [CircleCI - Monorepo Development Practices](https://circleci.com/blog/monorepo-dev-practices/) — Path-based CI patterns
- [Pure Storage - Static and Dynamic Code Scanning in DevSecOps](https://blog.purestorage.com/purely-technical/harnessing-static-and-dynamic-code-scanning-in-devsecops/) — Scan depth strategies
- [xJavaScript - Configure Different ESLint Rules by File Extension](https://www.xjavascript.com/blog/different-eslint-rules-based-on-file-extension/) — Override examples
- [OneUpTime - Monorepo Path Filters in GitHub Actions](https://oneuptime.com/blog/post/2025-12-20-monorepo-path-filters-github-actions/view) — Advanced patterns

### Tool Research (MEDIUM-LOW confidence)

- [Trunk.io - Configure Linters](https://docs.trunk.io/code-quality/linters/configure-linters) — Path-based triggers
- [Reviewdog GitHub](https://github.com/reviewdog/reviewdog) — Severity and filter modes
- [Golangci-lint Discussion - Cache not lowering lint time](https://github.com/golangci/golangci-lint/discussions/4231) — Performance patterns

---
*Feature research for: Path-based intensity control in multi-provider code review*
*Researched: 2026-02-05*
