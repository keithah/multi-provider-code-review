# Phase 3: Multi-Line and Advanced Formatting - Research

**Researched:** 2026-02-04
**Domain:** GitHub multi-line suggestion API and diff hunk validation
**Confidence:** HIGH

## Summary

Phase 3 extends single-line suggestions to support multi-line replacements (2-50 consecutive lines) with strict validation against diff structure. The research reveals that GitHub's multi-line suggestion feature has been stable since 2020, using `start_line` and `line` API parameters to define ranges. The critical constraint is that all lines in a multi-line suggestion must exist on the RIGHT side of the diff (added or context lines only)—suggestions cannot span deleted lines or cross non-contiguous hunk boundaries.

The standard approach uses GitHub's native batch commit feature for applying multiple suggestions at once, with platform-handled conflict detection. Validation must check: (1) all lines in range exist on RIGHT side, (2) lines are consecutive with no gaps, (3) range doesn't cross hunk boundaries, and (4) total span ≤50 lines. The existing diff parsing utilities (`mapLinesToPositions`) already provide the foundation—Phase 3 adds range validation and multi-line formatting.

Key pitfalls include attempting suggestions across deleted lines (GitHub explicitly rejects this), crossing hunk boundaries (causes "line must be part of diff" errors), and non-consecutive line ranges (LLM hallucination). Batch commit ordering follows file position (top-to-bottom) with GitHub's native conflict detection handling overlaps.

**Primary recommendation:** Extend existing validation to support line ranges with consecutive checking, reuse dynamic fence calculation from Phase 1 for multi-line escaping, validate all lines in range exist on RIGHT side before formatting, and trust GitHub's batch commit platform for conflict handling without custom logic.

## Standard Stack

Phase 3 operates within the existing TypeScript/Node.js codebase without new dependencies.

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| @octokit/rest | 20.1.2 | GitHub API client | Already integrated. Supports multi-line comments via `start_line` and `start_side` parameters in `pulls.createReview()`. **HIGH confidence** - verified in official docs. |
| TypeScript | 5.9.3 | Type safety for range validation | Already in use. Essential for preventing off-by-one errors in range checking and hunk boundary detection. **HIGH confidence** - existing dependency. |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| Existing diff utilities | N/A | Hunk boundary detection | `mapLinesToPositions()` in `src/utils/diff.ts` already parses @@ hunk headers and maps lines to positions. Extend for range validation. **HIGH confidence** - verified in codebase. |
| Existing suggestion-formatter.ts | N/A | Backtick escaping | Dynamic fence delimiter calculation (max backticks + 1) from Phase 1 works for multi-line content. **HIGH confidence** - implemented and tested. |
| Existing suggestion-validator.ts | N/A | Single-line validation | Extend `validateSuggestionLine()` to `validateSuggestionRange()` with consecutive checking. **HIGH confidence** - existing pattern. |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Custom hunk parser | git diff libraries (nodegit, isomorphic-git) | Existing parser handles unified diff format correctly. Heavy dependencies add complexity without benefit. |
| Custom conflict detection | GitHub's native batch commit | GitHub already handles overlapping suggestions when applying batches. Custom logic would duplicate platform features. |
| Tilde delimiters (~~~) | Backtick delimiters with dynamic count | Dynamic backticks already implemented and tested in Phase 1. Consistent with single-line approach. |

**Installation:**
```bash
# No new dependencies required for Phase 3
# Existing stack sufficient:
# - @octokit/rest@^20.1.2
# - TypeScript@^5.9.3
```

## Architecture Patterns

### Recommended Project Structure
```
src/
├── utils/
│   ├── diff.ts                      # EXTEND - Add hunk boundary detection
│   ├── suggestion-formatter.ts      # EXISTS - Dynamic fence works for multi-line
│   └── suggestion-validator.ts      # EXTEND - Add validateSuggestionRange()
├── github/
│   └── comment-poster.ts            # EXTEND - Validate ranges before posting
└── types/
    └── index.ts                     # EXTEND - Add start_line to Finding (optional)
```

