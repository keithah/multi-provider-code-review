# Multi-Provider Code Review: Pragmatic Development Plan v2.1

**Date**: 2026-01-23
**Status**: Approved and Ready for Implementation
**Timeline**: 14 weeks (vs 18 weeks in original v2.1 spec)

## Quick Summary

This is a **focused, ROI-driven plan** to build the best-in-class code review tool by implementing only the highest-value features from the v2.1 specification, plus strategic additions.

**What's Different from Full v2.1 Spec:**
- ✅ Keeps all critical features (incremental review, feedback learning, code graph, CLI)
- ✅ Adds new features (analytics dashboard, provider reliability, auto-fix prompts)
- ❌ Defers complex features (full ML, VS Code extension, advanced rule inference)
- 🚀 14 weeks instead of 18 weeks
- 📊 Focus on proven, high-impact features

---

## Current State Analysis

**What's Working (v2.0 ~85% complete):**
- ✅ Multi-provider execution with OpenRouter & OpenCode
- ✅ Synthesis engine with consensus filtering
- ✅ Evidence-based confidence scoring
- ✅ Impact analysis and Mermaid diagrams
- ✅ AST analysis (console.log, debugger, unsafe any, empty catch)
- ✅ Cost tracking with OpenRouter pricing API
- ✅ SARIF and JSON output
- ✅ Chunked GitHub comment posting
- ✅ Test coverage hints and AI code detection
- ✅ Security scanning (secrets, patterns)

**What's Missing:**
- ❌ Incremental review (PR updates are slow/expensive)
- ❌ CLI mode (no local development workflow)
- ❌ Feedback learning (no continuous improvement)
- ❌ Code graph (context detection uses simple import parsing)
- ❌ Provider reliability tracking
- ❌ Test coverage <60% (target: 85%)

---

## 3-Phase Implementation Plan

### Phase 1: Polish & Quick Wins (4 weeks)

**Goal:** Ship production-ready v2.0 with critical missing features

#### Week 1-2: Testing & Developer Experience

**Tasks:**
1. **Increase test coverage to 85%**
   - Provider integration tests (mock OpenRouter/OpenCode APIs)
   - End-to-end orchestrator tests
   - Output formatter tests (Markdown, SARIF, JSON)
   - Proper GitHub API mocking

2. **Add performance benchmarks**
   - Track review time by PR size
   - Track cost per review by provider mix
   - Track cache hit rates

3. **Developer experience improvements**
   - Pre-commit hook script for local reviews
   - `--dry-run` mode (preview without posting)
   - Better error messages and validation
   - Structured logging throughout

**Deliverables:**
- `__tests__/integration/provider-openrouter.test.ts`
- `__tests__/integration/provider-opencode.test.ts`
- `__tests__/integration/end-to-end.test.ts`
- `scripts/pre-commit.sh`
- Enhanced `src/utils/logger.ts`

#### Week 3: Incremental Review System ⭐

**Why:** 6x faster and 80% cheaper on PR updates

**Implementation:**
```typescript
// src/cache/incremental.ts
export class IncrementalReviewer {
  async getNewCommits(pr: PRContext): Promise<string[]> {
    // Return commits since last review
  }

  async getChangedFilesSince(lastCommit: string): Promise<FileChange[]> {
    // Git diff from lastCommit to HEAD
  }

  async reviewDelta(newFiles: FileChange[]): Promise<Review> {
    // Review only changed files, merge with previous
  }
}
```

**How it works:**
1. Store last reviewed commit SHA in cache
2. On PR update, compute git diff from last commit
3. Review only changed files (not entire PR)
4. Merge new findings with previous review
5. Update existing comment (no spam)

**Integration:**
- Update `src/core/orchestrator.ts` to check for incremental mode
- Update `src/cache/manager.ts` to track commit SHAs
- Add `action.yml` config: `INCREMENTAL_ENABLED: true`

**Deliverables:**
- `src/cache/incremental.ts` (~300 lines)
- `__tests__/integration/incremental.test.ts`
- Updated orchestrator logic

#### Week 4: CLI Mode ⭐

**Why:** Pre-push reviews save time and prevent bad code

