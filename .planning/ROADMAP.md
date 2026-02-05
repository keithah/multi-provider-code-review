# Roadmap: GitHub Commit Suggestions for Multi-Provider Code Review

## Overview

This roadmap delivers one-click commit suggestion functionality for the multi-provider code review GitHub Action. Starting from existing infrastructure (Finding.suggestion field, AST analysis, orchestration pipeline), we add suggestion formatting, extend LLM prompts to generate fixes, implement multi-line support, and layer on validation to ensure quality. Each phase builds on the previous, validating foundational capabilities before adding complexity.

## Phases

**Phase Numbering:**
- Integer phases (1, 2, 3, 4): Planned milestone work
- Decimal phases (e.g., 2.1, 2.2): Urgent insertions if needed

- [x] **Phase 1: Core Suggestion Formatting** - GitHub markdown suggestion blocks with line accuracy
- [x] **Phase 2: LLM Fix Generation Integration** - Extend prompts and parsers for end-to-end suggestions
- [x] **Phase 3: Multi-Line and Advanced Formatting** - Multi-line suggestions with deletion handling
- [x] **Phase 4: Validation and Quality** - Syntax validation, consensus fixes, learning integration
- [ ] **Phase 5: Complete Learning Feedback Loop** - Wire AcceptanceDetector for positive feedback tracking

## Phase Details

### Phase 1: Core Suggestion Formatting

**Goal**: Convert Finding.suggestion text to valid GitHub suggestion markdown blocks with accurate line mapping

**Depends on**: Nothing (foundation phase)

**Requirements**: FR-1.1 (Single-line formatting), FR-1.2 (Escaping), FR-1.3 (Line accuracy)

**Success Criteria** (what must be TRUE):
1. Single-line suggestion renders with "Commit suggestion" button in GitHub UI
2. Suggestions containing backticks render correctly without markdown conflicts
3. Suggestion blocks appear at correct diff line positions (no misalignment errors)
4. Invalid line numbers are rejected before posting (fail gracefully, not silently)

**Plans**: 3 plans

Plans:
- [x] 01-01-PLAN.md — TDD: Suggestion block formatter (formatSuggestionBlock, backtick escaping)
- [x] 01-02-PLAN.md — TDD: Suggestion line validator (validateSuggestionLine, diff integration)
- [x] 01-03-PLAN.md — Integration: Update formatters and comment poster to use suggestion utilities

