# Phase 1: Core Suggestion Formatting - Research

**Researched:** 2026-02-04
**Domain:** GitHub suggestion block markdown formatting and diff line mapping
**Confidence:** HIGH

## Summary

Phase 1 establishes the foundation for commit suggestions by implementing the formatter that converts `Finding.suggestion` text into valid GitHub suggestion markdown blocks. The standard approach is to use GitHub's native ````suggestion` fence syntax with proper backtick escaping and map findings to diff positions using GitHub's modern `line`/`start_line` API parameters (not deprecated `position`). The codebase already contains diff parsing utilities (`mapLinesToPositions` in `src/utils/diff.ts`) that handle the critical line-to-position mapping—Phase 1 extends these with validation and escaping logic.

The primary risk is line number misalignment causing suggestions to fail silently or appear on wrong lines. This is mitigated by validating that target lines exist on the RIGHT side of the diff (added/modified lines only) and using GitHub's current API parameters rather than the deprecated position-based approach. Secondary risks include markdown syntax conflicts when suggested code contains backticks (prevented by counting backticks and using 4+ delimiter), and edge cases at file boundaries (first/last lines require special validation).

**Primary recommendation:** Build SuggestionFormatter utility that wraps existing diff utilities, adds escaping logic for backticks, validates line numbers against diff positions, and produces properly formatted suggestion blocks. Use functional approach with pure functions for escaping and validation to enable comprehensive unit testing before integrating with the formatting pipeline.

## Standard Stack

The stack is already present in the codebase—Phase 1 adds no new dependencies.

### Core

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| @octokit/rest | 20.1.2 | GitHub API client | Already integrated for PR comments. Native support for review comments with suggestion blocks via `pulls.createReview()` endpoint. **HIGH confidence** - existing dependency. |
| TypeScript | 5.9.3 | Type safety for formatter logic | Already in use. Essential for preventing runtime errors in line number mapping and escaping logic. **HIGH confidence** - existing dependency. |

### Supporting

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| Existing diff utilities | N/A | Line-to-position mapping | `mapLinesToPositions()` in `src/utils/diff.ts` already parses hunk headers and maps line numbers to diff positions. Reuse this for validation. **HIGH confidence** - verified in codebase. |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Custom diff parsing | parse-diff npm package | Existing `mapLinesToPositions()` already handles unified diff parsing correctly. Adding dependency introduces maintenance burden without benefit. |
| String templates | Markdown library | Suggestion blocks are simple fence syntax—library overhead unnecessary. Custom escaping logic is 10 lines of code. |
| Position-based API | Line-based API (current) | GitHub deprecated `position` parameter. Modern `line`/`start_line` approach is more maintainable and handles multi-line suggestions (Phase 3) naturally. |

**Installation:**
```bash
# No new dependencies required for Phase 1
# Existing stack sufficient:
# - @octokit/rest@^20.1.2
# - TypeScript@^5.9.3
```

## Architecture Patterns

### Recommended Project Structure
```
src/
├── utils/
│   ├── diff.ts                    # Existing - mapLinesToPositions(), mapAddedLines()
│   └── suggestion-formatter.ts    # NEW - formatSuggestionBlock(), escapeSuggestionContent()
└── output/
    ├── formatter.ts               # EXTEND - call suggestion formatter when Finding.suggestion exists
    └── formatter-v2.ts            # EXTEND - same extension as formatter.ts
```

### Pattern 1: Functional Suggestion Formatting

**What:** Pure functions that transform Finding data into GitHub markdown blocks without side effects

**When to use:** All suggestion formatting operations—enables easy testing and composability

**Example:**
```typescript
// Source: Based on GitHub suggestion syntax from official docs
// https://docs.github.com/articles/reviewing-proposed-changes-in-a-pull-request

interface SuggestionBlockOptions {
  content: string;      // The suggested code
  language?: string;    // Optional language hint (not part of GitHub suggestion syntax)
}

/**
 * Format suggestion content as GitHub suggestion block.
 * Handles backtick escaping automatically.
 */
export function formatSuggestionBlock(options: SuggestionBlockOptions): string {
  const { content } = options;

  // Count backticks in content to determine delimiter
  const maxBackticks = countMaxConsecutiveBackticks(content);
  const delimiter = '`'.repeat(Math.max(3, maxBackticks + 1));

  return `${delimiter}suggestion\n${content}\n${delimiter}`;
}

