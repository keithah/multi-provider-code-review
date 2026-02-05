# Architecture Research

**Domain:** GitHub Commit Suggestions for Code Review Findings
**Researched:** 2026-02-04
**Confidence:** HIGH

## Standard Architecture

### System Overview

```
┌─────────────────────────────────────────────────────────────────────┐
│                    ORCHESTRATION LAYER                              │
│  ReviewOrchestrator.executeReview(pr) → Review                      │
├─────────────────────────────────────────────────────────────────────┤
│                    ANALYSIS PIPELINE                                │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐             │
│  │ LLM Analysis │  │ AST Analysis │  │   Security   │             │
│  │  (Batched)   │  │   (Static)   │  │   Scanner    │             │
│  └──────┬───────┘  └──────┬───────┘  └──────┬───────┘             │
│         │                  │                  │                      │
│         └──────────────────┴──────────────────┘                      │
│                            ↓                                         │
│  ┌──────────────────────────────────────────────────────┐           │
│  │         Finding Detection & Deduplication             │           │
│  │     (Deduplicator → Consensus → Filter)               │           │
│  └──────────────────────┬───────────────────────────────┘           │
├────────────────────────┼─────────────────────────────────────────────┤
│                        ↓    NEW: FIX GENERATION LAYER               │
│  ┌──────────────────────────────────────────────────────┐           │
│  │  Fix Generation (via LLM prompts in analysis phase)   │           │
│  │  - Already embedded in Finding.suggestion field       │           │
│  │  - Extracted during LLM parsing                       │           │
│  └──────────────────────┬───────────────────────────────┘           │
├────────────────────────┼─────────────────────────────────────────────┤
│                        ↓    SYNTHESIS & ENRICHMENT                  │
│  ┌──────────────────────────────────────────────────────┐           │
│  │  SynthesisEngine.synthesize() → Review               │           │
│  │  - Enriches findings with evidence, metrics          │           │
│  │  - Builds inline comments from findings              │           │
│  └──────────────────────┬───────────────────────────────┘           │
├────────────────────────┼─────────────────────────────────────────────┤
│                        ↓    NEW: SUGGESTION FORMATTING LAYER        │
│  ┌──────────────────────────────────────────────────────┐           │
│  │  SuggestionFormatter (NEW COMPONENT)                  │           │
│  │  - Takes Finding.suggestion (text)                    │           │
│  │  - Extracts original code from file context          │           │
│  │  - Formats as GitHub ```suggestion block             │           │
│  │  - Returns formatted markdown string                 │           │
│  └──────────────────────┬───────────────────────────────┘           │
├────────────────────────┼─────────────────────────────────────────────┤
│                        ↓    MARKDOWN FORMATTING                     │
│  ┌──────────────────────────────────────────────────────┐           │
│  │  MarkdownFormatter.format() → string                  │           │
│  │  - EXTENDED: Calls SuggestionFormatter when needed   │           │
│  │  - Embeds suggestion blocks in comment bodies        │           │
│  └──────────────────────┬───────────────────────────────┘           │
├────────────────────────┼─────────────────────────────────────────────┤
│                        ↓    GITHUB POSTING                          │
│  ┌──────────────────────────────────────────────────────┐           │
│  │  CommentPoster.postInline() → void                    │           │
│  │  - Posts markdown with embedded suggestion blocks    │           │
│  │  - GitHub renders commit suggestion buttons          │           │
│  └──────────────────────────────────────────────────────┘           │
└─────────────────────────────────────────────────────────────────────┘
```

### Component Responsibilities

| Component | Responsibility | Typical Implementation |
|-----------|----------------|------------------------|
| **PromptBuilder** | Generate LLM prompts with fix instructions | Extend existing prompt template to request fixes alongside findings |
| **LLMExecutor** | Execute prompts across providers | No change needed - already handles responses |
| **LLM Parser** | Extract findings + suggestions from responses | Extend to parse `suggestion` field from JSON/markdown responses |
| **SuggestionFormatter** (NEW) | Convert Finding.suggestion to GitHub syntax | New utility class: `formatSuggestionBlock(finding, fileContent)` |
| **MarkdownFormatter** | Format review output as markdown | Extend `commentBody()` to include suggestion blocks |
| **SynthesisEngine** | Build inline comments from findings | Extend `commentBody()` to call SuggestionFormatter when Finding.suggestion exists |
| **CommentPoster** | Post formatted markdown to GitHub | No change needed - already posts markdown strings |

## Recommended Project Structure

```
src/
├── analysis/
│   ├── llm/
│   │   ├── prompt-builder.ts    # EXTEND: Add fix generation instructions
│   │   ├── parser.ts            # EXTEND: Parse suggestion field from responses
│   │   └── executor.ts          # No change needed
│   └── synthesis.ts             # EXTEND: Call SuggestionFormatter in commentBody()
├── output/
│   ├── formatter.ts             # EXTEND: Format suggestion blocks in findings
│   ├── suggestion-formatter.ts  # NEW: GitHub suggestion block formatting logic
│   └── formatter-v2.ts          # EXTEND: Same changes as formatter.ts
├── github/
│   └── comment-poster.ts        # No change needed - already posts markdown
├── types/
│   └── index.ts                 # VERIFY: Finding.suggestion already exists
└── utils/
    └── code-snippet.ts          # EXTEND: Extract original code for suggestion context
