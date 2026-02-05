# Multi-Provider Code Review - Commit Suggestions

## What This Is

A GitHub Action that performs multi-provider AI code reviews and generates one-click fix suggestions. When the LLM detects issues in pull requests, it suggests fixes formatted as GitHub commit suggestion blocks, allowing developers to apply corrections with a single click instead of manual editing.

## Core Value

Reduce friction from issue detection to fix application - developers can resolve code review findings instantly by clicking "Commit suggestion" rather than context-switching to their editor.

## Requirements

### Validated

These capabilities already exist in the codebase:

- ✓ Multi-provider LLM code review (Claude, Gemini, OpenRouter, OpenCode, Codex) — existing
- ✓ Issue detection via hybrid AST + LLM analysis — existing
- ✓ Inline PR comment posting with severity levels — existing
- ✓ Finding deduplication and consensus filtering — existing
- ✓ Multi-line code context in findings — existing
- ✓ Markdown formatting for GitHub comments — existing
- ✓ Incremental review with caching — existing
- ✓ Batch orchestration with token-aware file grouping — existing

### Active

New capabilities to build for commit suggestions:

- [ ] Prompt LLMs to generate fix suggestions when finding issues
- [ ] Parse and validate fix suggestions from LLM responses
- [ ] Format fixes as GitHub suggestion blocks (```suggestion syntax)
- [ ] Handle single-line code replacement suggestions
- [ ] Handle multi-line code replacement suggestions
- [ ] Gracefully fallback to description-only when fix unavailable
- [ ] Include fix suggestions in existing comment formatting flow
- [ ] Preserve line number accuracy for suggestion placement

### Out of Scope

- Custom commit UI (use GitHub's native suggestion feature)
- Automatic fix application without user review
- Fix validation beyond basic syntax checking
- Changing core review orchestration logic
- Adding new providers or analysis methods

## Context

**Existing System:**
The multi-provider code review action uses an orchestration layer that coordinates LLM providers, AST analysis, caching, and GitHub integration. Findings flow through: detection → consensus → deduplication → filtering → formatting → posting.

**Technical Environment:**
- TypeScript GitHub Action
- Current formatters: MarkdownFormatter, MarkdownFormatterV2
- Output layer in `src/output/`
- LLM analysis in `src/analysis/llm/`
- Finding types defined in `src/types/`

**User Experience Goal:**
When a developer opens a PR and the action finds issues, they see inline comments with both the problem description AND a suggestion block showing the fix. They click "Commit suggestion" and the fix is applied immediately.

## Constraints

- **Compatibility**: Must work with all existing provider implementations (Claude, Gemini, OpenRouter, OpenCode, Codex)
- **Format**: Must use GitHub's exact suggestion block syntax for commit buttons to appear
- **Performance**: Fix generation should not significantly increase review time
- **Fallback**: System must still work when LLM can't generate valid fixes

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| Use GitHub's native suggestion syntax | Leverages built-in UI, no custom implementation needed | — Pending |
| Prompt LLMs for fixes during initial review | Single-pass is faster than two-phase (find, then fix) | — Pending |
| Fallback to description-only | Better to surface issue without fix than suppress finding | — Pending |

---
*Last updated: 2026-02-04 after initialization*