### Pattern 1: Multi-Line Range Validation

**What:** Validate that a suggestion line range is valid for GitHub multi-line suggestions

**When to use:** When Finding.suggestion spans multiple lines (detected by newline count or explicit range)

**Example:**
```typescript
// Source: GitHub REST API docs + research on RIGHT-side constraint
// https://docs.github.com/en/rest/pulls/comments

interface LineRange {
  start_line: number;  // First line of replacement
  line: number;        // Last line of replacement (end_line)
}

interface RangeValidationResult {
  isValid: boolean;
  reason?: string;
  positions?: { start: number; end: number }; // Diff positions if valid
}

/**
 * Validate that a line range is valid for multi-line suggestion.
 *
 * Requirements:
 * - All lines in range must exist on RIGHT side of diff
 * - Lines must be consecutive (no gaps)
 * - Range must not cross hunk boundaries
 * - Range must not exceed 50 lines (sanity limit from Phase 2)
 */
export function validateSuggestionRange(
  range: LineRange,
  patch: string | undefined
): RangeValidationResult {
  if (!patch) {
    return { isValid: false, reason: 'No patch available' };
  }

  const { start_line, line } = range;

  // Check 1: Range is forward-only (start <= end)
  if (start_line > line) {
    return { isValid: false, reason: 'Invalid range: start_line > line' };
  }

  // Check 2: Range doesn't exceed sanity limit
  const spanLength = line - start_line + 1;
  if (spanLength > 50) {
    return { isValid: false, reason: `Range too long: ${spanLength} lines (max 50)` };
  }

  // Check 3: All lines exist on RIGHT side
  const positionMap = mapLinesToPositions(patch);
  const startPosition = positionMap.get(start_line);
  const endPosition = positionMap.get(line);

  if (startPosition === undefined || endPosition === undefined) {
    return {
      isValid: false,
      reason: `Line range ${start_line}-${line} not in diff`
    };
  }

  // Check 4: All intermediate lines exist (consecutive check)
  for (let lineNum = start_line; lineNum <= line; lineNum++) {
    if (!positionMap.has(lineNum)) {
      return {
        isValid: false,
        reason: `Gap in range: line ${lineNum} not in diff`
      };
    }
  }

  // Check 5: Range doesn't cross hunk boundaries
  if (!isRangeWithinSingleHunk(start_line, line, patch)) {
    return {
      isValid: false,
      reason: 'Range crosses hunk boundary'
    };
  }

  return {
    isValid: true,
    positions: { start: startPosition, end: endPosition }
  };
}

/**
 * Check if line range is within a single contiguous hunk.
 * Returns false if range crosses non-contiguous hunks.
 */
function isRangeWithinSingleHunk(
  startLine: number,
  endLine: number,
  patch: string
): boolean {
  const lines = patch.split('\n');
  const hunkRegex = /^@@ -(\d+)(?:,\d+)? \+(\d+)(?:,\d+)? @@/;

  let currentNew = 0;
  let inHunk = false;
  let rangeStartedInHunk = false;

  for (const line of lines) {
    const hunkMatch = line.match(hunkRegex);

    if (hunkMatch) {
      // New hunk starts
      if (rangeStartedInHunk && inHunk) {
        // Range was active, new hunk = crossing boundary
        return false;
      }
      currentNew = parseInt(hunkMatch[2], 10);
      inHunk = true;
      continue;
    }

    if (!inHunk) continue;

    if (line.startsWith('+')) {
      if (currentNew === startLine) {
        rangeStartedInHunk = true;
      }
      if (currentNew === endLine) {
        return rangeStartedInHunk; // Range complete, check if it started in this hunk
      }
      currentNew += 1;
    } else if (line.startsWith('-')) {
      // Deleted line, don't advance new line counter
    } else {
      // Context line
      if (currentNew === startLine) {
        rangeStartedInHunk = true;
      }
      if (currentNew === endLine) {
        return rangeStartedInHunk;
      }
      currentNew += 1;
    }
  }

  return false; // Range never completed
}
```