**Commands:**
```bash
npm install -g multi-provider-review

mpr review                    # Uncommitted changes
mpr review HEAD~1             # Specific commit
mpr review main..feature      # Branch comparison
mpr review --fix-prompts      # Generate AI IDE prompts
```

**Scope:**
- Parse local git diff (no GitHub API)
- Reuse existing orchestrator
- Terminal-optimized output (colors, emoji, concise)
- Exit code based on severity (CI integration)
- Optionally save results to file

**Implementation:**
```typescript
// src/cli/index.ts - Main CLI entry point
// src/cli/formatter.ts - Terminal output formatter
// bin/mpr - Executable wrapper
```

**Deliverables:**
- `src/cli/` directory with index.ts and formatter.ts
- `bin/mpr` executable
- `package.json` with `bin` entry
- `README.md` CLI usage documentation

**Milestone:** v2.0 Stable Release

---

### Phase 2: Strategic v2.1 Features (6 weeks)

**Goal:** Add competitive moat features

#### Week 5-6: Feedback Learning System ⭐

**Why:** Continuous improvement differentiates us

**Simple Learning Approach:**
- Track 👍/👎 reactions on GitHub comments
- Adjust confidence thresholds per category/severity
- Implement "quiet mode" (only high-confidence comments)
- No complex ML - just weighted averages

**Implementation:**
```typescript
// src/learning/feedback-tracker.ts
export class FeedbackTracker {
  async recordReaction(findingId: string, reaction: '👍' | '👎'): Promise<void>
  async getConfidenceThreshold(category: string): Promise<number>
  async adjustWeights(): Promise<void>
}

// src/learning/quiet-mode.ts
export class QuietModeFilter {
  filterByConfidence(findings: Finding[], threshold: number): Finding[]
}
```

**Learning Algorithm:**
```
For each category:
  positive_rate = 👍 / (👍 + 👎)

  If positive_rate > 0.8: increase confidence threshold
  If positive_rate < 0.5: decrease confidence threshold

  Quiet mode: only show findings with confidence > threshold
```

**Data Storage:**
- Store feedback in GitHub Actions cache
- Format: `{ findingId, category, severity, reaction, timestamp }`
- Aggregate weekly to update weights

**Deliverables:**
- `src/learning/feedback-tracker.ts`
- `src/learning/quiet-mode.ts`
- `src/github/feedback-handler.ts` (webhook listener)
- Config: `QUIET_MODE_ENABLED`, `QUIET_MIN_CONFIDENCE`

#### Week 7-8: Code Graph & Enhanced Context ⭐

**Why:** Deterministic dependency tracking improves accuracy

**What's a Code Graph:**
- AST-based dependency graph of entire codebase
- Tracks: imports, function calls, class inheritance
- Enables O(1) lookups for "who uses this?"
- Cached and incrementally updated

**Implementation:**
```typescript
// src/analysis/context/graph-builder.ts
export class CodeGraphBuilder {
  async buildGraph(files: FileChange[]): Promise<CodeGraph>
  async updateGraph(changedFiles: FileChange[]): Promise<void>
}

interface CodeGraph {
  definitions: Map<string, Definition>    // All symbols
  imports: Map<string, string[]>          // file → imported files
  calls: Map<string, string[]>            // fn → called fns

  findCallers(symbol: string): CodeSnippet[]
  findConsumers(file: string): CodeSnippet[]
}
```

**Integration:**
- Enhance `ContextRetriever` to use graph
- Add "graph confirmed" to evidence scoring
- Better impact analysis with full dependency tree

**Storage:**
- Persist graph in Actions cache (~1-5MB for typical repo)
- Rebuild on cache miss (<10s)
- Incremental update on file changes (<1s)

**Deliverables:**
- `src/analysis/context/graph-builder.ts` (~400 lines)
- Updated `src/analysis/context.ts`
- Updated `src/analysis/evidence.ts`
- `__tests__/unit/graph-builder.test.ts`

#### Week 9-10: Auto-Fix Prompts & Provider Reliability ⭐

**Auto-Fix Prompts:**
- Generate fix suggestions as prompts for AI IDEs
- No actual code modification (too risky)
- Output formats: Cursor, Copilot, plain text

**Example Output:**
```json
{
  "file": "src/auth.ts",
  "line": 42,
  "finding": "Null pointer access",
  "fixPrompt": "Add null check: if (!user?.permissions) return;"
}
```

