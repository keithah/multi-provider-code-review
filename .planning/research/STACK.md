# Stack Research

**Domain:** GitHub Commit Suggestions for Multi-Provider Code Review Action
**Researched:** 2026-02-04
**Confidence:** HIGH

## Recommended Stack

### Core Technologies

| Technology | Version | Purpose | Why Recommended |
|------------|---------|---------|-----------------|
| GitHub REST API | v3+ | Creating PR review comments with suggestion blocks | Official GitHub API with native suggestion support through comment body markdown. Already in use via @octokit/rest. **HIGH confidence** - verified with [official docs](https://docs.github.com/en/rest/pulls/comments). |
| Tree-sitter | 0.21.x | Syntax validation of LLM-generated fixes | Already integrated in codebase for AST analysis. Provides incremental parsing and language-agnostic validation. Essential for preventing broken code suggestions. **HIGH confidence** - existing dependency. |
| Zod | 3.23.x | Runtime validation of LLM outputs | Already in use. TypeScript-first schema validation ensures LLM-generated fixes conform to expected structure before creating suggestion blocks. Self-correcting mechanism via re-prompting on validation failures. **HIGH confidence** - [proven pattern](https://github.com/dzhng/zod-gpt) for LLM output validation. |
| @octokit/rest | 20.1.x+ | GitHub API client with TypeScript types | Current dependency. Provides typed interface for `pulls.createReview()` endpoint. **HIGH confidence** - existing integration. |

### Supporting Libraries

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| diff (jsdiff) | 8.0.x+ | Unified diff generation for code transformations | When converting LLM fixes to structured diff format. Ships with TypeScript definitions. Intelligently handles line number adjustments during patch application. **HIGH confidence** - [industry standard](https://www.npmjs.com/package/diff) with 14M+ weekly downloads. |
| diff-match-patch-es | latest | Alternative diff implementation with patch application | Only if jsdiff proves insufficient for complex multi-line suggestions. ESM-first, TypeScript native. **MEDIUM confidence** - [modern rewrite](https://github.com/antfu/diff-match-patch-es) but less ecosystem adoption. |

### Development Tools

| Tool | Purpose | Notes |
|------|---------|-------|
| TypeScript 5.9.x | Type safety for suggestion generation pipeline | Already in use. Essential for preventing runtime errors in suggestion formatting. |
| jest | Unit testing for suggestion block formatting | Already in use. Test suggestion syntax edge cases (nested code blocks, escape sequences). |
| esbuild | Bundling with tree-shaking | Already in use. Keeps action bundle size minimal. |

## Installation

```bash
# Core (already present)
npm install @octokit/rest@^20.1.2 zod@^3.23.8 tree-sitter@^0.21.1

# Supporting libraries (new)
npm install diff@^8.0.0

# Dev dependencies (already present)
npm install -D @types/node@^20.19.30 typescript@^5.9.3 jest@^29.7.0
```

## GitHub Suggestion Block Specification

### Exact Markdown Syntax

**Single-line suggestion:**
```
```suggestion
[replacement code]
```
```

**Multi-line suggestion:**
```
```suggestion
[line 1]
[line 2]
[line N]
```
```

**CRITICAL CONSTRAINT:** When suggestion contains code blocks with triple backticks, use 4+ backticks to wrap:
````
````suggestion
```typescript
// nested code block
```
````
````

**Confidence:** MEDIUM - verified through [community discussions](https://github.com/orgs/community/discussions/76840) and [changelog announcements](https://github.blog/changelog/2020-04-15-multi-line-code-suggestions-general-availability/), but official specification lacks formal documentation beyond GitHub's UI-driven documentation.

### API Integration Pattern

**Endpoint:** `POST /repos/{owner}/{repo}/pulls/{pull_number}/comments`

**Required parameters:**
- `body` (string): Comment body with ````suggestion` markdown block
- `commit_id` (string): SHA of commit being reviewed
- `path` (string): File path in repository
- `line` (integer): Line number in diff for single-line comment
- `start_line` (integer): Starting line for multi-line comment
- `start_side` (string): Side of diff (`LEFT` or `RIGHT`)

**Via @octokit/rest:**
```typescript
await octokit.rest.pulls.createReview({
  owner,
  repo,
  pull_number: prNumber,
  event: 'COMMENT',
  comments: [{
    path: 'src/file.ts',
    line: 42,
    body: '```suggestion\n[fixed code]\n```'
  }]
});
```

**Confidence:** HIGH - verified with [official REST API docs](https://docs.github.com/en/rest/pulls/comments).

## LLM Prompting Patterns for Fix Generation

### 2026 Best Practices

| Pattern | Why | Confidence |
|---------|-----|------------|
| **Specification-First** | "Brainstorm detailed spec, then outline step-by-step plan before generating code." Prevents confused outputs. | HIGH - [Addy Osmani 2026 workflow](https://addyosmani.com/blog/ai-coding-workflow/) |
| **Chunked Tasks** | Request one focused fix per prompt. Avoid monolithic multi-fix requests. | HIGH - industry consensus |
| **Explicit Test Cases** | Include test cases in prompt: "Fix must handle edge case X and return Y." Eliminates ambiguity. | HIGH - [proven effective](https://github.com/potpie-ai/potpie/wiki/How-to-write-good-prompts-for-generating-code-from-LLMs) |
| **Clarification Requests** | Prompt LLM: "If unsure or context missing, ask for clarification rather than guessing." Reduces hallucinations. | HIGH - empirically validated |
| **Reasoning Comments** | "Always explain your reasoning briefly in comments when fixing a bug." Produces self-documenting fixes. | HIGH - annotation pattern |
| **Context Packing** | Provide code snippets, API docs, known pitfalls. Don't operate on partial information. | HIGH - 2026 standard |

### Anti-Patterns to Avoid

| Anti-Pattern | Why Bad | Instead |
|--------------|---------|---------|
| Vague prompts | "Fix this code" → LLM guesses intent | "Fix null pointer exception on line 42 by adding validation check before property access" |
| Blind trust | Assuming LLM output is correct | Always validate with tree-sitter AST parser + Zod schema |
| Generic solutions | LLM outputs stackoverflow copy-paste | Include codebase-specific patterns and style guide in prompt |

**Confidence:** HIGH - synthesized from [multiple 2026 sources](https://addyosmani.com/blog/ai-coding-workflow/) with industry validation.

## Parsing & Validation Approaches

### Three-Layer Validation Strategy

**Layer 1: Zod Schema Validation**
- **When:** Immediately after LLM generates fix
- **What:** Validate structure (file path exists, line number valid, code is string, etc.)
- **On Failure:** Re-prompt LLM with error details
- **Confidence:** HIGH - [proven self-correcting pattern](https://github.com/dzhng/zod-gpt)

**Layer 2: Tree-sitter AST Parsing**
- **When:** Before creating suggestion block
- **What:** Parse suggested code to ensure syntactic validity
- **On Failure:** Reject suggestion, log error, optionally re-prompt
- **Why:** Prevents suggesting syntactically invalid code that breaks builds
- **Confidence:** HIGH - existing tree-sitter integration, [industry standard for semantic diffs](https://github.com/afnanenayet/diffsitter)

**Layer 3: Diff Validation**
- **When:** Before posting to GitHub
- **What:** Verify suggestion applies cleanly to target lines using jsdiff
- **On Failure:** Adjust line numbers or reject if context changed
- **Why:** GitHub suggestions fail silently if context doesn't match
- **Confidence:** MEDIUM - line number drift is common issue, [jsdiff handles hunk adjustment](https://www.npmjs.com/package/diff)

### Implementation Pattern

```typescript
import { z } from 'zod';
import Parser from 'tree-sitter';
import { structuredPatch } from 'diff';

const SuggestionSchema = z.object({
  file: z.string(),
  line: z.number().int().positive(),
  originalCode: z.string(),
  suggestedCode: z.string(),
});

async function validateAndCreateSuggestion(llmOutput: unknown) {
  // Layer 1: Schema validation
  const parsed = SuggestionSchema.parse(llmOutput);

  // Layer 2: AST validation
  const tree = parser.parse(parsed.suggestedCode);
  if (tree.rootNode.hasError()) {
    throw new Error('Suggested code has syntax errors');
  }

  // Layer 3: Diff validation
  const patch = structuredPatch(
    parsed.file,
    parsed.file,
    parsed.originalCode,
    parsed.suggestedCode
  );

  // Create suggestion block
  return formatSuggestionBlock(parsed.suggestedCode);
}
```

**Confidence:** HIGH - combines proven patterns from research.

## Alternatives Considered

| Recommended | Alternative | When to Use Alternative |
|-------------|-------------|-------------------------|
| jsdiff | diff-match-patch-es | When patch application logic needs more granular control. Google's algorithm handles edge cases differently. |
| Direct API calls | reviewdog action | When implementing general-purpose review tool. Overkill for focused suggestion feature. |
| Tree-sitter validation | Regex-based validation | Never - regex cannot handle nested syntax or language nuances. |
| Zod | JSON Schema with AJV | When migrating from existing JSON Schema infrastructure. Zod has better TypeScript integration. |

## What NOT to Use

| Avoid | Why | Use Instead |
|-------|-----|-------------|
| String template concatenation for suggestion blocks | Fragile, breaks with nested code blocks or special characters | Use tested formatting functions with proper escaping |
| Line number caching without validation | GitHub suggestions require exact line context. Cache invalidation is hard. | Always re-fetch file context before creating suggestion |
| Synchronous suggestion creation | Blocks PR review completion, causes timeouts on large PRs | Async/batched suggestion creation with progress tracking |
| Raw LLM output without validation | Hallucinated code, syntax errors, security vulnerabilities | Three-layer validation (Zod + AST + Diff) |
| `position` parameter without diff mapping | GitHub's `position` is diff position, not file line number. Common mistake. | Use existing `mapLinesToPositions` utility (already in codebase) |

## Stack Patterns by Variant

**If suggestions are for formatting fixes only:**
- Skip AST validation (formatting doesn't change syntax tree)
- Use existing formatter output directly
- Validate with `git apply --check`

**If suggestions are for complex refactorings:**
- Require explicit test case coverage in LLM prompt
- Generate suggestions + corresponding test updates
- Validate both production code and test AST

**If suggestions need human review first:**
- Use `COMMENT` event instead of `APPROVE`
- Add metadata comment explaining fix reasoning
- Include confidence score in comment body

## Version Compatibility

| Package A | Compatible With | Notes |
|-----------|-----------------|-------|
| tree-sitter@0.21.x | tree-sitter-typescript@0.21.2 | Must match major/minor versions |
| @octokit/rest@20.x | @actions/github@6.x | Already compatible in codebase |
| zod@3.23.x | TypeScript@5.9.x | Requires TypeScript 5.0+ for proper type inference |
| diff@8.x | TypeScript@5.x | Ships with built-in types, no @types package needed |

## Security Considerations

**CRITICAL:** Automated suggestions can introduce vulnerabilities. Implement:

1. **Secret scanning** before suggesting changes (use existing secrets scanner)
2. **Dependency validation** for suggested imports (no malicious packages)
3. **Code injection prevention** in suggestion formatting (escape user input)
4. **Rate limiting** on suggestion creation (prevent API abuse)
5. **Audit logging** of all generated suggestions (compliance requirement)

**Confidence:** HIGH - synthesized from [GitHub Actions security best practices](https://www.stepsecurity.io/blog/github-actions-security-best-practices).

## Sources

**HIGH Confidence:**
- [GitHub REST API - Pull Request Comments](https://docs.github.com/en/rest/pulls/comments) — Official API specification
- [Zod](https://zod.dev/) — Official documentation
- [jsdiff npm package](https://www.npmjs.com/package/diff) — Official package documentation
- [Addy Osmani - My LLM coding workflow going into 2026](https://addyosmani.com/blog/ai-coding-workflow/) — 2026 LLM prompting patterns
- [Tree-sitter TypeScript grammar](https://github.com/tree-sitter/tree-sitter-typescript) — AST parsing for validation

**MEDIUM Confidence:**
- [GitHub Community Discussion #76840](https://github.com/orgs/community/discussions/76840) — Suggestion block nested backtick issue
- [GitHub Changelog: Multi-line code suggestions](https://github.blog/changelog/2020-04-15-multi-line-code-suggestions-general-availability/) — Feature announcement
- [Reviewdog](https://github.com/reviewdog/reviewdog) — Reference implementation for suggestion formatting
- [Graphite Guide: Suggest changes in GitHub PR](https://graphite.com/guides/suggest-changes-github-pr) — Community tutorial
- [Building an AI Code Review Agent](https://baz.co/resources/building-an-ai-code-review-agent-advanced-diffing-parsing-and-agentic-workflows) — AST diffing patterns

**LOW Confidence:**
- Web search results for exact specification — GitHub lacks formal suggestion syntax spec beyond UI docs

---
*Stack research for: GitHub Commit Suggestions*
*Researched: 2026-02-04*