### Pattern 2: Multi-Line Suggestion Formatting

**What:** Format multi-line code replacement as GitHub suggestion block (extends Phase 1)

**When to use:** When suggestion content contains newlines and passes range validation

**Example:**
```typescript
// Source: Phase 1 formatSuggestionBlock + multi-line extension
// Dynamic fence calculation already handles multi-line content

/**
 * Format multi-line suggestion for GitHub.
 * Reuses Phase 1's dynamic fence calculation - works for any content.
 */
export function formatMultiLineSuggestionBlock(content: string): string {
  // Empty/whitespace check (from Phase 1)
  if (!content || content.trim() === '') {
    return '';
  }

  // Count max backticks across all lines (from Phase 1)
  const maxBackticks = countMaxConsecutiveBackticks(content);
  const fenceCount = Math.max(3, maxBackticks + 1);
  const fence = '`'.repeat(fenceCount);

  // Format with fence - same as single-line
  return `${fence}suggestion\n${content}\n${fence}`;
}

// NOTE: This is the SAME function as Phase 1's formatSuggestionBlock.
// Multi-line escaping "just works" with dynamic fence calculation.
```

### Pattern 3: Batch Commit Ordering

**What:** Order suggestions by file position (top-to-bottom) for batch application

**When to use:** When multiple suggestions exist for a PR review

**Example:**
```typescript
// Source: Research finding - GitHub batch commit best practice
// Order by file, then by line number within file

import { InlineComment } from '../types';

/**
 * Sort inline comments by file position for batch commit.
 * GitHub applies suggestions in order, so top-to-bottom matches reading order.
 */
export function sortCommentsForBatch(comments: InlineComment[]): InlineComment[] {
  return comments.sort((a, b) => {
    // First, sort by file path
    if (a.path !== b.path) {
      return a.path.localeCompare(b.path);
    }
    // Within same file, sort by line number
    return a.line - b.line;
  });
}

// Usage in comment-poster.ts:
async postInline(prNumber: number, comments: InlineComment[], ...): Promise<void> {
  // Sort comments for optimal batch commit UX
  const sortedComments = sortCommentsForBatch(comments);

  // GitHub's batch commit UI shows suggestions in this order
  // User sees top-to-bottom progression through the code
  // ... rest of posting logic
}
```

### Pattern 4: Deletion-Only File Filtering

**What:** Skip suggestion generation entirely for files with zero added lines

**When to use:** During comment preparation, before validation

**Example:**
```typescript
// Source: User decision - skip deletion-only files
// Research finding - RIGHT side constraint means no suggestions possible

import { FileChange } from '../types';

/**
 * Check if file is deletion-only (no suggestions possible).
 * GitHub suggestions require RIGHT side lines, which don't exist in deletion-only files.
 */
export function isDeletionOnlyFile(file: FileChange): boolean {
  return file.status === 'removed' || file.additions === 0;
}

/**
 * Filter findings to exclude those in deletion-only files.
 * These cannot have suggestions per GitHub's RIGHT-side constraint.
 */