**Provider Reliability Scoring:**
- Track success/failure rates per provider
- Track false positive rates (from feedback)
- Rank providers by reliability
- Show reliability in output

**Implementation:**
```typescript
// src/autofix/prompt-generator.ts
export class PromptGenerator {
  generateFixPrompts(findings: Finding[]): FixPrompt[]
  formatForCursor(prompts: FixPrompt[]): string
}

// src/providers/reliability-tracker.ts
export class ReliabilityTracker {
  recordResult(provider: string, success: boolean): void
  recordFalsePositive(provider: string, findingId: string): void
  getReliabilityScore(provider: string): number
  rankProviders(providers: Provider[]): Provider[]
}
```

**Deliverables:**
- `src/autofix/prompt-generator.ts`
- `src/providers/reliability-tracker.ts`
- CLI: `mpr review --fix-prompts`
- Updated provider ranking in registry

**Milestone:** v2.1-beta Release

---

### Phase 3: Advanced Differentiators (4 weeks)

**Goal:** Enterprise features and analytics

#### Week 11-12: Analytics & Telemetry Dashboard

**Why:** Show value, understand usage, improve product

**Dashboard Features:**
1. Cost trends over time (chart)
2. Review count and speed (chart)
3. False positive rate from feedback (chart)
4. Top finding categories (bar chart)
5. Provider performance comparison (table)
6. ROI calculation (time saved, cost vs value)

**Implementation:**
```typescript
// src/analytics/metrics-collector.ts
export class MetricsCollector {
  recordReview(review: Review): void
  generateDashboard(): HTMLReport
  exportCSV(): string
}

// Dashboard tech stack
- Chart.js for visualizations
- HTML template with inline CSS/JS
- No external dependencies
```

**Output:**
- Generate `analytics.html`
- Upload as GitHub Actions artifact
- Optionally post summary to PR

**Deliverables:**
- `src/analytics/metrics-collector.ts`
- `src/analytics/dashboard-generator.ts`
- `src/analytics/templates/dashboard.html`
- Config: `ANALYTICS_ENABLED`

#### Week 13-14: Enterprise Features

**Self-Hosted Support:**
- Remove GitHub Actions hard dependencies
- Add webhook server mode (optional)
- Docker container with all dependencies
- Environment-based configuration

**Custom Provider Plugins:**
- Load providers from npm packages
- Plugin interface for custom providers
- Example: `@company/internal-llm-provider`

**Team Features:**
- Multi-repo config inheritance
- Centralized feedback learning
- Team-wide custom rules
- Admin dashboard (optional)

**Implementation:**
```typescript
// src/server/webhook-handler.ts (optional)
export class WebhookServer {
  start(port: number): void
  handlePullRequest(event: PullRequestEvent): Promise<void>
}

// src/providers/plugin-loader.ts
export class PluginLoader {
  loadProvider(packageName: string): Provider
  validatePlugin(provider: Provider): boolean
}
```

**Deliverables:**
- `Dockerfile` with Node 20, Tree-sitter, dependencies
- `docker-compose.yml` for local testing
- `src/server/` directory (webhook mode)
- `src/providers/plugin-loader.ts`
- `docs/self-hosted.md` documentation

**Milestone:** v2.1 Stable Release

---

## Key Additions Not in Original v2.1 Spec

### 1. Provider Reliability Tracking ⭐ NEW

Track which providers are most accurate based on:
- Success/failure rates
- False positive rates (from feedback)
- Response time consistency
- Cost efficiency

**Benefits:**
- Auto-downrank unreliable providers
- Recommend best providers per language
- Show reliability scores in output

### 2. Auto-Fix Prompts ⭐ NEW

Generate fix suggestions formatted for AI IDEs:
- Cursor format
- GitHub Copilot format
- Plain text for copy-paste

**Benefits:**
- Faster fix iteration
- Bridge to full autofix in future
- No risk of bad auto-fixes

### 3. Analytics Dashboard ⭐ NEW

HTML dashboard showing:
- Cost trends
- Accuracy trends
- Provider performance
- ROI calculations

**Benefits:**
- Prove value to stakeholders
- Identify improvement opportunities
- Make data-driven decisions

