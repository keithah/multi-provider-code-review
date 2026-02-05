# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-02-04)

**Core value:** Reduce friction from issue detection to fix application - developers can resolve code review findings instantly by clicking "Commit suggestion" rather than context-switching to their editor.

**Current focus:** Phase 4 - Validation and Quality

## Current Position

Phase: 4 of 4 (Validation and Quality)
Plan: 5 of 8 in current phase
Status: In progress
Last activity: 2026-02-04 — Completed 04-05-PLAN.md

Progress: [█████████████████] 83% (15 of 18 total plans)

## Performance Metrics

**Velocity:**
- Total plans completed: 15
- Average duration: 2.3 min
- Total execution time: 0.63 hours

**By Phase:**

| Phase | Plans | Total | Avg/Plan |
|-------|-------|-------|----------|
| 1 - Core Suggestion Formatting | 3/3 | 9 min | 3 min |
| 2 - LLM Fix Generation Integration | 4/4 | 10 min | 2.5 min |
| 3 - Multi-line and Advanced Formatting | 3/3 | 8 min | 2.7 min |
| 4 - Validation and Quality | 5/8 | 14 min | 2.8 min |

**Recent Trend:**
- Last 5 plans: 04-01 (2min), 04-02 (3min), 04-03 (3min), 04-04 (3min), 04-05 (3min)
- Trend: Excellent velocity, Phase 4 progressing well

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

### Pending Todos

None yet.

### Blockers/Concerns

**Phase 1 (Core Formatting):**
- ✅ Resolved: Line number misalignment handled via modern GitHub API parameters (implemented in 01-03)

**Phase 3 (Multi-Line Support):**
- ✅ Resolved: Deletion-only files handled via isDeletionOnlyFile utility (implemented in 03-03)
- ✅ Resolved: Multi-line edge cases validated via comprehensive validation pipeline

**Phase 4 (Validation):**
- Consensus algorithm for code fixes requires design decisions (no standard patterns)

## Session Continuity

Last session: 2026-02-04
Stopped at: Completed 04-05-PLAN.md (AST-based consensus for suggestions)
Resume file: None

---

*Next step: Phase 4 in progress (5 of 8 plans complete). Ready for 04-06-PLAN.md*
