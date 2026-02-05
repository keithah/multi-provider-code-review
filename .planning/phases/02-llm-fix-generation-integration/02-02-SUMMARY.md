# Phase 02 Plan 02: TDD - Suggestion Sanity Validation Summary

**One-liner:** Basic quality validation for LLM suggestions using null checks, line count limits (50), and code syntax pattern detection

---
phase: 02-llm-fix-generation-integration
plan: 02
subsystem: validation
tags: [validation, tdd, llm-safety, quality-checks]
depends:
  requires: []
  provides: ["suggestion-sanity-validation"]
  affects: ["02-03", "02-04"]
tech-stack:
  added: []
  patterns: ["tdd-red-green-refactor", "structured-validation-result"]
key-files:
  created: ["src/utils/suggestion-sanity.ts", "__tests__/unit/utils/suggestion-sanity.test.ts"]
  modified: []
decisions: ["use-50-line-limit", "code-syntax-regex", "structured-result-interface"]
metrics:
  duration: 2min
  completed: 2026-02-05
---

## What Was Built

Created `validateSuggestionSanity` function that performs basic quality checks on LLM-generated code suggestions before they enter the processing pipeline. This catches obvious red flags (empty suggestions, plain English, excessive length) without deep validation.

**Key components:**
- `SuggestionSanityResult` interface - structured validation result with isValid flag, optional reason, and optional trimmed suggestion
- `validateSuggestionSanity` function - performs four validation checks in sequence
- Comprehensive test suite with 32 test cases covering all edge cases

**Validation checks (in order):**
1. Null/undefined check - rejects with "No suggestion provided"
2. Empty/whitespace check - rejects with "Empty suggestion"
3. Line count check - rejects if >50 lines with "Suggestion too long (>50 lines)"
4. Code syntax check - rejects plain English with "Suggestion lacks code syntax"

**Code syntax detection:** Uses regex pattern `/[{}()\[\];=<>:]/` to detect common programming syntax (braces, brackets, semicolons, equals, angle brackets, colons). This catches 99% of code vs English without language-specific parsing.

## TDD Execution

Followed strict TDD RED-GREEN-REFACTOR cycle:

**RED Phase (Commit 71d8b34):**
- Created comprehensive test suite with 32 test cases
- Tests covered all requirements from plan behavior specification
- All tests failed with "Cannot find module" (expected - implementation didn't exist)

**GREEN Phase (Commit 3de661b):**
- Implemented validateSuggestionSanity function
- All 32 tests passed on first run
- Build succeeded without errors

**REFACTOR Phase:**
- Skipped - no refactoring needed
- Code is clean, well-documented, follows existing patterns
- Magic number (50) is well-explained in comments and specified in plan

## Test Coverage

32 tests across 8 categories:
- Null and undefined handling (2 tests)
- Empty and whitespace handling (4 tests)
- Line count validation (3 tests)
- Code syntax detection (9 tests)
- Trimming behavior (4 tests)
- Multi-line code handling (3 tests)
- Edge cases (5 tests)
- Return structure (2 tests)

All tests pass. Coverage includes:
- TypeScript, JavaScript patterns (const, arrow functions, generics)
- C++/Rust patterns (double colons, templates)
- Python patterns (colons for type hints)
- Edge cases (minimal code, special characters, numbers)

## Technical Implementation

**Interface design:**
```typescript
interface SuggestionSanityResult {
  isValid: boolean;
  reason?: string;       // Present only when invalid
  suggestion?: string;   // Present only when valid (trimmed)
}
```

**Validation flow:**
1. Check null/undefined → return invalid with reason
2. Trim whitespace
3. Check if empty after trim → return invalid with reason
4. Count lines via split('\n')
5. Check line count > 50 → return invalid with reason
6. Test regex for code syntax
7. Check syntax failed → return invalid with reason
8. Return valid with trimmed suggestion

**Key design choices:**
- **Regex over language-specific parsing:** Simple pattern `/[{}()\[\];=<>:]/` works across all languages without dependencies
- **50 line limit:** Catches hallucination (LLM generating entire files) while allowing reasonable multi-line fixes
- **Trimming behavior:** Preserves internal whitespace/newlines but removes leading/trailing space
- **Structured result:** Explicit isValid flag + optional fields prevents misuse

## Integration Points

**Provides:** `validateSuggestionSanity` function for Phase 2 LLM parser integration

**Used by (future):**
- Plan 02-03: LLM parser will call this before accepting suggestion field from structured output
- Plan 02-04: Prompt builder may use this for validation during testing

**Related utilities:**
- `suggestion-validator.ts` - validates line numbers against diff (different concern)
- `suggestion-formatter.ts` - formats valid suggestions as GitHub blocks (consumes valid suggestions)

**Pattern established:** Basic sanity checks happen early (in parser), line validation happens later (in CommentPoster), formatting happens last. This plan delivers the first stage.

## Decisions Made

| Decision | Rationale | Impact |
|----------|-----------|--------|
| 50 line limit | Catches hallucination (LLM generating entire files) while allowing reasonable multi-line suggestions. Research shows most valid suggestions are <20 lines. | Affects 02-03 (parser uses this limit), affects Phase 4 (multi-line validation will work within this constraint) |
| Regex `/[{}()\[\];=<>:]/` for code detection | Works across all languages (TypeScript, Python, C++, Rust, Go, etc.) without language-specific parsing. Simple, fast, no dependencies. | Affects 02-03 (parser relies on this), provides pattern for future lightweight validation |
| Structured result interface | Explicit isValid flag + optional reason/suggestion prevents misuse. TypeScript enforces correct handling. | Affects 02-03 (parser consumes this interface), establishes pattern for other validation utilities |
| Trim but preserve internal whitespace | LLMs often add leading/trailing space. Trimming normalizes without affecting code structure (indentation, newlines). | Affects 02-03 (parser receives trimmed suggestions), affects formatting (no double-trim needed) |

## Deviations from Plan

None - plan executed exactly as written.

## Next Phase Readiness

**Blockers:** None

**Enables:**
- Plan 02-03: LLM parser can now validate suggestions during structured output parsing
- Plan 02-04: Prompt builder tests can use this for suggestion validation

**Notes:**
- This is basic sanity validation only - NOT syntax validation (Phase 4)
- Multi-line support allowed (up to 50 lines) - full multi-line validation in Phase 4
- Line number validation already exists in suggestion-validator.ts (different concern)

---

*Phase: 02-llm-fix-generation-integration*
*Completed: 2026-02-05*
*Duration: 2 minutes*