### 4. Pre-commit Hook Integration

Simple script for local reviews before push:
```bash
#!/bin/bash
mpr review --quiet
if [ $? -ne 0 ]; then
  echo "❌ Review found issues. Run 'mpr review' for details."
  exit 1
fi
```

**Benefits:**
- Catch issues before CI
- Faster feedback loop
- Less PR churn

---

## Features Intentionally Deferred

**Not in this 14-week plan:**
- Complex ML learning (beyond reaction-based weights)
- Full code modification autofix (too risky)
- Up-to-date library docs fetching (complex)
- VS Code extension (separate project)
- Advanced rule inference from comments
- Semantic finding deduplication (embeddings)

**Why defer:**
- Lower ROI than included features
- Higher risk / complexity
- Need user feedback first
- Better as v2.2+ features

**When to build:**
- After v2.1 has 100+ active users
- When feedback shows clear demand
- When resources are available

---

## Updated Configuration Schema

```yaml
# .mpr.yml (new options)

incremental:
  enabled: true
  cache_ttl_days: 7
  force_full_review_labels: ['breaking-change']

learning:
  enabled: true
  quiet_mode: true
  min_confidence: 0.7
  feedback_lookback_days: 30

graph:
  enabled: true
  cache_graphs: true
  max_depth: 5
  timeout_seconds: 10

analytics:
  enabled: true
  generate_dashboard: true
  export_csv: true

autofix:
  generate_prompts: true
  format: 'cursor'  # or 'copilot', 'plain'

providers:
  track_reliability: true
  rank_by_reliability: true
  min_reliability_score: 0.5
```

---

## Success Metrics by Phase

### Phase 1 Targets (Week 4)
- ✅ Test coverage ≥ 85%
- ✅ Incremental review <5s on PR updates
- ✅ CLI works for TypeScript, Python, JavaScript, Go, Rust
- ✅ Zero P0 bugs in production

### Phase 2 Targets (Week 10)
- ✅ False positive rate <8% (measured via feedback)
- ✅ Context recall ≥95% (with code graph)
- ✅ Quiet mode reduces comment volume by 40%
- ✅ Provider reliability scores ±10% of manual assessment

### Phase 3 Targets (Week 14)
- ✅ Analytics dashboard deployed
- ✅ Self-hosted Docker works
- ✅ 100+ GitHub stars
- ✅ 3+ production users beyond author

---

## Implementation Priority Matrix

| Feature | Business Impact | Dev Effort | Priority | Week |
|---------|----------------|------------|----------|------|
| Test coverage 85% | HIGH | MEDIUM | P0 | 1-2 |
| Incremental review | HIGH | MEDIUM | P0 | 3 |
| CLI mode | HIGH | LOW | P0 | 4 |
| Feedback learning | HIGH | MEDIUM | P0 | 5-6 |
| Code graph | MEDIUM | HIGH | P1 | 7-8 |
| Auto-fix prompts | MEDIUM | LOW | P1 | 9 |
| Provider reliability | MEDIUM | MEDIUM | P1 | 10 |
| Quiet mode | MEDIUM | LOW | P1 | 5-6 |
| Analytics dashboard | LOW | MEDIUM | P2 | 11-12 |
| Self-hosted | LOW | HIGH | P2 | 13-14 |

---

## Risk Assessment & Mitigation

### Technical Risks

**Risk:** Code graph too slow for large repos (10,000+ files)
- **Mitigation:** Incremental updates, depth limits, timeout fallback
- **Fallback:** AST-only mode if graph build times out

**Risk:** Not enough feedback data to train learning system
- **Mitigation:** Start with conservative defaults, need 100+ reviews
- **Fallback:** Manual confidence tuning via config

**Risk:** Incremental review misses dependencies
- **Mitigation:** Option to force full review, validate with tests
- **Fallback:** Full review if cache missing or stale

### Product Risks

**Risk:** Feature bloat makes tool hard to use
- **Mitigation:** Sensible defaults, progressive disclosure
- **Decision:** All advanced features opt-in

**Risk:** Competitors copy approach
- **Mitigation:** Open source is the moat, build community
- **Advantage:** First-mover, MIT license, multi-provider unique