export function filterOutDeletionOnlyFindings(
  findings: Finding[],
  files: FileChange[]
): Finding[] {
  const deletionOnlyFiles = new Set(
    files.filter(isDeletionOnlyFile).map(f => f.filename)
  );

  return findings.filter(f => !deletionOnlyFiles.has(f.file));
}
```

### Anti-Patterns to Avoid

- **Auto-expanding ranges to logical blocks:** Don't "fix" LLM-specified ranges by expanding to function boundaries. Trust LLM exactly—auto-expansion causes unexpected changes. User decision: trust LLM-specified ranges.
- **Truncating invalid ranges:** Don't salvage partial ranges when validation fails (e.g., "lines 10-15 invalid, use 10-12"). Fail entire suggestion—partial fixes are misleading. User decision: fail entire suggestion.
- **Custom conflict detection:** Don't build logic to detect overlapping suggestions. GitHub's batch commit handles this natively with clear UI. User decision: let GitHub handle conflicts.
- **Special boundary validation:** Don't add extra checks for first/last lines of files. Treat normally—hunk parsing handles boundaries. User decision: treat first/last lines normally.

## Don't Hand-Roll

Problems that look simple but have existing solutions:

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Hunk boundary detection | Custom regex for @@ markers | Extend existing `mapLinesToPositions()` with hunk tracking | Existing parser handles edge cases (no newline markers, multiple hunks). Adding hunk context is incremental. |
| Consecutive line checking | Manual loop with gap detection | Use `Map.has()` over range with early exit | Position map already exists from Phase 1. Checking presence in map is O(n) and clear. |
| Multi-line escaping | New logic for multi-line content | Reuse Phase 1's `countMaxConsecutiveBackticks()` | Dynamic fence calculation already handles arbitrary content. Multi-line is same algorithm. |
| Batch ordering | Custom file/line sorting with edge cases | Standard `Array.sort()` with comparator | Lexicographic file sort + numeric line sort is sufficient. No complex logic needed. |

**Key insight:** Hunk boundary detection looks complex but is actually an incremental extension of existing diff parsing. Don't reparse the patch—track hunk state while mapping positions. Most validation logic from Phase 1 applies to ranges with minimal changes.

## Common Pitfalls

### Pitfall 1: Suggestions Across Deleted Lines

**What goes wrong:** Suggestion spans lines that include deletions (LEFT side), causing "Applying suggestions on deleted lines is not supported" error from GitHub.

**Why it happens:** LLM sees full diff context and suggests replacement that includes both deleted and new lines. GitHub's suggestion feature only operates on RIGHT side (added/context lines).

**How to avoid:**
- Validate ALL lines in range exist in `mapLinesToPositions()` result
- Position map only includes RIGHT side lines (deleted lines are absent)
- Fail entire suggestion if any line in range is missing
- Filter out deletion-only files before suggestion generation

**Warning signs:**
- Suggestions work for pure additions but fail for modifications with deletions
- Error message mentions "deleted lines" in GitHub API response
- Multi-line suggestions fail more often than single-line

**Reference:**
- [GitHub Community Discussion #114597](https://github.com/orgs/community/discussions/114597) - Multi-line code suggestions impossible where part of code was deleted
- [GitHub Community Discussion #32114](https://github.com/orgs/community/discussions/32114) - Support & fix change suggestion in presence of deleted lines

### Pitfall 2: Non-Consecutive Line Ranges

**What goes wrong:** Suggestion range contains gaps (e.g., lines 10, 12, 15 but not 11, 13, 14), causing invalid diff positions or silent failures.

**Why it happens:** LLM hallucinates non-existent line numbers or misunderstands diff structure. User decision mandates consecutive-only ranges.

**How to avoid:**
- Check every line in range [start_line, line] exists in position map
- Fail suggestion if any intermediate line is missing
- Log specific missing line number for debugging
- Document in prompt that ranges must be consecutive

**Warning signs:**
- Suggestions fail with "line not in diff" for middle of range
- Success rate drops on diffs with many unchanged lines (context gaps)
- Validation logs show gaps in ranges

**Reference:** User decision in CONTEXT.md - "Require consecutive lines only (no gaps)"

### Pitfall 3: Crossing Hunk Boundaries

**What goes wrong:** Suggestion spans lines from non-contiguous hunks, causing "Pull request review thread line must be part of the diff" error.

**Why it happens:** File has multiple changed sections separated by unchanged context. Hunks are non-contiguous. GitHub API requires suggestion range within single hunk.

**How to avoid:**
- Track hunk boundaries while parsing diff (extend existing parser)
- Validate range doesn't cross from one hunk to another
- Fail suggestion if range spans multiple hunks
- Log hunk positions for debugging

**Warning signs:**
- Suggestions fail on files with scattered changes but work on contiguous changes
- GitHub API error mentions "diff hunk can't be blank"
- Multi-line suggestions fail more than single-line in same file

**Reference:** Research finding - "When publishing code suggestions to GitHub via the REST API, an error can occur with message 'Pull request review thread line must be part of the diff and Pull request review thread diff hunk can't be blank'"

### Pitfall 4: Range Validation Too Early

**What goes wrong:** Validating ranges before patch is available (e.g., during LLM parsing), causing false positives.

**Why it happens:** Range validation requires patch data. Attempting validation during finding extraction doesn't have file context yet.

**How to avoid:**
- Validate ranges in CommentPoster.postInline(), not in parser
- Parser just extracts range from LLM output (start_line, line fields)
- Validation happens when patch data is available
- Follow same pattern as Phase 1 single-line validation

**Warning signs:**
- High rejection rate during parsing but low failure rate during posting
- Validation errors reference missing patches
- Different providers have inconsistent validation outcomes

**Reference:** Phase 1 pattern - validation in CommentPoster (lines 172-178), not in parser

### Pitfall 5: Off-By-One in Range Length

**What goes wrong:** Range length calculated as `line - start_line` instead of `line - start_line + 1`, causing incorrect 50-line limit enforcement.

**Why it happens:** Inclusive range [start_line, line] has length of end - start + 1, but common mistake is to forget +1.

**How to avoid:**
- Use formula: `spanLength = line - start_line + 1`
- Test with edge case: start_line=10, line=10 should have length 1 (single line)
- Document that both start_line and line are inclusive
- Add unit test for single-line range (length should be 1, not 0)

**Warning signs:**
- Range [10, 59] rejected for being >50 lines (should be exactly 50)
- Single-line ranges (start_line === line) reported as length 0
- Consistent off-by-one errors in range validation

**Reference:** Standard inclusive range formula

## Code Examples

Verified patterns from research and existing codebase:

### Multi-Line Range Validation (Core Pattern)

```typescript
// Source: Synthesized from GitHub API docs and Phase 1 patterns
// https://docs.github.com/en/rest/pulls/comments (start_line, line parameters)