/**
 * Count maximum consecutive backticks in string.
 * Used to determine safe fence delimiter count.
 */
function countMaxConsecutiveBackticks(str: string): number {
  const matches = str.match(/`+/g);
  if (!matches) return 0;
  return Math.max(...matches.map(m => m.length));
}

/**
 * Validate that line number maps to valid diff position.
 * Returns null if line is invalid (not on RIGHT side).
 */
export function validateSuggestionLine(
  lineNumber: number,
  positionMap: Map<number, number>
): number | null {
  return positionMap.get(lineNumber) ?? null;
}
```

### Pattern 2: Inline Comment Enhancement

**What:** Extend existing comment formatting to include suggestion blocks when Finding.suggestion exists

**When to use:** When synthesizing final comment body in MarkdownFormatter

**Example:**
```typescript
// Source: Existing pattern from src/output/formatter.ts (lines 96-108)

private printSeveritySection(lines: string[], title: string, findings: Review['findings']): void {
  if (findings.length === 0) return;
  lines.push(`\n### ${title}`);
  findings.forEach(f => {
    lines.push(`- ${f.file}:${f.line} — ${f.title}`);
    lines.push(`  ${f.message}`);

    // NEW: Add suggestion block if present
    if (f.suggestion) {
      const suggestionBlock = formatSuggestionBlock({ content: f.suggestion });
      lines.push(`\n${suggestionBlock}\n`);
    }

    if (f.evidence) {
      lines.push(
        `  Evidence: ${f.evidence.badge} (${Math.round(f.evidence.confidence * 100)}%)${f.evidence.reasoning ? ` — ${f.evidence.reasoning}` : ''}`
      );
    }
  });
}
```

### Pattern 3: Line Validation Before Posting

**What:** Pre-flight validation that suggestion target lines exist in diff before creating GitHub comment

**When to use:** In CommentPoster.postInline() before calling GitHub API

**Example:**
```typescript
// Source: Existing pattern from src/github/comment-poster.ts (lines 161-171)

// Convert comments to GitHub API format, filtering out those without valid positions
const apiComments = enhancedComments
  .map(c => {
    const posMap = positionMaps.get(c.path);
    const position = posMap?.get(c.line);
    if (!position) {
      logger.warn(`Cannot find diff position for ${c.path}:${c.line}, skipping inline comment`);
      return null;
    }

    // NEW: If comment contains suggestion block, validate it's on RIGHT side
    if (c.body.includes('```suggestion')) {
      // Additional validation logic here
    }

    return { path: c.path, position, body: c.body };
  })
  .filter((c): c is { path: string; position: number; body: string } => c !== null);
```

### Anti-Patterns to Avoid

- **String concatenation for suggestion blocks:** Fragile and breaks with nested code blocks. Use `formatSuggestionBlock()` with proper escaping.
- **Caching line-to-position maps:** Diff context can change between review pass and comment posting. Always regenerate from FileChange.patch.
- **Using deprecated `position` parameter:** GitHub is deprecating this. Use `line`/`start_line` from the start.
- **Assuming all findings have valid diff positions:** Findings from AST analysis may reference unchanged lines. Filter these out gracefully.

## Don't Hand-Roll

Problems that look simple but have existing solutions:

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Diff parsing | Custom regex for hunk headers | Existing `mapLinesToPositions()` | Already handles edge cases (no newline markers, multiple hunks, quoted paths). Hand-rolling risks bugs. |
| Backtick escaping | Manual string replacement | `countMaxConsecutiveBackticks()` + delimiter generation | Fence delimiter count must exceed content backticks. Formula is simple but error-prone if hand-rolled. |
| Line validation | Inline checks in formatter | Separate `validateSuggestionLine()` function | Validation logic is reusable across formatters and testable in isolation. |

**Key insight:** Markdown fence escaping is deceptively simple—"just add more backticks"—but getting the count wrong causes silent rendering failures where GitHub shows raw markdown instead of commit buttons. Use proven counting approach.

## Common Pitfalls

### Pitfall 1: Line Number Misalignment from Position Mapping

**What goes wrong:** Suggestion appears on wrong line or fails with "Unable to apply suggestion" error in GitHub UI. Root cause is confusing absolute line numbers with diff positions.

**Why it happens:** GitHub's review comment API uses diff positions (1-indexed line count within the patch), not file line numbers. The deprecated `position` parameter counts lines from first @@ hunk, which differs from modern `line` parameter.

**How to avoid:**
- Use existing `mapLinesToPositions()` utility which correctly parses @@ hunk headers
- Always use `line` parameter with actual line number from Finding
- Validate line exists in position map before creating comment
- Use RIGHT side for all suggestions (LEFT side is old code, can't be suggested)

**Warning signs:**
- Suggestions appear offset by constant amount (hunk header line count mismatch)
- Suggestions work for first file but fail for subsequent files (position map not regenerated per file)
- "Line X not found in diff" errors in logs (line validation missing)

**Reference:** [GitHub REST API - Pull Request Comments](https://docs.github.com/en/rest/pulls/comments) — "This parameter is closing down. Use `line` instead."

### Pitfall 2: Markdown Syntax Conflicts with Backticks

**What goes wrong:** Suggestion block renders as plain text instead of actionable button. Users see raw ````suggestion` markdown in comment.

**Why it happens:** When suggested code contains triple backticks (```), it prematurely closes the suggestion fence delimiter, causing GitHub's markdown parser to treat remaining content as regular text.

**How to avoid:**
- Count maximum consecutive backticks in suggestion content
- Use delimiter count of `max(3, maxBackticks + 1)`
- Alternative: Use tilde delimiter (~~~suggestion) which avoids backtick conflicts entirely
- Test with code containing markdown fences, regex literals with backticks, template literals

**Warning signs:**
- Suggestion block visible in comment but no "Commit suggestion" button appears
- Code after first ``` delimiter renders as regular markdown
- Nested code blocks break out of suggestion scope

**Reference:** [GitHub Community Discussion #76840](https://github.com/orgs/community/discussions/76840) — Nested backtick handling in suggestions

### Pitfall 3: Invalid Line Numbers on Unchanged Code

**What goes wrong:** LLM generates finding for unchanged context line (not in diff). Attempting to create suggestion results in GitHub API error or silent failure.

**Why it happens:** AST analysis can detect issues in unchanged code. Findings may reference lines outside the diff hunks. GitHub suggestions only work on changed lines (RIGHT side).

**How to avoid:**
- Check if Finding.line exists in position map before formatting suggestion
- Fall back to description-only comment when line is invalid
- Log warning with file path and line number for debugging
- Don't suppress the finding—still valuable feedback even without suggestion

**Warning signs:**
- Higher failure rate on PRs with small diffs but large files
- Suggestions work in some files but not others (inconsistent validation)
- "Line not in diff" errors clustered on specific file types

**Reference:** Existing pattern in `src/github/comment-poster.ts` lines 161-171

### Pitfall 4: Escaping Edge Cases (Empty Lines, Whitespace-Only)

**What goes wrong:** Suggestion contains trailing whitespace or empty lines that GitHub silently strips, causing context mismatch when user applies.

**Why it happens:** GitHub normalizes suggestion content before applying. If LLM generates fix with trailing spaces and they're stripped on apply, resulting code may differ from validation.

**How to avoid:**
- Trim trailing whitespace from suggestion content before formatting
- Preserve intentional empty lines (e.g., between function definitions)
- Validate suggestion matches expected format (no tabs if spaces are standard)
- Document whitespace normalization behavior in validation layer (Phase 4)

**Warning signs:**
- Suggestions apply but introduce linting errors (whitespace rules)
- Diff shows unexpected whitespace changes after applying suggestion
- CI fails on suggestions that passed pre-validation

**Reference:** Not well-documented in GitHub—discovered through community trial and error

### Pitfall 5: First/Last Line of File Boundaries

**What goes wrong:** Suggestion on line 1 or last line of file behaves unexpectedly. May fail to apply or apply with extra newlines.

**Why it happens:** Diff hunk headers for file boundaries have special edge cases. First line has no "before" context, last line may lack trailing newline marker.

**How to avoid:**
- Test specifically with findings on line 1 and last line of file
- Verify hunk header parsing handles `@@ -0,0 +1,N @@` (new file) correctly
- Check for `\ No newline at end of file` marker in patch
- Add integration test cases for these boundary conditions

**Warning signs:**
- Suggestions work mid-file but fail at edges
- New file suggestions (line 1) behave differently than modifications
- Deleted file suggestions fail (should be rejected—can't suggest on LEFT side)

**Reference:** CommonMark specification on fence delimiters; Git diff format documentation

## Code Examples

Verified patterns from research and codebase analysis:

### Suggestion Block Formatting

```typescript
// Source: Derived from GitHub suggestion syntax specification
// https://docs.github.com/articles/reviewing-proposed-changes-in-a-pull-request

/**
 * Format a single-line suggestion for GitHub.
 * Handles backtick escaping automatically.
 */
export function formatSuggestionBlock(content: string): string {
  // Determine safe delimiter count
  const maxBackticks = countMaxConsecutiveBackticks(content);
  const delimiterCount = Math.max(3, maxBackticks + 1);
  const delimiter = '`'.repeat(delimiterCount);

  return `${delimiter}suggestion\n${content}\n${delimiter}`;
}

/**
 * Count maximum consecutive backticks to determine safe fence delimiter.
 */
function countMaxConsecutiveBackticks(str: string): number {
  const matches = str.match(/`+/g);
  if (!matches) return 0;
  return Math.max(...matches.map(m => m.length));
}

// Usage example:
const suggestion = formatSuggestionBlock('const x = `template ${literal}`;');
// Returns:
// ```suggestion
// const x = `template ${literal}`;
// ```

// Edge case with triple backticks:
const mdSuggestion = formatSuggestionBlock('```typescript\ncode\n```');
// Returns (note 4 backticks):
// ````suggestion
// ```typescript
// code
// ```
// ````
```

### Line Validation Against Diff

```typescript
// Source: Existing pattern from src/utils/diff.ts and src/github/comment-poster.ts

import { mapLinesToPositions } from '../utils/diff';
import { FileChange } from '../types';

/**
 * Validate that a finding's line number exists in the diff.
 * Returns diff position if valid, null otherwise.
 */
export function validateFindingLine(
  finding: { file: string; line: number },
  files: FileChange[]
): number | null {
  // Find the file
  const file = files.find(f => f.filename === finding.file);
  if (!file) {
    return null;
  }

  // Map line numbers to positions
  const positionMap = mapLinesToPositions(file.patch);

  // Check if line exists (on RIGHT side only)
  return positionMap.get(finding.line) ?? null;
}

// Usage in formatter:
function formatFindingWithSuggestion(
  finding: Finding,
  files: FileChange[]
): string {
  const lines: string[] = [];
  lines.push(`### ${finding.title}`);
  lines.push(finding.message);

  if (finding.suggestion) {
    const position = validateFindingLine(finding, files);
    if (position !== null) {
      // Line is valid, add suggestion block
      const block = formatSuggestionBlock(finding.suggestion);
      lines.push('');
      lines.push(block);
    } else {
      // Line is invalid, skip suggestion but keep finding
      logger.warn(
        `Skipping suggestion for ${finding.file}:${finding.line} - line not in diff`
      );
    }
  }

  return lines.join('\n');
}
```

### Enhanced Comment Body with Suggestion

```typescript
// Source: Extension of existing src/output/formatter.ts pattern

import { Finding } from '../types';
import { formatSuggestionBlock } from '../utils/suggestion-formatter';

/**
 * Create comment body with optional suggestion block.
 * Gracefully handles missing suggestions.
 */
export function createCommentBody(finding: Finding): string {
  const parts: string[] = [];

  // Title and severity
  parts.push(`**${finding.title}** (${finding.severity})`);
  parts.push('');

  // Description
  parts.push(finding.message);

  // Suggestion block if present
  if (finding.suggestion) {
    parts.push('');
    parts.push('**Suggested fix:**');
    parts.push('');
    parts.push(formatSuggestionBlock(finding.suggestion));
    parts.push('');
    parts.push('⚠️ **Review before applying** - Always verify suggestions match your intent.');
  }

  // Evidence if present
  if (finding.evidence) {
    parts.push('');
    parts.push(`**Evidence:** ${finding.evidence.badge} (${Math.round(finding.evidence.confidence * 100)}%)`);
    if (finding.evidence.reasoning) {
      parts.push(finding.evidence.reasoning);
    }
  }

  return parts.join('\n');
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `position` parameter | `line`/`start_line` parameters | GitHub API deprecation (ongoing) | Position counted from first hunk header; new params use actual line numbers. Easier to reason about and debug. |
| Fixed triple backtick delimiters | Dynamic delimiter count | Community best practice (2020+) | Fixed delimiters broke on nested code blocks. Dynamic count handles arbitrary nesting depth. |
| Manual line mapping | Utility functions like `mapLinesToPositions` | Project-specific (existing) | Hand-rolled mapping missed edge cases (no newline markers, renames). Utility is battle-tested. |

**Deprecated/outdated:**
- **position parameter:** GitHub API is closing this down. Use `line` parameter instead. Still accepted but will be removed in future API versions.
- **Fixed delimiter assumption:** Early implementations assumed ````suggestion` always worked. Breaks on nested code blocks—use dynamic counting.

## Open Questions

Things that couldn't be fully resolved:

1. **What is GitHub's exact whitespace normalization behavior for suggestions?**
   - What we know: GitHub strips trailing whitespace when applying suggestions (observed behavior)
   - What's unclear: Does it normalize tabs to spaces? Preserve intentional empty lines? Collapse multiple newlines?
   - Recommendation: Add integration test that applies suggestion and verifies exact content. Document behavior in validation layer (Phase 4).

2. **How does GitHub handle suggestions on renamed files?**
   - What we know: FileChange includes `previousFilename` field. Diff uses new filename in hunks.
   - What's unclear: Does suggestion API accept old filename, new filename, or either?
   - Recommendation: Test with renamed file PR. Likely uses new filename (RIGHT side) but needs verification.

3. **What is the maximum size for a suggestion block?**
   - What we know: GitHub has 60KB limit on comment body (enforced in CommentPoster.MAX_COMMENT_SIZE)
   - What's unclear: Does suggestion content count toward this limit? Separate limit for suggestion blocks?
   - Recommendation: Test with large suggestion (500+ line refactor). Likely fails gracefully but need to handle errors.

## Sources

### Primary (HIGH confidence)
- [GitHub REST API - Pull Request Review Comments](https://docs.github.com/en/rest/pulls/comments) — Official API specification for line parameters
- [GitHub Docs - Reviewing Proposed Changes](https://docs.github.com/articles/reviewing-proposed-changes-in-a-pull-request) — Suggestion block syntax
- [GitHub Docs - Incorporating Feedback](https://docs.github.com/articles/incorporating-feedback-in-your-pull-request) — How users apply suggestions
- Existing codebase — `src/utils/diff.ts`, `src/github/comment-poster.ts`, `src/types/index.ts`

### Secondary (MEDIUM confidence)
- [GitHub Changelog - Multi-line Code Suggestions](https://github.blog/changelog/2020-04-15-multi-line-code-suggestions-general-availability/) — Feature announcement
- [GitHub Community Discussion #76840](https://github.com/orgs/community/discussions/76840) — Nested backtick workaround
- [Markdown Monster - Escape Fenced Code Blocks](https://markdownmonster.west-wind.com/docs/FAQ/Escape-Markdown-Fenced-Code-Blocks.html) — Backtick escaping patterns
- [Code with Hugo - Markdown Escape Backticks](https://codewithhugo.com/markdown-escape-backticks/) — Fence delimiter best practices

### Tertiary (LOW confidence)
- [Graphite Guides - Suggest Changes in GitHub PR](https://graphite.com/guides/suggest-changes-github-pr) — Community tutorial (UI-focused)
- Web search results — Lack formal specification for suggestion syntax beyond GitHub UI docs

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - No new dependencies, existing utilities sufficient
- Architecture: HIGH - Functional patterns, extends existing formatters, well-scoped
- Pitfalls: HIGH - Line misalignment and backtick conflicts validated through official docs and community reports

**Research date:** 2026-02-04
**Valid until:** 60 days (stable feature, unlikely to change rapidly)
