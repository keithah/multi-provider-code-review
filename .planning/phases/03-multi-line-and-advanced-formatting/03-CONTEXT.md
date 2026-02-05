# Phase 3: Multi-Line and Advanced Formatting - Context

**Gathered:** 2026-02-04
**Status:** Ready for planning

<domain>
## Phase Boundary

Extend GitHub suggestion formatting to handle multi-line code replacements (2-50 consecutive lines) with strict validation against diff structure. Suggestions must span only RIGHT-side (new/modified) lines within single hunks. Batch commit support enables developers to apply multiple suggestions together.

</domain>

<decisions>
## Implementation Decisions

### Line range selection
- Trust LLM-specified line ranges exactly (no auto-expansion to logical blocks)
- Fail entire suggestion if any line in range is invalid (no truncation/salvaging)
- Require consecutive lines only (no gaps - non-consecutive ranges become separate suggestions)
- Maximum 50-line span per suggestion (matches Phase 2 sanity limit for consistency)

### Deletion edge cases
- RIGHT side only (strict): All lines in multi-line suggestion must exist on RIGHT side of diff
- Validate hunk boundaries: Multi-line suggestions cannot cross non-contiguous hunks
- Treat first/last file lines normally (no special boundary validation)
- Skip deletion-only files entirely (no suggestions for files with zero added lines)

### Batch commit UX
- Support GitHub's native batch commit feature (apply multiple suggestions at once)
- Let GitHub handle conflicts (trust platform's conflict detection for overlapping suggestions)
- Order suggestions by file position (top-to-bottom, matching code reading order)
- Trust GitHub's native preview flow (rely on built-in "Commit suggestion" preview, no custom logic)

### Claude's Discretion
- Exact hunk boundary detection algorithm
- Error messages for rejected suggestions
- Performance optimizations for validation

</decisions>

<specifics>
## Specific Ideas

- Phase 2's 50-line limit should carry forward for consistency
- GitHub's suggestion UI already handles previews well - lean on platform capabilities

</specifics>

<deferred>
## Deferred Ideas

None - discussion stayed within phase scope

</deferred>

---

*Phase: 03-multi-line-and-advanced-formatting*
*Context gathered: 2026-02-04*
