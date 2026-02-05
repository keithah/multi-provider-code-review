# Requirements

**Project:** GitHub Commit Suggestions for Multi-Provider Code Review
**Last Updated:** 2026-02-04
**Status:** Active Development

## Overview

This document categorizes requirements for adding one-click commit suggestion functionality to the multi-provider code review action. Requirements are organized by implementation phase based on component dependencies and complexity progression identified in research.

## Functional Requirements

### Phase 1: Core Suggestion Formatting

**FR-1.1: Single-Line Suggestion Formatting**
- **Description:** Format a single-line code fix as a GitHub suggestion block
- **Acceptance Criteria:**
  - Given `Finding.suggestion` text for a single line
  - When SuggestionFormatter processes it
  - Then output is valid ````suggestion` markdown block
  - And block renders with commit button in GitHub UI
- **Priority:** CRITICAL (table stakes)
- **Research:** SUMMARY.md Phase 1

**FR-1.2: Suggestion Block Escaping**
- **Description:** Prevent markdown conflicts when code contains backticks
- **Acceptance Criteria:**
  - Given suggestion text containing triple backticks
  - When formatter escapes content
  - Then uses 4+ backtick delimiters to prevent block termination
  - And rendered block is syntactically correct
- **Priority:** HIGH (pitfall prevention)
- **Research:** SUMMARY.md Pitfall #3

**FR-1.3: Line Number Accuracy**
- **Description:** Map finding line numbers to GitHub diff positions correctly
- **Acceptance Criteria:**
  - Given a finding with file path and line number
  - When formatter determines diff position
  - Then uses GitHub's `line`/`start_line` API parameters (not deprecated `position`)
  - And validates line exists on RIGHT side of diff
- **Priority:** CRITICAL (primary failure mode)
- **Research:** SUMMARY.md Pitfall #1

### Phase 2: LLM Fix Generation Integration

**FR-2.1: Fix Generation in Prompts**
- **Description:** Extend LLM prompts to request fix suggestions
- **Acceptance Criteria:**
  - Given PromptBuilder creating review prompt
  - When building prompt for any provider
  - Then includes fix generation instructions uniformly
  - And provides sufficient context for accurate fixes
- **Priority:** CRITICAL (core feature)
- **Research:** SUMMARY.md Phase 2

**FR-2.2: Parse Suggestion Field from LLM**
- **Description:** Extract `suggestion` field from LLM responses
- **Acceptance Criteria:**
  - Given LLM response with finding and optional suggestion
  - When parser processes response
  - Then extracts `Finding.suggestion` when present
  - And handles missing suggestions gracefully (no error)
- **Priority:** CRITICAL (core feature)
- **Research:** SUMMARY.md Phase 2

**FR-2.3: Graceful Degradation**
- **Description:** Fallback to description-only when fix unavailable
- **Acceptance Criteria:**
  - Given finding with no valid suggestion
  - When formatting comment
  - Then posts finding without suggestion block
  - And does NOT suppress the finding
- **Priority:** HIGH (user experience)
- **Research:** PROJECT.md Key Decisions

**FR-2.4: Token-Aware Context**
- **Description:** Prevent context truncation causing hallucinated fixes
- **Acceptance Criteria:**
  - Given file content for LLM prompt
  - When building context
  - Then implements token counting before prompt
  - And prioritizes essential context (changed lines + function signature + imports)
  - And respects per-provider limits (Claude: 200k, GPT-4: 128k, Gemini: 1M)
- **Priority:** HIGH (pitfall prevention)
- **Research:** SUMMARY.md Pitfall #2

### Phase 3: Multi-Line and Advanced Formatting

**FR-3.1: Multi-Line Suggestions**
- **Description:** Support suggestions spanning multiple lines
- **Acceptance Criteria:**
  - Given suggestion replacing 2+ consecutive lines
  - When formatter creates block
  - Then uses `start_line` and `line` range parameters
  - And validates all lines in range exist on RIGHT side of diff
- **Priority:** CRITICAL (table stakes)
- **Research:** SUMMARY.md Phase 3

**FR-3.2: Deletion Handling**
- **Description:** Prevent suggestions spanning deleted lines
- **Acceptance Criteria:**
  - Given diff with deletions
  - When validating suggestion line range
  - Then confirms all lines exist on RIGHT side only
  - And rejects suggestions spanning LEFT-side deletions
- **Priority:** CRITICAL (critical failure mode)
- **Research:** SUMMARY.md Pitfall #5

**FR-3.3: Multi-Line Escaping**
- **Description:** Handle backtick conflicts in multi-line suggestions
- **Acceptance Criteria:**
  - Given multi-line suggestion with embedded backticks
  - When formatter escapes content
  - Then applies escaping rules to all lines
  - And delimiter count exceeds max backticks in content
- **Priority:** HIGH (rendering correctness)
- **Research:** SUMMARY.md Phase 3

### Phase 4: Validation and Quality

**FR-4.1: Syntax Validation**
- **Description:** Validate suggested fixes are syntactically correct
- **Acceptance Criteria:**
  - Given suggestion for a code file
  - When validating before posting
  - Then parses with tree-sitter for target language
  - And rejects suggestions causing parse errors
- **Priority:** MEDIUM (quality improvement)
- **Research:** SUMMARY.md Phase 4

**FR-4.2: Multi-Provider Consensus Fixes**
- **Description:** Require consensus for critical severity fixes
- **Acceptance Criteria:**
  - Given critical finding with suggestions from multiple providers
  - When synthesizing final suggestion
  - Then requires minimum agreement threshold (configurable)
  - And selects consensus fix or falls back to description-only
- **Priority:** MEDIUM (differentiator)
- **Research:** SUMMARY.md Phase 4, needs design decisions

**FR-4.3: Context-Aware Fixes**
- **Description:** Leverage AST and code graph for smarter suggestions
- **Acceptance Criteria:**
  - Given finding in function with dependencies
  - When building LLM prompt
  - Then includes relevant call context from existing code graph
  - And provides project-specific guidelines if available
- **Priority:** LOW (enhancement)
- **Research:** SUMMARY.md Phase 4

**FR-4.4: Learning from Feedback**
- **Description:** Track dismissed suggestions to improve quality
- **Acceptance Criteria:**
  - Given suggestion with 👎 reaction in GitHub
  - When learning system processes feedback
  - Then records provider + suggestion + dismissal reason
  - And influences future fix generation (via existing learning system)
- **Priority:** LOW (continuous improvement)
- **Research:** SUMMARY.md differentiators

## Non-Functional Requirements

### NFR-1: Performance

**NFR-1.1: Review Time Impact**
- **Description:** Fix generation should not significantly increase review time
- **Acceptance Criteria:**
  - Given PR review with 50 findings
  - When generating suggestions
  - Then review completes within 120% of current baseline
- **Priority:** HIGH
- **Research:** PROJECT.md Constraints

**NFR-1.2: Token Budget Enforcement**
- **Description:** Respect existing cost tracking and budget limits
- **Acceptance Criteria:**
  - Given configured budget limit
  - When fix generation increases token usage
  - Then CostTracker enforces limits as currently designed
  - And gracefully degrades (no suggestions) when budget exceeded
- **Priority:** MEDIUM
- **Research:** Existing CostTracker in codebase

### NFR-2: Compatibility

**NFR-2.1: Provider Compatibility**
- **Description:** Work with all existing LLM providers
- **Acceptance Criteria:**
  - Given any configured provider (Claude, Gemini, OpenRouter, OpenCode, Codex)
  - When requesting fix suggestions
  - Then provider returns suggestions in parseable format
  - And parser handles provider-specific variations
- **Priority:** CRITICAL
- **Research:** PROJECT.md Constraints

**NFR-2.2: Existing Workflow Preservation**
- **Description:** Do not break current review functionality
- **Acceptance Criteria:**
  - Given existing review configuration without suggestions enabled
  - When running review
  - Then all current features work identically
  - And no schema-breaking changes to Finding type
- **Priority:** CRITICAL
- **Research:** PROJECT.md Out of Scope

### NFR-3: Quality and Safety

**NFR-3.1: User Review Enforcement**
- **Description:** Prevent auto-commit without user review
- **Acceptance Criteria:**
  - Given any suggestion posted
  - When user interacts
  - Then commit requires explicit click action
  - And warnings indicate review necessity ("⚠️ Review before applying")
- **Priority:** CRITICAL (security)
- **Research:** SUMMARY.md Pitfall #6, Anti-Features

**NFR-3.2: Error Handling**
- **Description:** Handle suggestion failures gracefully
- **Acceptance Criteria:**
  - Given any suggestion generation/formatting error
  - When error occurs
  - Then logs error with context (file, line, provider)
  - And falls back to description-only finding
  - And does NOT crash review process
- **Priority:** HIGH
- **Research:** Existing error handling patterns

## Out of Scope

These items are explicitly excluded from current implementation:

- **Custom commit UI:** Use GitHub's native suggestion feature (no custom rendering)
- **Automatic fix application:** No auto-commit without user review (security violation)
- **Semantic fix validation:** Beyond syntax checking (requires extensive test framework)
- **Core orchestration changes:** Build on existing pipeline without rewrites
- **New providers:** Focus on suggestion feature, not provider expansion
- **Security-focused auto-fixes:** Requires high trust framework (defer to v2+)
- **Test-coverage-aware suggestions:** Complex integration (defer to v2+)
- **Batch optimization suggestions:** Low ROI initially (defer to v2+)

**Source:** PROJECT.md Out of Scope, SUMMARY.md Defer (v2+)

## Dependencies and Constraints

### Technical Dependencies

- **GitHub REST API v3+:** Pull request comment API with suggestion support
- **Tree-sitter 0.21.x:** Syntax validation (already in codebase)
- **Zod 3.23.x:** Schema validation (already in codebase)
- **jsdiff 8.0.x:** NEW dependency for diff validation

### Architecture Constraints

- **Finding.suggestion field:** Already exists in type system, no schema changes needed
- **Single-pass generation:** Embed in existing review flow, not separate phase
- **Format-time assembly:** Access full file content during markdown generation
- **Additive changes only:** Extend 3 files (PromptBuilder, Parser, SynthesisEngine) + add 1 utility

**Source:** SUMMARY.md Stack, Architecture

## Research Flags

### Needs Deeper Research During Planning

- **Phase 3 - Multi-line deletion edge cases:** GitHub's behavior with complex diff hunks needs experimentation
- **Phase 4 - Consensus algorithm:** No standard pattern for multi-provider code consensus, requires design decisions

### Standard Patterns (Skip Research)

- **Phase 1 - Markdown formatting:** Well-documented via GitHub community
- **Phase 2 - LLM prompt extension:** Follows existing codebase patterns

**Source:** SUMMARY.md Research Flags

## Acceptance Criteria Summary

**Phase 1 Complete When:**
- Single-line suggestions render with commit buttons
- Backtick escaping prevents markdown conflicts
- Line numbers map to diff positions correctly

**Phase 2 Complete When:**
- All providers generate fix suggestions
- Parser extracts suggestions from LLM responses
- Graceful fallback works when suggestions unavailable
- Context truncation prevented via token counting

**Phase 3 Complete When:**
- Multi-line suggestions work reliably
- Deletion handling prevents invalid suggestions
- All escaping works for multi-line blocks

**Phase 4 Complete When:**
- Tree-sitter validates syntax before posting
- Multi-provider consensus implemented for critical fixes
- Learning system tracks dismissed suggestions

## Traceability

| Requirement | Source | Phase | Status |
|-------------|--------|-------|--------|
| FR-1.1 | PROJECT.md Active #4, SUMMARY.md Table Stakes | 1 | Complete |
| FR-1.2 | SUMMARY.md Pitfall #3 | 1 | Complete |
| FR-1.3 | SUMMARY.md Pitfall #1 | 1 | Complete |
| FR-2.1 | PROJECT.md Active #1, SUMMARY.md Phase 2 | 2 | Complete |
| FR-2.2 | PROJECT.md Active #2, SUMMARY.md Phase 2 | 2 | Complete |
| FR-2.3 | PROJECT.md Active #6, Key Decisions | 2 | Complete |
| FR-2.4 | SUMMARY.md Pitfall #2 | 2 | Complete |
| FR-3.1 | PROJECT.md Active #5, SUMMARY.md Table Stakes | 3 | Complete |
| FR-3.2 | SUMMARY.md Pitfall #5 | 3 | Complete |
| FR-3.3 | SUMMARY.md Phase 3 | 3 | Complete |
| FR-4.1 | SUMMARY.md Phase 4 | 4 | Pending |
| FR-4.2 | SUMMARY.md Differentiators | 4 | Pending |
| FR-4.3 | SUMMARY.md Differentiators | 4 | Pending |
| FR-4.4 | SUMMARY.md Differentiators | 4 | Pending |

---

*Requirements defined: 2026-02-04*
*Roadmap created: 2026-02-04*
*Ready for phase planning: yes*