**Complexity**: MEDIUM
- **Research flag**: Standard patterns (markdown formatting well-documented)
- **Primary risk**: Line number misalignment (Pitfall #1) - GitHub's modern `line`/`start_line` API must be used
- **Validation**: Test with mock Finding objects, verify GitHub UI rendering

---

### Phase 2: LLM Fix Generation Integration

**Goal**: Extend LLM pipeline to generate and extract fix suggestions during review pass

**Depends on**: Phase 1 (formatting must work before generating real fixes)

**Requirements**: FR-2.1 (Fix generation prompts), FR-2.2 (Parse suggestion field), FR-2.3 (Graceful degradation), FR-2.4 (Token-aware context)

**Success Criteria** (what must be TRUE):
1. All LLM providers (Claude, Gemini, OpenRouter, OpenCode, Codex) generate fix suggestions when finding issues
2. Parser successfully extracts Finding.suggestion field from LLM responses across all providers
3. When suggestion is unavailable or invalid, finding still posts without suggestion block (description-only fallback)
4. Context window truncation is prevented via token counting, respecting per-provider limits
5. End-to-end pipeline works: prompt -> LLM analysis -> parse -> format -> post to GitHub

**Plans**: 4 plans

Plans:
- [x] 02-01-PLAN.md — Extend PromptBuilder with fix generation instructions
- [x] 02-02-PLAN.md — TDD: Suggestion sanity validation function
- [x] 02-03-PLAN.md — Integrate suggestion validation into parser
- [x] 02-04-PLAN.md — Token-aware context management for suggestion skip

**Complexity**: HIGH
- **Research flag**: Standard patterns (LLM prompt extension follows existing codebase patterns)
- **Primary risk**: Context truncation causing hallucinated fixes (Pitfall #2) - requires token counting implementation
- **Validation**: Test with all providers, verify graceful degradation on missing suggestions

---

### Phase 3: Multi-Line and Advanced Formatting

**Goal**: Support suggestions spanning multiple consecutive lines with proper deletion handling

**Depends on**: Phase 2 (single-line end-to-end must work first)

**Requirements**: FR-3.1 (Multi-line suggestions), FR-3.2 (Deletion handling), FR-3.3 (Multi-line escaping)

**Success Criteria** (what must be TRUE):
1. Suggestions replacing 2+ consecutive lines render with commit buttons
2. All lines in suggestion range are validated to exist on RIGHT side of diff (new code)
3. Suggestions spanning deleted lines are rejected before posting
4. Multi-line suggestions containing backticks render correctly with proper escaping
5. GitHub's batch commit feature works for multiple multi-line suggestions in one review

**Plans**: 3 plans

Plans:
- [x] 03-01-PLAN.md — TDD: Multi-line range validation (validateSuggestionRange)
- [x] 03-02-PLAN.md — TDD: Hunk boundary detection (isRangeWithinSingleHunk)
- [x] 03-03-PLAN.md — Integration: Wire validation into CommentPoster with multi-line API support

**Complexity**: HIGH
- **Research flag**: Research complete - patterns established from GitHub API docs and community discussion
- **Primary risk**: Suggestions spanning deletions fail silently (Pitfall #5) - RIGHT-side-only validation critical
- **Validation**: Test with complex diff hunks (deletions, multiple non-contiguous hunks, first/last lines of file)

---

### Phase 4: Validation and Quality

**Goal**: Add syntax validation, multi-provider consensus, and learning feedback to improve fix reliability

**Depends on**: Phase 3 (core functionality complete before quality layers)

**Requirements**: FR-4.1 (Syntax validation), FR-4.2 (Multi-provider consensus), FR-4.3 (Context-aware fixes), FR-4.4 (Learning from feedback)

**Success Criteria** (what must be TRUE):
1. Suggested fixes are validated with tree-sitter before posting (syntax errors rejected)
2. Critical severity findings require multi-provider consensus before suggesting fixes (configurable threshold)
3. LLM prompts include project-specific context from existing code graph
4. Dismissed suggestions (with thumbs-down reactions) are tracked via learning system
5. Accepted suggestions (committed via "Commit suggestion" button or thumbs-up) are tracked for provider weight learning
6. Provider fix quality metrics are captured via existing analytics

**Plans**: 9 plans (8 core + 1 gap closure)

Plans:
- [x] 04-01-PLAN.md — TDD: Syntax validator (tree-sitter ERROR/MISSING node detection)
- [x] 04-02-PLAN.md — TDD: AST comparator (structural equivalence for consensus)
- [x] 04-03-PLAN.md — TDD: Confidence calculator (hybrid scoring with thresholds)
- [x] 04-04-PLAN.md — TDD: Suppression tracker + provider weight adjustment (dismissal learning)
- [x] 04-05-PLAN.md — Config schema + consensus integration (AST-based suggestion agreement, hasConsensus wiring)
- [x] 04-06-PLAN.md — Integration: Wire validation, consensus, code graph context into CommentPoster
- [x] 04-07-PLAN.md — Prompt enrichment with learned patterns (feedback-informed LLM prompts)
- [x] 04-08-PLAN.md — TDD: Acceptance detector (track committed suggestions for positive feedback)
- [x] 04-09-PLAN.md — Gap closure: Wire learning/validation trackers into setup.ts runtime

**Complexity**: MEDIUM
- **Research flag**: Research complete - tree-sitter patterns, AST comparison, confidence scoring established
- **Primary risk**: Hallucinated fixes from insufficient context (Pitfall #4) - mitigated by validation layers
- **Validation**: Measure fix correctness rates, track CI failures post-suggestion, validate consensus logic

---

### Phase 5: Complete Learning Feedback Loop

**Goal**: Wire AcceptanceDetector into runtime to enable positive feedback learning and complete the bi-directional weight adjustment system

**Depends on**: Phase 4 (AcceptanceDetector implementation exists, needs runtime integration)

**Requirements**: FR-4.4 completion (Learning from feedback - acceptance tracking component)

**Gap Closure**: Addresses tech debt from v1.0 audit (AcceptanceDetector orphaned, positive feedback loop incomplete)

**Success Criteria** (what must be TRUE):
1. AcceptanceDetector instantiated in setup.ts for both CLI and production modes
2. Orchestrator calls detectFromCommits() when PR updated
3. Orchestrator calls detectFromReactions() for comment reactions
4. Accepted suggestions feed ProviderWeightTracker to increase provider weights
5. Provider weights increase on acceptances, decrease on dismissals (bi-directional learning)
6. End-to-end acceptance tracking works: suggestion posted -> user accepts -> weight increases

**Plans**: 3 plans (2 core + 1 gap closure)

Plans:
- [x] 05-01-PLAN.md — Runtime wiring: Add AcceptanceDetector to setup.ts and ReviewComponents
- [x] 05-02-PLAN.md — Orchestration: Add acceptance detection to review execution flow
- [ ] 05-03-PLAN.md — Gap closure: Wire FeedbackFilter to record negative feedback to ProviderWeightTracker

**Complexity**: MEDIUM
- **Research flag**: Standard patterns (wiring follows existing setup.ts patterns from Phase 4)
- **Primary risk**: GitHub API rate limits on reaction fetching - mitigated by efficient comment-based polling
- **Validation**: Verify provider weights change on acceptance, test with mock PR data

---

## Non-Functional Requirements Coverage

**Performance (NFR-1.1, NFR-1.2)**: Addressed in Phase 2 via token counting and single-pass generation pattern

**Compatibility (NFR-2.1, NFR-2.2)**: Validated in Phase 2 across all providers, schema changes avoided

**Quality/Safety (NFR-3.1, NFR-3.2)**: Enforced in all phases via warnings, graceful error handling, fallback patterns

## Progress

**Execution Order:**
Phases execute sequentially: 1 -> 2 -> 3 -> 4 -> 5

| Phase | Requirements | Plans Complete | Status | Completed |
|-------|--------------|----------------|--------|-----------|
| 1. Core Formatting | FR-1.1, FR-1.2, FR-1.3 | 3/3 | Complete | 2026-02-05 |
| 2. LLM Integration | FR-2.1, FR-2.2, FR-2.3, FR-2.4 | 4/4 | Complete | 2026-02-05 |
| 3. Multi-Line Support | FR-3.1, FR-3.2, FR-3.3 | 3/3 | Complete | 2026-02-05 |
| 4. Validation & Quality | FR-4.1, FR-4.2, FR-4.3, FR-4.4 | 9/9 | Complete | 2026-02-05 |
| 5. Complete Feedback Loop | FR-4.4 (acceptance tracking) | 2/3 | Gap Closure | - |

## Coverage Validation

**Functional Requirements Mapped:** 14/14

| Requirement | Phase | Status |
|-------------|-------|--------|
| FR-1.1 (Single-line formatting) | 1 | Complete |
| FR-1.2 (Escaping) | 1 | Complete |
| FR-1.3 (Line accuracy) | 1 | Complete |
| FR-2.1 (Fix generation prompts) | 2 | Complete |
| FR-2.2 (Parse suggestion field) | 2 | Complete |
| FR-2.3 (Graceful degradation) | 2 | Complete |
| FR-2.4 (Token-aware context) | 2 | Complete |
| FR-3.1 (Multi-line suggestions) | 3 | Complete |
| FR-3.2 (Deletion handling) | 3 | Complete |
| FR-3.3 (Multi-line escaping) | 3 | Complete |
| FR-4.1 (Syntax validation) | 4 | Complete |
| FR-4.2 (Multi-provider consensus) | 4 | Complete |
| FR-4.3 (Context-aware fixes) | 4 | Complete |
| FR-4.4 (Learning from feedback) | 4 | Complete |

**Non-Functional Requirements:** Addressed across phases (see NFR Coverage section above)

**Orphaned Requirements:** None

**Out of Scope (Deferred):** Security auto-fixes, test-coverage-aware suggestions, batch optimization suggestions, auto-commit without review (per PROJECT.md and REQUIREMENTS.md)

---

*Roadmap created: 2026-02-04*
*Phase 1 planned: 2026-02-04*
*Phase 2 planned: 2026-02-05*
*Phase 3 planned: 2026-02-04*
*Phase 4 planned: 2026-02-04*
*Phase 4 revised: 2026-02-04 (iteration 1 - added plans 07, updated 04, 06)*
*Phase 4 revised: 2026-02-04 (iteration 2 - added plan 08, updated 05, 06 for hasConsensus wiring)*
*Phase 4 gap closure: 2026-02-05 (plan 09 - wire learning/validation into setup.ts)*
*Phase 5 added: 2026-02-05 (gap closure from v1.0 audit - complete AcceptanceDetector wiring)*
*Phase 5 planned: 2026-02-05 (2 plans in 2 waves)*
*Phase 5 gap closure: 2026-02-05 (plan 03 - wire FeedbackFilter to record negative feedback)*