import { mapLinesToPositions } from './diff';

export interface SuggestionRange {
  start_line: number;
  line: number;
  content: string;
}

export interface RangeValidation {
  isValid: boolean;
  reason?: string;
  startPosition?: number;
  endPosition?: number;
}

/**
 * Validate multi-line suggestion range against patch.
 *
 * Checks:
 * 1. Forward range (start <= end)
 * 2. Within sanity limit (≤50 lines)
 * 3. All lines exist on RIGHT side
 * 4. Consecutive (no gaps)
 * 5. Within single hunk
 */
export function validateSuggestionRange(
  range: SuggestionRange,
  patch: string | undefined
): RangeValidation {
  // Basic checks
  if (!patch) {
    return { isValid: false, reason: 'No patch available' };
  }

  const { start_line, line } = range;

  if (start_line > line) {
    return { isValid: false, reason: 'Invalid range: start > end' };
  }

  const spanLength = line - start_line + 1;
  if (spanLength > 50) {
    return { isValid: false, reason: `Range too long: ${spanLength} lines` };
  }

  // Map lines to positions (reuse Phase 1 utility)
  const positionMap = mapLinesToPositions(patch);

  // Validate all lines exist (RIGHT side only)
  const startPos = positionMap.get(start_line);
  const endPos = positionMap.get(line);

  if (startPos === undefined || endPos === undefined) {
    return { isValid: false, reason: `Range ${start_line}-${line} not in diff` };
  }

  // Check consecutive (no gaps)
  for (let lineNum = start_line; lineNum <= line; lineNum++) {
    if (!positionMap.has(lineNum)) {
      return { isValid: false, reason: `Gap at line ${lineNum}` };
    }
  }

  // Check hunk boundary (don't cross non-contiguous hunks)
  if (!isWithinSingleHunk(start_line, line, patch)) {
    return { isValid: false, reason: 'Crosses hunk boundary' };
  }

  return { isValid: true, startPosition: startPos, endPosition: endPos };
}

/**
 * Check if range is within single contiguous hunk.
 */