```

### Structure Rationale

- **analysis/llm/prompt-builder.ts:** Central place for LLM prompt templates. Extending here ensures all providers get fix generation instructions uniformly.
- **analysis/llm/parser.ts:** Already extracts findings from LLM responses. Natural place to parse suggestion fields.
- **output/suggestion-formatter.ts:** New isolated component handles GitHub syntax complexity (escaping, multi-line, context extraction). Keeps formatting logic separate from markdown generation.
- **output/formatter.ts:** Already formats findings into markdown. Extends to include suggestion blocks when available.
- **analysis/synthesis.ts:** Orchestrates finding → inline comment transformation. Logical place to inject suggestion formatting.

## Architectural Patterns

### Pattern 1: Single-Pass Fix Generation

**What:** Generate fix suggestions during the initial LLM review pass, not as a separate phase.

**When to use:** When fix quality doesn't require additional context beyond what the LLM already sees during review.

**Trade-offs:**
- ✓ Faster: Single LLM round-trip
- ✓ Simpler: No state management between phases
- ✗ Less flexible: Can't use different models for finding vs fixing

**Example:**
```typescript
// In PromptBuilder.build()
const instructions = [
  'Return JSON: [{file, line, severity, title, message, suggestion}]',
  '',
  'For each finding, include a "suggestion" field with the corrected code.',
  'Only include suggestion if you can provide a specific fix.',
  ''
];
```

### Pattern 2: Format-Time Suggestion Assembly

**What:** Assemble suggestion blocks during markdown formatting, not during finding creation.

**When to use:** When you need file context (original code) that's not available during analysis.

**Trade-offs:**
- ✓ Access to full file content for multi-line suggestions
- ✓ Can validate suggestion against actual code
- ✗ Formatting becomes more complex
- ✗ Need to handle file content retrieval

**Example:**
```typescript
// In SuggestionFormatter
formatSuggestionBlock(finding: Finding, fileContent: string): string {
  if (!finding.suggestion) return '';

  const originalCode = extractCodeSnippet(fileContent, finding.line, 1);

  return [
    '',
    '```suggestion',
    finding.suggestion,
    '```',
    ''
  ].join('\n');
}
```

### Pattern 3: Graceful Degradation

**What:** Display finding even when suggestion generation fails or isn't available.

**When to use:** Always - suggestions are enhancement, not requirement.

**Trade-offs:**
- ✓ Never lose findings due to fix generation failures
- ✓ Works with LLMs that don't generate fixes well
- ✓ Maintains backward compatibility

**Example:**
```typescript
// In SynthesisEngine.commentBody()
private commentBody(finding: Finding): string {
  const parts = [`**${finding.title}**`, finding.message];

  // Try to add suggestion block if available
  if (finding.suggestion) {
    const suggestionBlock = this.formatSuggestion(finding);
    if (suggestionBlock) {
      parts.push('', suggestionBlock);
    }
  }

  // Always include base finding info
  if (finding.providers && finding.providers.length > 1) {
    parts.push('', `Providers: ${finding.providers.join(', ')}`);
  }

  return parts.join('\n');
}
```

## Data Flow

### Request Flow (Finding Detection → Suggestion Generation → GitHub Posting)

```
[PR Diff]
    ↓
[PromptBuilder] → Build prompt with fix instructions
    ↓
[LLM Providers] → Analyze code and generate findings + suggestions
    ↓
[LLM Parser] → Extract findings with suggestion field
    ↓
[Deduplicator/Consensus] → Filter to high-confidence findings
    ↓
[SynthesisEngine] → Build InlineComment[] from Finding[]
    ↓                  (calls formatSuggestion() if Finding.suggestion exists)
[MarkdownFormatter] → Format comments as markdown strings
    ↓                   (embeds GitHub suggestion blocks)