**Risk:** Free tier not sustainable
- **Mitigation:** Budget caps, aggressive caching
- **Backup:** Paid tier for enterprises (hosted, support)

---

## Verification & Testing Plan

### End-to-End Test Cases

1. **Small PR (5 files, 100 lines)**
   - Expected: <10s review, <$0.005 cost
   - Validate: findings accurate, no false positives

2. **Medium PR (20 files, 500 lines)**
   - Expected: <30s review, <$0.01 cost
   - Validate: consensus works, evidence scoring correct

3. **Large PR (100 files, 2000 lines)**
   - Expected: <90s review, <$0.03 cost
   - Validate: chunking works, all files reviewed

4. **PR Update (3 new commits)**
   - Expected: <5s incremental, <$0.001 cost
   - Validate: only new files reviewed, findings merged

5. **CLI Local Review**
   - Expected: <15s, no API calls
   - Validate: terminal output correct, exit codes work

### Performance Benchmarks

```bash
npm run benchmark

# Outputs:
- Review time by file count: 5, 10, 20, 50, 100 files
- Cost by provider mix: 1, 3, 5, 7 providers
- Cache hit rate: warm cache vs cold cache
- Incremental speedup: full review vs delta
- Graph build time by repo size
```

---

## Timeline Summary

```
┌─────────────────────────────────────────────────────┐
│ Phase 1: Polish & Quick Wins (4 weeks)             │
├─────────────────────────────────────────────────────┤
│ Week 1-2:  Testing, DX, pre-commit hook            │
│ Week 3:    Incremental review system               │
│ Week 4:    CLI mode (MVP)                          │
│            → v2.0 Stable Release                   │
└─────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────┐
│ Phase 2: Strategic v2.1 Features (6 weeks)         │
├─────────────────────────────────────────────────────┤
│ Week 5-6:  Feedback learning + quiet mode          │
│ Week 7-8:  Code graph + enhanced context           │
│ Week 9-10: Auto-fix prompts + reliability          │
│            → v2.1-beta Release                     │
└─────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────┐
│ Phase 3: Advanced Differentiators (4 weeks)        │
├─────────────────────────────────────────────────────┤
│ Week 11-12: Analytics & telemetry dashboard        │
│ Week 13-14: Enterprise features + self-hosted      │
│            → v2.1 Stable Release                   │
└─────────────────────────────────────────────────────┘

Total: 14 weeks (vs 18 in original v2.1 spec)
Savings: 4 weeks (22% faster)
Features: 25 implemented, 10 deferred to v2.2+
```

---

## Next Steps

**Week 0 (This Week):**
1. ✅ Review and approve this plan
2. ⬜ Update FINAL_SPECIFICATION_V2.1.md with approved plan
3. ⬜ Create GitHub project board with all tasks
4. ⬜ Set up milestones: v2.0-stable, v2.1-beta, v2.1-stable
5. ⬜ Create feature branches: `feature/incremental`, `feature/cli`, etc.

**Week 1 (Start immediately):**
1. ⬜ Add provider integration tests
2. ⬜ Add end-to-end orchestrator tests
3. ⬜ Add output formatter tests
4. ⬜ Set up pre-commit hook script
5. ⬜ Add performance benchmarks
6. ⬜ Improve error messages and logging

**Daily workflow:**
- Morning: Review plan, pick next task
- Afternoon: Implement, test, document
- Evening: Commit, push, update progress
- Weekly: Demo completed features

---

## Recommendation

**✅ Approve this plan instead of building full v2.1 spec**

**Reasons:**
1. **Faster to market:** 14 weeks vs 18 weeks (4 weeks saved)
2. **Higher ROI:** Every feature has proven business value
3. **Lower risk:** Defer unproven complex features
4. **Better UX:** CLI and incremental review are developer wins
5. **Validate first:** Ship v2.0, learn from users, iterate

**What we're deferring:**
- Complex ML (beyond reaction weights)
- Full autofix (too risky)
- Library docs (complex)
- VS Code extension (big project)
- Advanced rule inference

**When to build deferred features:**
- After 100+ active users
- When feedback shows clear demand
- When we have resources

**First commit:**
Update `FINAL_SPECIFICATION_V2.1.md` → `DEVELOPMENT_PLAN_V2.1.md`
