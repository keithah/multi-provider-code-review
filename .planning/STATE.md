# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-02-04)

**Core value:** Reduce friction from issue detection to fix application - developers can resolve code review findings instantly by clicking "Commit suggestion" rather than context-switching to their editor.

**Current focus:** Phase 5 - Complete Learning Feedback Loop

## Current Position

Phase: 5 of 5 (Complete Learning Feedback Loop)
Plan: 2 of 2 in current phase
Status: Phase complete
Last activity: 2026-02-05 — Completed 05-02-PLAN.md (Add acceptance detection orchestration)

Progress: [█████████████████████] 100% (21 of 21 total plans)

## Performance Metrics

**Velocity:**
- Total plans completed: 21
- Average duration: 2.6 min
- Total execution time: 0.92 hours

**By Phase:**

| Phase | Plans | Total | Avg/Plan |
|-------|-------|-------|----------|
| 1 - Core Suggestion Formatting | 3/3 | 9 min | 3 min |
| 2 - LLM Fix Generation Integration | 4/4 | 10 min | 2.5 min |
| 3 - Multi-line and Advanced Formatting | 3/3 | 8 min | 2.7 min |
| 4 - Validation and Quality | 9/9 | 30.5 min | 3.4 min |
| 5 - Complete Learning Feedback Loop | 2/2 | 5.5 min | 2.8 min |

**Recent Trend:**
- Last 5 plans: 04-07 (6min), 04-08 (4min), 04-09 (2.5min), 05-01 (1.5min), 05-02 (4min)
- Trend: All phases complete! Bi-directional learning loop operational.

*Updated after each plan completion*

## Accumulated Context

### Decisions

Decisions are logged in PROJECT.md Key Decisions table.
Recent decisions affecting current work:

- Prompt LLMs for fixes during initial review (single-pass is faster than two-phase)
- Fallback to description-only (better to surface issue without fix than suppress finding)
- Use GitHub's native suggestion syntax (leverages built-in UI, no custom implementation needed)
- Use dynamic fence delimiter calculation (max backticks + 1) for robust escaping (01-01)
- Return empty string for empty/whitespace input (no partial suggestion blocks) (01-01)
- Reuse mapLinesToPositions from diff.ts instead of reimplementing line mapping (01-02)
- Return null (not undefined) for invalid lines for explicit null checks (01-02)
- Validate suggestions in CommentPoster rather than formatters (01-03)
- Use regex replacement for graceful degradation of invalid suggestions (01-03)
- Use 50 line limit for suggestion sanity (catches hallucination while allowing multi-line fixes) (02-02)
- Use regex pattern for code syntax detection (language-agnostic, no dependencies) (02-02)
- Structured validation result interface (explicit isValid flag prevents misuse) (02-02)
- Use logger.debug (not warn) for invalid suggestions per CONTEXT.md guidance (02-03)
- No retries on invalid suggestions (strict validation approach) (02-03)
- Graceful degradation: finding posted without suggestion, no crash (02-03)
- Use single 50k token threshold (not tiered) for simplicity - conservative for small windows, reasonable for large (02-04)
- Skip entire suggestion instructions (not just examples) when diff is large - cleaner schema reduction (02-04)
- Log skip at debug level (not warn/info) - normal flow, not exceptional condition (02-04)
- Use inclusive range formula (endLine - startLine + 1) to avoid off-by-one errors (03-01)
- Fail fast on missing lines rather than separate gap detection (simpler logic) (03-01)
- Return positions in validation result for convenience (avoid redundant lookups) (03-01)
- Return false immediately when hitting new hunk after finding start line (strict boundary enforcement) (03-02)
- Track new file lines only (added + context, not deleted lines) (03-02)
- Use same hunkRegex pattern as mapLinesToPositions for consistency (03-02)
- Use logger.debug (not warn) for suggestion validation failures (normal flow, not exceptional) (03-03)
- Hunk boundary check runs after consecutive check (defensive layer, better error messages) (03-03)
- Delete position parameter when using line-based multi-line API (GitHub API constraint) (03-03)
- Sort comments by file path then line for optimal batch commit UX (03-03)
- Check both ERROR and MISSING nodes for complete validation (04-01)
- Return skip result for unsupported languages (not failure) (04-01)
- Use 1-indexed line/column numbers for consistency with GitHub (04-01)
- Reuse getParser from ast/parsers.ts instead of reimplementing (04-01)
- Compare ALL children (named + unnamed) to detect operator/keyword differences (04-02)
- Treat identifiers and literals as value-only (structure match, ignore content) (04-02)
- Add MAX_COMPARISON_DEPTH (1000) to prevent infinite recursion (04-02)
- Walk tree with proper cursor traversal to avoid infinite loops (04-02)
- Use multiplicative boosts for LLM path (1.1x syntax, 1.2x consensus) (04-03)
- Use additive bonuses for fallback path (+0.2 syntax, +0.2 consensus) (04-03)
- Cap all confidence scores at 1.0 to prevent over-confidence (04-03)
- Default threshold 0.7 balances precision and recall (04-03)
- Consensus requirement only enforced for critical severity (04-03)
- Support both PR-scoped and repo-scoped suppression for flexibility (04-04)
- Simple file+category+line-proximity matching (within 5 lines) for similarity (04-04)
- Weight formula: 0.3 + (0.7 * positiveRate) with 5-feedback threshold (04-04)
- TTL: 7 days (PR scope), 30 days (repo scope) for automatic expiry (04-04)
- Use AST comparison for suggestion equivalence (not just string matching) (04-05)
- Fall back to normalized string comparison for unknown languages (04-05)
- Set hasConsensus during filter aggregation when providers agree (04-05)
- Track per-provider suggestions using temporary _suggestions field (04-05)
- Read hasConsensus from Finding (set during aggregation) instead of computing at comment-post time (04-06)
- Apply validation as async quality gate before posting suggestions (04-06)
- Limit code graph context to 3 files to avoid prompt bloat (04-06)
- Use 10x review limit for suggestion quality metrics (more granular than reviews) (04-06)
- Add getCalls/getCallers public accessors to CodeGraph for prompt builder (04-06)
- Inject learned patterns after defensive context (priority order in prompt) (04-07)
- Make build() async to support learned preference fetching (enables data aggregation) (04-07)
- Use debug-level logging for enrichment failures (graceful degradation, not error) (04-07)
- Default config: 5 feedback minimum, 0.5 low-quality threshold (balanced sensitivity) (04-07)
- Limit to 5 suppression categories in prompts (avoid overwhelming LLM with context) (04-07)
- Track both commit-based and reaction-based acceptances for comprehensive coverage (04-08)
- Use regex patterns to detect GitHub's "Apply suggestions" commit messages (04-08)
- Use "unknown" provider fallback for graceful degradation when attribution missing (04-08)
- Use 'cli-mode' key for CLI suppression tracker (isolated from production) (04-09)
- Use '${owner}/${repo}' key for production tracker (proper repo scoping) (04-09)
- Pass undefined for codeGraph at setup time (requires files unavailable until PR load) (04-09)
- Wire trackers into both createComponents and createComponentsForCLI for consistency (04-09)
- Follow Plan 04-09 pattern for AcceptanceDetector wiring (05-01)
- Make acceptanceDetector optional field (CLI may lack full GitHub API access) (05-01)
- Wire into both production and CLI modes for testing parity (05-01)
- Call acceptance detection after loadSuppressed, before posting comments (optimal timing) (05-02)
- Use logger.debug for acceptance detection failures (normal flow, not exceptional) (05-02)
- Fetch PR commits with per_page: 100 to minimize API calls (05-02)
- Use octokit.paginate for review comments (handles large PR histories) (05-02)
- Extract provider from comment body pattern for acceptance attribution (05-02)

### Pending Todos

None yet.

### Blockers/Concerns

**Phase 1 (Core Formatting):**
- ✅ Resolved: Line number misalignment handled via modern GitHub API parameters (implemented in 01-03)

**Phase 3 (Multi-Line Support):**
- ✅ Resolved: Deletion-only files handled via isDeletionOnlyFile utility (implemented in 03-03)
- ✅ Resolved: Multi-line edge cases validated via comprehensive validation pipeline

**Phase 4 (Validation):**
- ✅ Resolved: Consensus algorithm implemented using AST comparison (04-05)

## Session Continuity

Last session: 2026-02-05
Stopped at: Completed 05-02-PLAN.md (Add acceptance detection orchestration)
Resume file: None

---

*All phases complete! 21 of 21 plans delivered. Multi-provider code review with bi-directional learning feedback loop operational.*