[CommentPoster] → Post to GitHub PR
    ↓
[GitHub UI] → Renders "Commit suggestion" button
```

### Suggestion Block Assembly Flow

```
[Finding with suggestion text]
    ↓
[SuggestionFormatter.formatSuggestionBlock()]
    ↓
├─ Extract original code from file content (finding.line)
├─ Validate suggestion is different from original
├─ Determine single-line vs multi-line format
├─ Escape code if contains triple backticks (use ~~~)
└─ Build GitHub suggestion markdown
    ↓
[Return formatted suggestion block string]
    ↓
[Embed in InlineComment.body markdown]
```

### Key Data Flows

1. **Prompt → LLM → Finding:** PromptBuilder includes fix instructions → LLM returns `{suggestion: "fixed code"}` → Parser extracts into Finding.suggestion field
2. **Finding → Suggestion Block:** SynthesisEngine calls SuggestionFormatter → Formatter extracts original code → Builds GitHub markdown → Returns string
3. **Comment Assembly:** SynthesisEngine.commentBody() → Combines title + message + suggestion block → Returns complete markdown → CommentPoster sends to GitHub

## Scaling Considerations

| Scale | Architecture Adjustments |
|-------|--------------------------|
| 0-100 PRs/day | Current architecture sufficient - suggestion formatting adds negligible overhead |
| 100-1000 PRs/day | Cache file content retrieval in SuggestionFormatter to avoid redundant GitHub API calls |
| 1000+ PRs/day | Consider pre-fetching file contents during PR loading phase to parallelize with analysis |

### Scaling Priorities

1. **First bottleneck:** File content retrieval for multi-line suggestions - cache at orchestrator level, pass to formatter
2. **Second bottleneck:** LLM response parsing if suggestion field is complex - validate schema upfront, fail fast on invalid formats

## Anti-Patterns

### Anti-Pattern 1: Two-Phase Fix Generation

**What people do:** Run initial review to detect findings, then make separate LLM calls to generate fixes for each finding.

**Why it's wrong:**
- Doubles LLM costs and latency
- Requires state management between phases
- LLM sees less context in second phase (isolated finding vs full diff)

**Do this instead:** Include fix generation instructions in the initial review prompt. Parse both findings and suggestions in one pass.

### Anti-Pattern 2: Suggestion-Only on Success

**What people do:** Only post finding to GitHub if suggestion was successfully generated.

**Why it's wrong:**
- Loses valuable findings when LLM can't generate fix
- Creates inconsistent review output (some findings disappear)
- Makes debugging harder (can't see what LLM detected)

**Do this instead:** Always post the finding. Add suggestion block only when available. Use clear markdown to show when suggestion is missing ("No automatic fix available").

### Anti-Pattern 3: Direct Code Modification

**What people do:** Implement custom logic to apply fixes automatically or create new commits.

**Why it's wrong:**
- Bypasses review process (dangerous for AI-generated code)
- Requires complex git operations and permissions
- GitHub already provides this via suggestion blocks

**Do this instead:** Use GitHub's native `\`\`\`suggestion` syntax. GitHub handles commit creation, permissions, and UI. Just format the markdown correctly.

### Anti-Pattern 4: Complex Suggestion Validation

**What people do:** Implement AST parsing, syntax checking, or compilation of suggested fixes before posting.

**Why it's wrong:**
- Adds significant complexity and dependencies
- Slows down review posting
- False negatives hide valid suggestions
- Developers review suggestions anyway before committing

**Do this instead:** Basic sanity checks only (non-empty, different from original). Let developers validate via GitHub's review UI. Trust GitHub's suggestion workflow.

## Integration Points

### External Services

| Service | Integration Pattern | Notes |
|---------|---------------------|-------|
| GitHub API | REST via @octokit/rest | Already integrated - CommentPoster.postInline() posts markdown |
| LLM Providers | Provider interface abstraction | Already abstracted - PromptBuilder changes apply to all providers |
| File Storage | GitHub blob API | Needed for multi-line context - use GitHubClient.getFileContent() |

### Internal Boundaries

| Boundary | Communication | Notes |
|----------|---------------|-------|
| Analysis ↔ Output | Finding objects with suggestion field | Clean boundary - output layer reads Finding.suggestion, doesn't call back to analysis |
| Output ↔ GitHub | Markdown strings | Clean boundary - formatter produces strings, poster sends them without parsing |
| LLM ↔ Parser | String responses → Finding[] | Extend parser schema to include optional suggestion field in JSON |
| Formatter ↔ SuggestionFormatter | Finding + file content → suggestion block string | New boundary - keeps suggestion logic isolated from general markdown formatting |

