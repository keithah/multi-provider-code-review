# Project Research Summary

**Project:** GitHub Commit Suggestions for Multi-Provider Code Review
**Domain:** Code review automation with AI-generated inline fixes
**Researched:** 2026-02-04
**Confidence:** HIGH

## Executive Summary

This project extends an existing multi-provider code review GitHub Action to generate one-click commit suggestions for detected issues. Experts build this by embedding fix generation into the LLM review pass (not as a separate phase), formatting fixes as GitHub's native ````suggestion` markdown blocks, and validating through three layers: schema validation (Zod), syntax validation (tree-sitter), and diff validation (jsdiff). The recommended approach leverages existing infrastructure—the `Finding.suggestion` field already exists in the codebase, AST analysis and code graph capabilities are present, and the orchestration pipeline just needs formatting extensions.

The primary risk is line number misalignment between findings and GitHub's diff position API, which causes suggestions to fail silently or apply to wrong lines. This is mitigated by using GitHub's modern `line`/`start_line` parameters (not deprecated `position`), validating all lines exist on the RIGHT side of diffs (especially critical for multi-line suggestions spanning deletions), and testing with edge cases. Secondary risks include context window truncation causing hallucinated fixes (prevented by token counting and graceful degradation) and markdown syntax conflicts when code contains backticks (prevented by increased delimiter escaping). The codebase already has most foundational pieces—the key work is extending prompt templates, parsers, and formatters to generate and display suggestion blocks.

## Key Findings

### Recommended Stack

The stack is largely already present in the codebase. Core additions are focused on formatting and validation utilities, not new frameworks.

**Core technologies:**
- **GitHub REST API (v3+)**: Creating PR review comments with suggestion blocks — already integrated via @octokit/rest, just needs markdown formatting extensions
- **Tree-sitter (0.21.x)**: Syntax validation of LLM-generated fixes before posting — already in codebase for AST analysis, extend for fix validation
- **Zod (3.23.x)**: Runtime validation of LLM outputs — already in use, extend schema to parse `suggestion` field from responses
- **jsdiff (8.0.x)**: Diff generation and line number validation — NEW dependency for validating suggestions apply cleanly to target lines

**Critical constraint:** GitHub suggestion blocks use triple backticks as delimiters. When suggested code contains backticks, use 4+ backtick delimiters to prevent premature block termination. The specification is MEDIUM confidence (documented through community discussions and changelog, not formal spec).

### Expected Features

Based on competitive analysis (CodeRabbit, Qodo, ReviewDog) and GitHub's native capabilities, the feature landscape is clear.

**Must have (table stakes):**
- Single-line and multi-line code replacement suggestions — GitHub native feature since 2018/2020, users expect this
- One-click commit via GitHub UI — core value proposition, GitHub handles UI automatically
- Graceful fallback to description-only — when fix can't be generated, still show the finding
- Line number accuracy preservation — suggestions must map to exact diff line positions
- Basic suggestion validation — prevent malformed syntax from breaking GitHub rendering

**Should have (competitive differentiators):**
- Multi-provider consensus fixes — unique among AI reviewers, combine outputs for higher confidence
- Context-aware fixes using existing AST/code graph — leverage current infrastructure for smarter suggestions
- Learning from dismissed suggestions — track 👎 reactions to improve fix quality over time
- Provider fix quality tracking — measure which LLMs generate best fixes via existing analytics
- Incremental fix suggestions — only new fixes on PR updates, reuse incremental review cache

**Defer (v2+):**
- Security-focused auto-fixes — requires high trust and extensive validation framework
- Test-coverage-aware suggestions — add when test integration is mature
- Batch optimization suggestions — complex semantic analysis, low ROI initially
- ANTI-FEATURE: Auto-commit without review — breaks trust, violates security best practices (all research agrees)

### Architecture Approach

The architecture follows a **single-pass fix generation** pattern embedded in the existing review pipeline. Fix generation happens during the initial LLM analysis (not a separate phase), suggestions are formatted during markdown generation (format-time assembly), and the system gracefully degrades when fixes can't be generated.

