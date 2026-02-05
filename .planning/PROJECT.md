# Multi-Provider Code Review - Commit Suggestions

## What This Is

A GitHub Action that performs multi-provider AI code reviews and generates one-click fix suggestions. When the LLM detects issues in pull requests, it suggests fixes formatted as GitHub commit suggestion blocks, allowing developers to apply corrections with a single click instead of manual editing.

## Core Value

Reduce friction from issue detection to fix application - developers can resolve code review findings instantly by clicking "Commit suggestion" rather than context-switching to their editor.

## Requirements

### Validated

These capabilities now exist in the codebase:

- ✓ Multi-provider LLM code review (Claude, Gemini, OpenRouter, OpenCode, Codex) — pre-v0.5
- ✓ Issue detection via hybrid AST + LLM analysis — pre-v0.5
- ✓ Inline PR comment posting with severity levels — pre-v0.5
- ✓ Finding deduplication and consensus filtering — pre-v0.5
- ✓ Multi-line code context in findings — pre-v0.5
- ✓ Markdown formatting for GitHub comments — pre-v0.5
- ✓ Incremental review with caching — pre-v0.5
- ✓ Batch orchestration with token-aware file grouping — pre-v0.5
- ✓ Prompt LLMs to generate fix suggestions when finding issues — v0.5
- ✓ Parse and validate fix suggestions from LLM responses — v0.5
- ✓ Format fixes as GitHub suggestion blocks (```suggestion syntax) — v0.5
- ✓ Handle single-line code replacement suggestions — v0.5
- ✓ Handle multi-line code replacement suggestions — v0.5
- ✓ Gracefully fallback to description-only when fix unavailable — v0.5
- ✓ Include fix suggestions in existing comment formatting flow — v0.5
- ✓ Preserve line number accuracy for suggestion placement — v0.5
- ✓ Syntax validation via tree-sitter before posting suggestions — v0.5
- ✓ Multi-provider consensus for critical severity fixes — v0.5
- ✓ Bi-directional learning from acceptances and dismissals — v0.5

### Active

Next milestone (v1.0):

- [ ] Wire path-based intensity into review behavior (provider counts, timeouts, prompt depth)
- [ ] Configure intensity mappings per level (thorough/standard/light)
- [ ] Validate intensity affects actual review execution
- [ ] Test with different file path patterns

### Out of Scope

- Custom commit UI (use GitHub's native suggestion feature)
- Automatic fix application without user review
- Fix validation beyond basic syntax checking
- Changing core review orchestration logic
- Adding new providers or analysis methods

## Context

**Current State (v0.5):**
Shipped one-click commit suggestion functionality. All 5 LLM providers generate fix suggestions with token-aware context management. Complete validation pipeline includes syntax checking, multi-provider consensus, and bi-directional learning from user feedback.

**Codebase:**
- 20,397 lines of TypeScript
- Key modules: suggestion formatting (src/utils/), validation (src/validation/), learning (src/learning/), output pipeline (src/output/), LLM integration (src/analysis/llm/)
- GitHub Action with multi-provider orchestration
- Tech stack: tree-sitter (syntax validation), zod (schema validation), jsdiff (diff parsing)

**User Experience (v0.5):**
When a developer opens a PR, the action posts inline comments with both problem descriptions AND commit suggestion blocks. Developers click "Commit suggestion" to apply fixes instantly. Invalid suggestions gracefully degrade to description-only. System learns from thumbs-up (acceptance) and thumbs-down (dismissal) reactions to improve provider weighting over time.

**Known Issues/Tech Debt:**
- CodeGraph cannot be injected at setup time (requires FileChange[] only available during orchestration)
- Human verification pending for GitHub UI rendering of suggestion buttons (code correct, UI test needed)

## Constraints

- **Compatibility**: Must work with all existing provider implementations (Claude, Gemini, OpenRouter, OpenCode, Codex)
- **Format**: Must use GitHub's exact suggestion block syntax for commit buttons to appear
- **Performance**: Fix generation should not significantly increase review time
- **Fallback**: System must still work when LLM can't generate valid fixes

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| Use GitHub's native suggestion syntax | Leverages built-in UI, no custom implementation needed | ✓ Good - Clean integration, no custom rendering |
| Prompt LLMs for fixes during initial review | Single-pass is faster than two-phase (find, then fix) | ✓ Good - Minimal latency impact (<20% increase) |
| Fallback to description-only | Better to surface issue without fix than suppress finding | ✓ Good - Graceful degradation works well |
| 50k token threshold for skipping suggestions | Conservative enough for safety, simple to understand | ✓ Good - Prevents hallucination in large diffs |
| Validate suggestions in CommentPoster vs formatters | Formatters lack diff context; CommentPoster has patches | ✓ Good - Right separation of concerns |
| Use tree-sitter for syntax validation | Already in codebase, fast, language-agnostic | ✓ Good - Catches syntax errors before posting |
| AST-based consensus for multi-provider fixes | Structural equivalence more robust than string matching | ✓ Good - Handles formatting variations |
| Bi-directional learning (acceptances + dismissals) | Both signals needed for accurate quality measurement | ✓ Good - Complete feedback loop |
| Optional providerWeightTracker injection | Backward compatibility for CLI mode | ✓ Good - No breaking changes |

## Current Milestone: v1.0 Path-Based Intensity

**Goal:** Complete the path-based intensity feature by wiring file path patterns into review behavior controls (provider selection, timeouts, prompt depth).

**Target capabilities:**
- Adjust number of providers based on file importance (e.g., 8 for critical paths, 3 for docs)
- Configure per-intensity timeouts and prompt detail levels
- Validate intensity determines actual review execution, not just logging

---
*Last updated: 2026-02-05 after v1.0 milestone started*