## Build Order (Implementation Sequence)

Based on component dependencies, build in this order:

### Phase 1: Foundation (No dependencies)
**Output:** Suggestion formatting infrastructure without LLM integration

1. **Create SuggestionFormatter class** (`src/output/suggestion-formatter.ts`)
   - `formatSuggestionBlock(finding: Finding, fileContent: string): string`
   - Handles single-line suggestions (simple case)
   - Returns GitHub markdown `\`\`\`suggestion` blocks
   - Unit tests with mock findings

2. **Verify Finding.suggestion field** (`src/types/index.ts`)
   - Confirm `Finding` interface has `suggestion?: string`
   - Already exists in codebase - no changes needed

### Phase 2: LLM Integration (Depends on Phase 1)
**Output:** LLMs generate suggestions, stored in Finding objects

3. **Extend PromptBuilder** (`src/analysis/llm/prompt-builder.ts`)
   - Add fix generation instructions to prompt template
   - Update `build()` to include suggestion field in output schema
   - Test prompts with sample diffs

4. **Extend LLM Parser** (`src/analysis/llm/parser.ts`)
   - Parse `suggestion` field from LLM JSON/markdown responses
   - Handle missing/malformed suggestions gracefully
   - Unit tests with sample LLM responses

### Phase 3: Formatting Integration (Depends on Phases 1-2)
**Output:** Findings with suggestions render as suggestion blocks

5. **Extend SynthesisEngine** (`src/analysis/synthesis.ts`)
   - Modify `commentBody()` to call SuggestionFormatter when `finding.suggestion` exists
   - Pass file content to formatter (from PRContext)
   - Fallback to description-only when suggestion unavailable

6. **Extend MarkdownFormatter** (`src/output/formatter.ts`)
   - Update `printSeveritySection()` to include suggestion blocks
   - Ensure suggestion blocks render in summary comments
   - Test formatting output manually with sample findings

### Phase 4: Multi-line Support (Depends on Phases 1-3)
**Output:** Multi-line code replacements formatted correctly

7. **Extend SuggestionFormatter for multi-line**
   - Detect multi-line suggestions (newlines in Finding.suggestion)
   - Extract multi-line original code context
   - Handle edge cases (code fence escaping with `~~~`)

8. **Add file content caching** (if needed for performance)
   - Cache file contents in orchestrator or synthesis phase
   - Pass cached content to formatters to avoid redundant API calls

### Dependency Rationale

- **Phase 1 before Phase 2:** Can test suggestion formatting in isolation before LLMs generate real suggestions
- **Phase 2 before Phase 3:** Need LLMs producing suggestions before formatting can display them
- **Phase 3 before Phase 4:** Get single-line working end-to-end before adding multi-line complexity
- **Phase 4 last:** Multi-line is enhancement - system works with single-line only

### Validation Gates Between Phases

- **After Phase 1:** Unit tests pass for SuggestionFormatter with mock data
- **After Phase 2:** LLM responses include suggestion field in 70%+ of findings
- **After Phase 3:** Manual test shows suggestion blocks in GitHub PR comments with commit button
- **After Phase 4:** Multi-line suggestions render correctly with proper escaping

## Sources

- **GitHub Suggestion Block Documentation:**
  - [Reviewing proposed changes in a pull request - GitHub Docs](https://docs.github.com/articles/reviewing-proposed-changes-in-a-pull-request)
  - [How to suggest changes in a GitHub pull request - Graphite](https://graphite.com/guides/suggest-changes-github-pr)
  - [Multi-line code suggestions beta - GitHub Changelog](https://github.blog/changelog/2020-02-26-multi-line-code-suggestions-beta/)

- **Existing Codebase Analysis:**
  - `/Users/keith/src/multi-provider-code-review/src/core/orchestrator.ts` - Review pipeline flow
  - `/Users/keith/src/multi-provider-code-review/src/output/formatter.ts` - Markdown formatting
  - `/Users/keith/src/multi-provider-code-review/src/analysis/synthesis.ts` - Finding → comment transformation
  - `/Users/keith/src/multi-provider-code-review/src/types/index.ts` - Finding interface (suggestion field already exists)
  - `/Users/keith/src/multi-provider-code-review/src/autofix/prompt-generator.ts` - Related fix prompt generation (different use case - AI IDE prompts, not GitHub suggestions)

---
*Architecture research for: GitHub Commit Suggestions Integration*
*Researched: 2026-02-04*