**Major components:**
1. **PromptBuilder (EXTEND)** — Add fix generation instructions to LLM prompt templates, ensuring all providers request fixes uniformly
2. **LLM Parser (EXTEND)** — Parse `suggestion` field from LLM responses, handle missing/malformed suggestions gracefully
3. **SuggestionFormatter (NEW)** — Convert `Finding.suggestion` text to GitHub ````suggestion` markdown blocks with proper escaping and line context
4. **SynthesisEngine (EXTEND)** — Call SuggestionFormatter when `Finding.suggestion` exists, embed formatted blocks in comment bodies
5. **MarkdownFormatter (EXTEND)** — Include suggestion blocks in final markdown output passed to CommentPoster

The data flow: PR Diff → PromptBuilder (adds fix instructions) → LLM Providers (analyze + generate fixes) → Parser (extracts findings with suggestions) → SynthesisEngine (formats suggestion blocks) → MarkdownFormatter (embeds in markdown) → CommentPoster (posts to GitHub) → GitHub UI (renders commit button).

**Key architectural decision:** Format-time suggestion assembly allows access to full file content for extracting original code context, which is essential for multi-line suggestions. The `Finding.suggestion` field already exists in the type system—no schema changes needed.

### Critical Pitfalls

The research identified six critical pitfalls with clear prevention strategies:

1. **Line Number Misalignment from Diff Position Mapping** — GitHub suggestions require exact line numbers matching diff positions. Prevention: Use modern `line`/`start_line` API parameters (not deprecated `position`), parse diff hunk headers bidirectionally, validate all lines exist in diff. This is the #1 failure mode—without correct mapping, no suggestions work reliably.

2. **Context Window Truncation Causing Incorrect Fixes** — LLMs generate semantically wrong fixes when context is truncated mid-file. Prevention: Implement token counting before prompts, prioritize essential context (changed lines + function signature + imports), degrade gracefully on truncation errors. Set per-provider limits (Claude: 200k, GPT-4: 128k, Gemini: 1M).

3. **Markdown Syntax Conflicts in Suggestion Blocks** — Code containing backticks breaks suggestion block delimiters, rendering as plain text instead of actionable buttons. Prevention: Post-process fixes to escape characters, use increased backtick delimiters (4+) when content has triple backticks, validate block syntax before posting.

4. **Hallucinated Fixes from Insufficient Context** — Research shows 68.50% correctness rate (GPT-4o) and 54.26% (Gemini 2.0 Flash) due to "context misalignment." Prevention: Include project-specific context (guidelines, dependencies), leverage existing code graph for call context, add syntax validation with tree-sitter, require multi-provider consensus for critical issues.

5. **Multi-Line Suggestions with Deleted Lines** — GitHub suggestions only work on RIGHT side (new code), fail when spanning deletions. Prevention: Separate deleted vs added lines during diff parsing, only use RIGHT side line numbers for suggestions, validate all lines in range exist on RIGHT side.

6. **Untested Fixes Applied by Users** — One-click convenience bypasses review discipline; CodeRabbit 2025 report shows AI code creates 1.7x more issues with 40% containing security flaws. Prevention: Add clear warnings ("⚠️ Review before applying"), include test scenarios in fix comments, never auto-suggest for critical severity without validation, track fix-induced CI failures via learning system.

## Implications for Roadmap

Based on research, the natural phase structure follows component dependencies and complexity progression. All phases build on existing infrastructure—this is an extension, not a rewrite.

### Phase 1: Core Suggestion Formatting
**Rationale:** Foundation must work before adding LLM integration. Can test formatting in isolation with mock data.
**Delivers:** SuggestionFormatter that converts Finding.suggestion text to valid GitHub markdown blocks
**Addresses:** Single-line suggestions (table stakes), basic validation, line accuracy preservation
**Avoids:** Markdown syntax conflicts (via escaping logic), line misalignment (via proper parsing)

### Phase 2: LLM Fix Generation Integration
**Rationale:** Now that formatting works, extend LLM pipeline to generate fixes during analysis pass.
**Delivers:** Prompts that request fixes, parsers that extract suggestion fields, end-to-end pipeline
**Uses:** Zod for schema validation, existing LLM executor infrastructure
**Addresses:** Single-pass generation pattern, graceful degradation when fixes fail
**Avoids:** Context truncation (via token counting), two-phase generation anti-pattern

### Phase 3: Multi-Line and Advanced Formatting
**Rationale:** After single-line works reliably, add complexity of multi-line suggestions.
**Delivers:** Multi-line suggestion support with proper line range validation
**Implements:** RIGHT-side-only validation, deletion handling, multi-line escaping
**Addresses:** Multi-line suggestions (table stakes), batch apply support (GitHub native)
**Avoids:** Suggestions spanning deletions (critical failure mode), boundary validation gaps

### Phase 4: Validation and Quality
**Rationale:** With core functionality complete, add layers that improve fix quality and reliability.
**Delivers:** Tree-sitter syntax validation, multi-provider consensus for critical issues, learning feedback integration
**Uses:** Existing AST analysis, code graph, learning system
**Addresses:** Context-aware fixes (differentiator), provider quality tracking (differentiator), learning from feedback
**Avoids:** Hallucinated fixes (via validation), untested fixes applied (via warnings and tracking)

### Phase Ordering Rationale

- **Phase 1 before 2:** Formatting must work correctly before generating real fixes from LLMs—allows isolated testing with mock data
- **Phase 2 before 3:** Get single-line end-to-end pipeline working before adding multi-line complexity—validates architecture
- **Phase 3 before 4:** Multi-line is table stakes for launch; quality improvements are iterative enhancements
- **Phase 4 leverages existing:** Quality phase reuses AST analysis, code graph, and learning system already in codebase—minimal new infrastructure

This ordering minimizes risk by validating each layer works before building on it, matches architecture's natural component dependencies (formatter → parser → synthesis), and front-loads table stakes features while deferring differentiators.

### Research Flags

**Needs deeper research during planning:**
- **Phase 3 (Multi-line):** GitHub's multi-line suggestion API has edge cases around deletion handling that need experimentation. Community docs are sparse—may need trial-and-error validation.
- **Phase 4 (Consensus):** Consensus algorithm for code fixes (vs issues) is novel—no standard patterns found in research. Will require design decisions during planning.

**Standard patterns (skip research-phase):**
- **Phase 1:** Markdown formatting is well-documented, GitHub suggestion syntax is clear from community sources
- **Phase 2:** LLM prompt extension follows established patterns already in codebase (prompt-builder, parser, executor)

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| Stack | HIGH | Core technologies already in codebase; only jsdiff is new dependency with 14M+ weekly downloads |
| Features | HIGH | Table stakes verified via GitHub official docs; competitive analysis clear from CodeRabbit/Qodo/ReviewDog |
| Architecture | HIGH | Builds on existing codebase patterns; Finding.suggestion already exists; components identified through code inspection |
| Pitfalls | HIGH | Line misalignment and context truncation validated through official GitHub API docs and academic papers (HalluJudge, LLM evaluation studies) |

**Overall confidence:** HIGH

Research is backed by official GitHub documentation, existing codebase analysis, academic studies on LLM correctness rates, and competitive product analysis. The project has clear implementation patterns and well-understood failure modes.

### Gaps to Address

While confidence is high, several areas need validation during implementation:

- **Multi-line deletion edge cases:** GitHub's behavior when suggestions span complex diff hunks needs experimentation—docs are incomplete
- **Provider-specific fix formats:** Each LLM may format suggestions differently—parser needs to handle variations discovered during testing
- **Line number mapping corner cases:** First/last line of file, hunks with only deletions, multiple non-contiguous hunks—test coverage must be comprehensive
- **Performance at scale:** File content caching strategy for >50 findings per PR needs design decisions based on actual performance data
- **Consensus algorithm:** No standard pattern for multi-provider code consensus—design choices needed during planning

These gaps are implementation details, not architectural unknowns. Address through incremental testing and validation during each phase.

## Sources

### Primary (HIGH confidence)
- [GitHub REST API - Pull Request Comments](https://docs.github.com/en/rest/pulls/comments) — Official API specification for creating suggestions
- [GitHub Changelog - Multi-line Code Suggestions](https://github.blog/changelog/2020-04-15-multi-line-code-suggestions-general-availability/) — Feature announcement and constraints
- [Zod Documentation](https://zod.dev/) — Official schema validation library
- [jsdiff npm package](https://www.npmjs.com/package/diff) — Diff generation and validation
- [Tree-sitter TypeScript grammar](https://github.com/tree-sitter/tree-sitter-typescript) — AST parsing for syntax validation
- [HalluJudge: Hallucination Detection for Code Review](https://arxiv.org/html/2601.19072) — Context misalignment research
- [Evaluating Large Language Models for Code Review](https://arxiv.org/html/2505.20206v1) — LLM correctness rates (68.50% GPT-4o, 63.89% Gemini)
- Existing codebase inspection — Finding.suggestion field, orchestrator flow, formatter patterns

### Secondary (MEDIUM confidence)
- [Addy Osmani - LLM Coding Workflow 2026](https://addyosmani.com/blog/ai-coding-workflow/) — Prompting best practices
- [CodeRabbit State of AI vs Human Code Report 2025](https://www.coderabbit.ai/blog/state-of-ai-vs-human-code-generation-report) — AI code quality (1.7x more issues)
- [GitHub Community Discussion #76840](https://github.com/orgs/community/discussions/76840) — Nested backtick handling
- [GitHub Community Discussion #114597](https://github.com/orgs/community/discussions/114597) — Multi-line deletion limitations
- [Reviewdog](https://github.com/reviewdog/reviewdog) — Reference implementation patterns
- [CodeRabbit](https://www.coderabbit.ai/), [Qodo](https://www.qodo.ai/blog/best-automated-code-review-tools-2026/) — Competitive feature analysis

### Tertiary (LOW confidence)
- [Graphite Guides](https://graphite.com/guides/suggest-changes-github-pr) — Community tutorial on suggestion syntax
- Web search results for GitHub suggestion specification — Lacks formal spec beyond UI documentation

---
*Research completed: 2026-02-04*
*Ready for roadmap: yes*
