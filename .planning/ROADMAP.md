# Roadmap: GitHub Commit Suggestions for Multi-Provider Code Review

## Overview

This roadmap delivers one-click commit suggestion functionality for the multi-provider code review GitHub Action. Starting from existing infrastructure (Finding.suggestion field, AST analysis, orchestration pipeline), we add suggestion formatting, extend LLM prompts to generate fixes, implement multi-line support, and layer on validation to ensure quality. Each phase builds on the previous, validating foundational capabilities before adding complexity.

## Phases

**Phase Numbering:**
- Integer phases (1, 2, 3, 4): Planned milestone work
- Decimal phases (e.g., 2.1, 2.2): Urgent insertions if needed

- [ ] **Phase 1: Core Suggestion Formatting** - GitHub markdown suggestion blocks with line accuracy
- [ ] **Phase 2: LLM Fix Generation Integration** - Extend prompts and parsers for end-to-end suggestions
- [ ] **Phase 3: Multi-Line and Advanced Formatting** - Multi-line suggestions with deletion handling
- [ ] **Phase 4: Validation and Quality** - Syntax validation, consensus fixes, learning integration

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

**Plans**: TBD

Plans:
- [ ] 01-01: TBD during planning

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

**Plans**: TBD

Plans:
- [ ] 02-01: TBD during planning

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

**Plans**: TBD

Plans:
- [ ] 03-01: TBD during planning

**Complexity**: HIGH
- **Research flag**: NEEDS DEEPER RESEARCH - Multi-line deletion edge cases need experimentation (community docs sparse)
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
5. Provider fix quality metrics are captured via existing analytics

**Plans**: TBD

Plans:
- [ ] 04-01: TBD during planning

**Complexity**: MEDIUM
- **Research flag**: NEEDS DESIGN DECISIONS - Consensus algorithm for code fixes is novel (no standard patterns)
- **Primary risk**: Hallucinated fixes from insufficient context (Pitfall #4) - mitigated by validation layers
- **Validation**: Measure fix correctness rates, track CI failures post-suggestion, validate consensus logic

---

## Non-Functional Requirements Coverage

**Performance (NFR-1.1, NFR-1.2)**: Addressed in Phase 2 via token counting and single-pass generation pattern

**Compatibility (NFR-2.1, NFR-2.2)**: Validated in Phase 2 across all providers, schema changes avoided

**Quality/Safety (NFR-3.1, NFR-3.2)**: Enforced in all phases via warnings, graceful error handling, fallback patterns

## Progress

**Execution Order:**
Phases execute sequentially: 1 → 2 → 3 → 4

| Phase | Requirements | Plans Complete | Status | Completed |
|-------|--------------|----------------|--------|-----------|
| 1. Core Formatting | FR-1.1, FR-1.2, FR-1.3 | 0/TBD | Not started | - |
| 2. LLM Integration | FR-2.1, FR-2.2, FR-2.3, FR-2.4 | 0/TBD | Not started | - |
| 3. Multi-Line Support | FR-3.1, FR-3.2, FR-3.3 | 0/TBD | Not started | - |
| 4. Validation & Quality | FR-4.1, FR-4.2, FR-4.3, FR-4.4 | 0/TBD | Not started | - |

## Coverage Validation

**Functional Requirements Mapped:** 14/14 ✓

| Requirement | Phase | Status |
|-------------|-------|--------|
| FR-1.1 (Single-line formatting) | 1 | Pending |
| FR-1.2 (Escaping) | 1 | Pending |
| FR-1.3 (Line accuracy) | 1 | Pending |
| FR-2.1 (Fix generation prompts) | 2 | Pending |
| FR-2.2 (Parse suggestion field) | 2 | Pending |
| FR-2.3 (Graceful degradation) | 2 | Pending |
| FR-2.4 (Token-aware context) | 2 | Pending |
| FR-3.1 (Multi-line suggestions) | 3 | Pending |
| FR-3.2 (Deletion handling) | 3 | Pending |
| FR-3.3 (Multi-line escaping) | 3 | Pending |
| FR-4.1 (Syntax validation) | 4 | Pending |
| FR-4.2 (Multi-provider consensus) | 4 | Pending |
| FR-4.3 (Context-aware fixes) | 4 | Pending |
| FR-4.4 (Learning from feedback) | 4 | Pending |

**Non-Functional Requirements:** Addressed across phases (see NFR Coverage section above)

**Orphaned Requirements:** None

**Out of Scope (Deferred):** Security auto-fixes, test-coverage-aware suggestions, batch optimization suggestions, auto-commit without review (per PROJECT.md and REQUIREMENTS.md)

---

*Roadmap created: 2026-02-04*
*Ready for phase planning: Phase 1*