function isWithinSingleHunk(start: number, end: number, patch: string): boolean {
  const lines = patch.split('\n');
  const hunkRegex = /^@@ -(\d+)(?:,\d+)? \+(\d+)(?:,\d+)? @@/;

  let currentNew = 0;
  let hunkStart = -1;
  let hunkEnd = -1;
  let foundStart = false;

  for (const line of lines) {
    const hunkMatch = line.match(hunkRegex);

    if (hunkMatch) {
      // New hunk - check if we completed previous range
      if (foundStart && currentNew < end) {
        return false; // Range crossed hunk boundary
      }
      hunkStart = parseInt(hunkMatch[2], 10);
      currentNew = hunkStart;
      continue;
    }

    if (line.startsWith('+') || (!line.startsWith('-') && line.length > 0)) {
      // RIGHT side line (added or context)
      if (currentNew === start) {
        foundStart = true;
      }
      if (currentNew === end) {
        return foundStart; // Found complete range in single hunk
      }
      currentNew += 1;
    }
  }

  return false; // Never found complete range
}
```

### GitHub API Comment with Multi-Line Range

```typescript
// Source: GitHub REST API documentation
// https://docs.github.com/en/rest/pulls/comments

import { Octokit } from '@octokit/rest';

/**
 * Create multi-line review comment using GitHub API.
 * Uses start_line and line parameters for range.
 */
async function createMultiLineComment(
  octokit: Octokit,
  owner: string,
  repo: string,
  pullNumber: number,
  filePath: string,
  range: { start_line: number; line: number },
  body: string
): Promise<void> {
  await octokit.rest.pulls.createReview({
    owner,
    repo,
    pull_number: pullNumber,
    event: 'COMMENT',
    comments: [{
      path: filePath,
      // Multi-line parameters
      start_line: range.start_line,  // Required for multi-line
      line: range.line,                // End line of range
      start_side: 'RIGHT',              // Required for multi-line
      side: 'RIGHT',                    // Always RIGHT for suggestions
      body,                             // Contains ```suggestion block
    }],
  });
}
```

### Batch Commit Comment Sorting

```typescript
// Source: Research finding + existing comment-poster.ts pattern
// Order comments for optimal batch commit UX

import { InlineComment } from '../types';

/**
 * Sort comments by file position for batch commit.
 * GitHub applies in order, so top-to-bottom matches reading order.
 */
export function sortCommentsForBatch(
  comments: InlineComment[]
): InlineComment[] {
  return comments.sort((a, b) => {
    // Sort by file path first
    const pathCompare = a.path.localeCompare(b.path);
    if (pathCompare !== 0) return pathCompare;

    // Within file, sort by line number
    return a.line - b.line;
  });
}

// Usage:
const sortedComments = sortCommentsForBatch(enhancedComments);
// GitHub batch commit UI shows these in order
// User sees: file1 line 5, file1 line 12, file2 line 3, file2 line 20
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Single-line suggestions only | Multi-line suggestions with `start_line` parameter | April 2020 (GA) | Enables refactoring fixes that span multiple lines. Standard feature across all GitHub plans. |
| Position-based comments | Line-based comments with `line` parameter | 2020-2021 (deprecation) | Modern `line` approach maps to actual file line numbers. Easier to reason about and debug. |
| Manual conflict resolution | Native batch commit with conflict detection | 2020+ (part of multi-line feature) | GitHub UI shows conflicts, user decides. No custom conflict logic needed. |
| Fixed delimiter assumption | Dynamic fence calculation | Community best practice (2020+) | Handles nested backticks in multi-line code blocks. Already implemented in Phase 1. |

**Deprecated/outdated:**
- **position parameter:** GitHub API is closing this down for review comments. Use `line` and `start_line` instead.
- **Single-line only assumption:** Multi-line suggestions are now standard. Don't artificially limit to single-line.
- **Suggestions on LEFT side:** Never worked, but early attempts tried. RIGHT side only is documented constraint.

## Open Questions

Things that couldn't be fully resolved:

1. **Exact hunk boundary detection algorithm**
   - What we know: Hunks separated by unchanged context are non-contiguous. Ranges cannot cross.
   - What's unclear: Does GitHub consider hunks with zero context lines between them as "crossing"? E.g., @@ +10,5 @@ immediately followed by @@ +15,5 @@
   - Recommendation: Implement conservative check - any hunk header between start and end fails validation. Test with edge cases in Phase 4.

2. **Deletion-only file edge cases**
   - What we know: Files with `status: 'removed'` or `additions: 0` should skip suggestions
   - What's unclear: What about files with `additions: 0` but `status: 'modified'` (pure deletions in context of modifications)?
   - Recommendation: Use `additions === 0` as sole criteria. Status alone isn't sufficient. Log edge cases for review.

3. **Maximum multi-line suggestion size**
   - What we know: 50-line limit from Phase 2 for sanity. GitHub has 60KB comment limit.
   - What's unclear: Does GitHub have separate limit for suggestion blocks? Does content count affect batch commit?
   - Recommendation: Keep 50-line limit. Test with large multi-line suggestions (40-50 lines) in integration tests.

4. **Batch commit conflict resolution UX**
   - What we know: GitHub's batch commit shows conflicts when suggestions overlap
   - What's unclear: How does GitHub define "overlapping"? Adjacent lines? Same line? Intersecting ranges?
   - Recommendation: Trust GitHub's native detection. Don't build custom overlap checking. Document behavior when discovered through usage.

## Sources

### Primary (HIGH confidence)
- [GitHub REST API - Pull Request Comments](https://docs.github.com/en/rest/pulls/comments) - Official API documentation for `start_line`, `line`, `start_side`, `side` parameters
- [GitHub Docs - Commenting on Pull Requests](https://docs.github.com/en/pull-requests/collaborating-with-pull-requests/reviewing-changes-in-pull-requests/commenting-on-a-pull-request) - Multi-line suggestion UI and usage
- [GitHub Docs - Incorporating Feedback](https://docs.github.com/articles/incorporating-feedback-in-your-pull-request) - Batch commit feature documentation
- [GitHub Changelog - Multi-line Code Suggestions GA](https://github.blog/changelog/2020-04-15-multi-line-code-suggestions-general-availability/) - Feature announcement and availability
- Existing codebase - `src/utils/diff.ts` (mapLinesToPositions, hunk parsing), `src/utils/suggestion-formatter.ts` (dynamic fence), `src/utils/suggestion-validator.ts` (line validation)

### Secondary (MEDIUM confidence)
- [GitHub Community Discussion #114597](https://github.com/orgs/community/discussions/114597) - Multi-line suggestions impossible with deleted lines
- [GitHub Community Discussion #32114](https://github.com/orgs/community/discussions/32114) - Support for suggestions with deleted lines
- [GitHub Community Discussion #1399](https://github.com/isaacs/github/issues/1399) - One commit to apply multiple PR review suggestions
- [GNU Diffutils - Hunks](http://www.gnu.org/s/diffutils/manual/html_node/Hunks.html) - Formal hunk definition and structure
- [Git diff format documentation](https://git-scm.com/docs/diff-format) - Unified diff hunk header specification

### Tertiary (LOW confidence)
- [Graphite Guides - Suggest Changes](https://graphite.com/guides/suggest-changes-github-pr) - Community tutorial (UI-focused, no API details)
- [Select multiple lines review](https://ssosic.com/development/select-multiple-lines-on-github-pull-request-review/) - Blog post on UI interactions
- Web search results - Community discussions on edge cases, lack formal specification beyond GitHub docs

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - No new dependencies, extends existing utilities, validated against official GitHub API docs
- Architecture: HIGH - Clear patterns from Phase 1, incremental extensions, validated design decisions from CONTEXT.md
- Pitfalls: HIGH - Deleted line constraint verified in official GitHub discussions, hunk boundary issues documented in community reports

**Research date:** 2026-02-04
**Valid until:** 2026-04-04 (60 days - stable feature since 2020, unlikely to change)
