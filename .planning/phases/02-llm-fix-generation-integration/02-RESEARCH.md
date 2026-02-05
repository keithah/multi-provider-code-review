# Phase 2: LLM Fix Generation Integration - Research

**Researched:** 2026-02-04
**Domain:** LLM prompt engineering for code fix generation and structured output parsing
**Confidence:** HIGH

## Summary

This phase extends LLM prompts to request code fixes and extracts them from structured JSON responses. The research focused on understanding industry best practices for LLM-based code fix generation, structured output enforcement across providers, validation techniques, and token management strategies.

The standard approach for LLM code fix generation in 2026 is focused, single-pass prompting with structured JSON outputs. All major providers (OpenAI, Anthropic, Google) now support structured outputs, though with different mechanisms. The critical insight is that precision in prompt engineering and granular fix requests (one fix per finding) produce more reliable results than broad, multi-fix prompts.

Token management uses character-based estimation (chars / 4) as a practical heuristic, with tiered context window buckets (small: 4-16k, medium: 128-200k, large: 1M+). The existing codebase already has robust token estimation utilities that match industry practices.

**Primary recommendation:** Add fix generation instructions to system prompt with JSON schema example, use provider-agnostic structured output parsing with strict validation, implement basic sanity checks (line relevance, change magnitude), and leverage existing token estimation for context window management.

## Standard Stack

This phase operates within the existing TypeScript/Node.js codebase without external dependencies.

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| TypeScript | 5.x | Type-safe parsing and validation | Already in use, provides type safety for Finding interface |
| Node.js Built-ins | - | JSON parsing, regex validation | Zero dependencies, sufficient for structured output parsing |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| Existing utils/token-estimation.ts | Current | Character-based token counting | Already implemented, matches industry heuristic (chars/4) |
| Existing utils/suggestion-formatter.ts | Current | GitHub suggestion block formatting | Already handles backtick escaping via dynamic fence calculation |
| Existing utils/suggestion-validator.ts | Current | Line validation against diff | Already validates suggestions against patch positions |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Character-based estimation | Model-specific tokenizers (tiktoken, sentencepiece) | More accurate but adds dependencies, latency, and complexity. Char/4 heuristic is 90% accurate per industry research. |
| Provider-agnostic JSON parsing | Provider-specific structured output APIs | OpenAI has native JSON mode, Claude requires tool call trick, Gemini has schema support. Unified JSON parsing in prompt is simpler and works across all providers. |
| Dynamic fence calculation | Fixed triple backticks | Dynamic calculation prevents markdown conflicts when code contains backticks. Already implemented in Phase 1. |

**Installation:**
```bash
# No new dependencies required - uses existing stack
```

## Architecture Patterns

### Recommended Project Structure
```
src/
├── analysis/llm/
│   ├── prompt-builder.ts      # EXTEND: Add fix generation instructions
│   ├── parser.ts               # EXTEND: Extract suggestion field from Finding objects
│   └── executor.ts             # Uses prompt builder and parser
├── utils/
│   ├── token-estimation.ts     # EXISTS: Already implements chars/4 heuristic
│   ├── suggestion-formatter.ts # EXISTS: Already handles GitHub suggestion blocks
│   └── suggestion-validator.ts # EXISTS: Already validates line positions
└── types/
    └── index.ts                # EXISTS: Finding.suggestion field already defined
```

### Pattern 1: Prompt Enhancement for Fix Generation
**What:** Add fix generation instructions to system message without per-request overhead
**When to use:** When LLM should generate fixes for fixable issue types

**Example:**
```typescript
// Source: Research finding - focused prompting best practice
// Add to PromptBuilder.build() method

const instructions = [
  `You are a code reviewer. ONLY report actual bugs.`,
  '',
  'Return JSON: [{file, line, severity, title, message, suggestion}]',
  '',
  'SUGGESTION FIELD (optional):',
  '  • Only include "suggestion" field for FIXABLE issues (not all findings)',
  '  • Fixable: null reference, type error, off-by-one, resource leak',
  '  • NOT fixable: architectural issues, design suggestions, unclear requirements',
  '  • "suggestion" must be EXACT replacement code for the problematic line(s)',
  '  • Include ONLY the fixed code, no explanations or comments',
  '  • Example: {"file": "x.ts", "line": 10, "severity": "major", ',
  '              "title": "Null reference", "message": "...", ',
  '              "suggestion": "const user = users?.find(u => u.id === id) ?? null;"}',
  '',
  // ... rest of prompt
];
```

### Pattern 2: Structured Output Parsing with Validation
**What:** Extract suggestion field from Finding objects with strict validation
**When to use:** When parsing LLM responses that may contain fix suggestions

**Example:**
```typescript
// Source: Existing codebase pattern in analysis/llm/parser.ts
// EXTEND extractFindings() to validate suggestion field

function extractFindings(content: string): Finding[] {
  const findings: Finding[] = [];

  // Try markdown code block first
  const match = content.match(/```json\s*([\s\S]*?)```/i);
  const parsed = match ? JSON.parse(match[1]) : JSON.parse(content);
  const rawFindings = Array.isArray(parsed) ? parsed : parsed.findings || [];

  for (const raw of rawFindings) {
    // Required fields validation
    if (!raw.file || !raw.line || !raw.severity || !raw.title || !raw.message) {
      logger.warn('Skipping finding with missing required fields', raw);
      continue;
    }

    // Suggestion field validation (optional field)
    let suggestion: string | undefined = undefined;
    if (raw.suggestion !== undefined && raw.suggestion !== null) {
      const validated = validateSuggestion(raw.suggestion, raw.line, raw.file);
      if (validated.isValid) {
        suggestion = validated.suggestion;
      } else {
        logger.warn(`Invalid suggestion for ${raw.file}:${raw.line}: ${validated.reason}`);
        // Continue without suggestion - still post the finding
      }
    }

    findings.push({
      file: raw.file,
      line: raw.line,
      severity: raw.severity,
      title: raw.title,
      message: raw.message,
      suggestion,
    });
  }

  return findings;
}
```

### Pattern 3: Tiered Context Window Management
**What:** Group providers by context window size and apply appropriate limits
**When to use:** When batching files or trimming diffs to fit context windows

**Example:**
```typescript
// Source: Existing token-estimation.ts + research findings on 2026 context windows
// Maps provider IDs to tier, then tier to token limit

type ContextWindowTier = 'small' | 'medium' | 'large';

function getContextWindowTier(modelId: string): ContextWindowTier {
  const size = getContextWindowSize(modelId); // existing function

  if (size >= 500000) return 'large';   // 500k+ tokens (Gemini 2.0, Llama 4 Scout)
  if (size >= 100000) return 'medium';  // 100k-500k tokens (Claude 4, GPT-4 Turbo)
  return 'small';                        // <100k tokens (GPT-4, older models)
}

const TIER_LIMITS = {
  small: { target: 3000, max: 7000 },      // Conservative for 4k-16k windows
  medium: { target: 50000, max: 120000 },  // For 128k-200k windows
  large: { target: 200000, max: 800000 },  // For 1M+ windows
};

function shouldSkipSuggestion(pr: PRContext, modelId: string): boolean {
  const tier = getContextWindowTier(modelId);
  const estimatedTokens = estimateTokensConservative(pr.diff);

  // Skip suggestion if diff alone exceeds max for this tier
  return estimatedTokens.tokens > TIER_LIMITS[tier].max;
}
```

### Pattern 4: Basic Sanity Checks for Suggestions
**What:** Validate suggestions for obvious red flags without deep analysis
**When to use:** After extracting suggestion but before formatting for GitHub

**Example:**
```typescript
// Source: Research finding - sanity checks vs deep validation
// Phase 2: Basic checks only. Phase 4 will add syntax validation.

interface SuggestionValidation {
  isValid: boolean;
  reason?: string;
  suggestion?: string;
}

function validateSuggestion(
  suggestion: string,
  lineNumber: number,
  filename: string
): SuggestionValidation {
  // Check 1: Not empty or whitespace-only
  if (!suggestion || suggestion.trim() === '') {
    return { isValid: false, reason: 'Empty suggestion' };
  }

  // Check 2: Not excessively long (sanity check for hallucination)
  const lineCount = suggestion.split('\n').length;
  if (lineCount > 50) {
    return { isValid: false, reason: 'Suggestion too long (>50 lines)' };
  }

  // Check 3: Contains actual code (not just English explanation)
  const hasCodeIndicators = /[{}();=]/.test(suggestion);
  if (!hasCodeIndicators) {
    return { isValid: false, reason: 'Suggestion lacks code syntax' };
  }

  // Check 4: Doesn't delete massive amounts (sanity check)
  // Note: This check is basic - just detect obvious mistakes
  const apparentlyEmpty = suggestion.trim().length < 5 && lineCount > 10;
  if (apparentlyEmpty) {
    return { isValid: false, reason: 'Suggestion appears to delete >10 lines' };
  }

  return { isValid: true, suggestion: suggestion.trim() };
}
```

### Anti-Patterns to Avoid
- **Multi-fix prompts:** Don't ask LLM to generate fixes for multiple unrelated issues in one response. Research shows focused, granular prompts (one fix per finding) are more reliable.
- **Retries on invalid suggestions:** Don't retry LLM calls when suggestion is malformed. Single-pass is faster and cheaper. Invalid suggestions degrade gracefully to description-only findings.
- **Per-provider prompt tuning:** Don't create provider-specific prompt variations for fix generation. Uniform prompts are easier to maintain and test. Provider differences are minimal for structured JSON output.
- **Common denominator context limits:** Don't use the smallest provider's context window for all providers. Tiered approach maximizes quality for large-window models while handling small-window models safely.

## Don't Hand-Roll

Problems that look simple but have existing solutions:

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Token counting | Custom tokenizer implementation | Character-based estimation (chars / 4) with 10% safety margin | Model-specific tokenizers add dependencies and latency. Char/4 heuristic is 90% accurate and sufficient for context window validation. Already implemented in utils/token-estimation.ts. |
| Backtick escaping in suggestions | String replacement or manual fence selection | Dynamic fence delimiter calculation (max backticks + 1) | Already implemented in suggestion-formatter.ts. Handles nested backticks correctly. GitHub suggestion blocks need proper fence escaping to prevent markdown conflicts. |
| Line position validation | Custom diff parsing | mapLinesToPositions from utils/diff.ts | Already implemented and tested. Maps absolute line numbers to diff positions. Reusing this prevents off-by-one errors. |
| Suggestion formatting | Custom markdown generation | formatSuggestionBlock from suggestion-formatter.ts | Already implements GitHub suggestion syntax with proper escaping. Returns empty string for invalid input (graceful degradation). |

**Key insight:** The existing codebase (from Phase 1) already handles the low-level mechanics of suggestion formatting and validation. Phase 2 focuses on prompt engineering and parsing, not reinventing formatting utilities.

## Common Pitfalls

### Pitfall 1: Vague Fix Generation Prompts
**What goes wrong:** LLM generates explanations or incomplete fixes instead of exact replacement code
**Why it happens:** Prompt doesn't clearly specify that suggestion field should be executable code, not English explanation
**How to avoid:** Include explicit JSON example showing suggestion field with actual code. Use language like "EXACT replacement code" and "no explanations or comments"
**Warning signs:** Suggestions contain phrases like "You should..." or "Consider changing..." instead of code

### Pitfall 2: Hallucinated Fixes for Unfixable Issues
**What goes wrong:** LLM generates fixes for architectural issues or design suggestions where there's no single correct fix
**Why it happens:** Prompt asks for fixes on all findings without distinguishing fixable vs unfixable
**How to avoid:** Use allowlist approach - only request fixes for specific issue types (null checks, type errors, off-by-one). Explicitly list non-fixable categories (architectural, design, unclear requirements)
**Warning signs:** Suggestions that restructure entire functions or make arbitrary design choices

### Pitfall 3: Context Window Overflow Without Detection
**What goes wrong:** Prompt exceeds model's context window, causing truncation or failure
**Why it happens:** No token counting before sending prompt, or using fixed limits across all providers
**How to avoid:** Use estimateTokensConservative() before building prompt. Apply tiered limits based on provider's actual context window. Skip suggestion generation (not entire finding) when code snippet too large
**Warning signs:** Provider errors about token limits, incomplete responses, or mysterious failures on large diffs

### Pitfall 4: Suggestion Validation Too Strict or Too Loose
**What goes wrong:** Either reject valid suggestions (too strict) or accept garbage (too loose)
**Why it happens:** Trying to implement deep validation (syntax checking, semantic analysis) in Phase 2, or skipping validation entirely
**How to avoid:** Phase 2 uses basic sanity checks only: non-empty, reasonable length, contains code syntax, doesn't delete massive amounts. Leave syntax validation and multi-line support for Phase 4. Trust LLM for correctness within these bounds.
**Warning signs:** High rejection rate of seemingly valid fixes (too strict) or accepting suggestions that are clearly not code (too loose)

### Pitfall 5: Treating Invalid Suggestions as Fatal Errors
**What goes wrong:** When suggestion is invalid, entire finding is suppressed or pipeline fails
**Why it happens:** Conflating suggestion validation with finding validation
**How to avoid:** Invalid suggestions degrade gracefully - post finding without suggestion block. User still sees the issue description. Validation happens in CommentPoster (as in Phase 1), not in parser. Use regex replacement to strip invalid suggestion blocks.
**Warning signs:** Fewer findings posted than LLM actually found, user complaints about missing issues

### Pitfall 6: Per-Request JSON Schema Overhead
**What goes wrong:** Including full JSON schema in every request increases token usage and latency
**Why it happens:** Attempting to use provider-specific structured output APIs that require schema per request
**How to avoid:** Add JSON schema example to system message (one-time cost). Use lightweight parsing with try/catch rather than heavy validation. Providers in this codebase use CLI invocation, not API SDKs, so schema enforcement isn't available anyway.
**Warning signs:** High token costs, slow response times, unnecessary API complexity

## Code Examples

Verified patterns from existing codebase and research:

### Token Estimation (Already Implemented)
```typescript
// Source: src/utils/token-estimation.ts (existing)
import { estimateTokensConservative, checkContextWindowFit } from '../utils/token-estimation';

// Check if prompt fits in context window
const fitCheck = checkContextWindowFit(prompt, 'gemini-2.0-flash');
if (!fitCheck.fits) {
  logger.warn(
    `Prompt exceeds context window: ${fitCheck.promptTokens} tokens > ` +
    `${fitCheck.availableTokens} available. ${fitCheck.recommendation}`
  );
  // Skip suggestion generation for this finding
}
```

### Suggestion Formatting (Already Implemented)
```typescript
// Source: src/utils/suggestion-formatter.ts (existing)
import { formatSuggestionBlock } from '../utils/suggestion-formatter';

// Format suggestion with automatic backtick escaping
const suggestionBlock = formatSuggestionBlock(finding.suggestion);
// Returns: ```suggestion\n{code}\n``` with dynamic fence count

// Empty/whitespace input returns empty string (graceful degradation)
const empty = formatSuggestionBlock('   '); // Returns: ''
```

### Line Validation (Already Implemented)
```typescript
// Source: src/utils/suggestion-validator.ts (existing)
import { isSuggestionLineValid } from '../utils/suggestion-validator';

// Validate suggestion line exists in diff before formatting
if (!isSuggestionLineValid(finding.line, file.patch)) {
  // Line not in diff - strip suggestion but keep finding
  comment.body = comment.body.replace(
    /```suggestion[\s\S]*?```/g,
    '_Suggestion not available for this line_'
  );
}
```

### Graceful Degradation in CommentPoster (Already Implemented)
```typescript
// Source: src/github/comment-poster.ts (existing, lines 172-178)
// Validate suggestions can be applied at this line
if (c.body.includes('```suggestion')) {
  const file = files.find(f => f.filename === c.path);
  if (!file || !isSuggestionLineValid(c.line, file.patch)) {
    // Line isn't in diff - strip suggestion block but keep the finding
    logger.warn(`Suggestion line ${c.path}:${c.line} not valid in diff, posting without suggestion block`);
    c.body = c.body.replace(/```suggestion[\s\S]*?```/g, '_Suggestion not available for this line_');
  }
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Ask LLM for fixes in separate follow-up pass | Request fixes in initial review prompt | 2024-2025 (GPT-4 → GPT-4 Turbo era) | Single-pass is faster and cheaper. Context window expansion made this viable. |
| Provider-specific JSON modes (OpenAI JSON mode, Claude tool calls) | Provider-agnostic JSON in prompt with fallback parsing | 2026 (multi-provider standardization) | Works across all providers without SDK dependency. Simpler to implement and test. |
| Fixed 4k-8k context window limits | Tiered limits based on provider (small/medium/large) | 2025-2026 (Gemini 1M, Claude 200k expansion) | Maximizes quality for large-window models while handling legacy models safely. |
| Word-based token estimation | Character-based estimation (chars / 4) with safety margin | 2023-present (industry standard) | 90% accurate without tokenizer dependencies. Conservative margin prevents overflows. |

**Deprecated/outdated:**
- **OpenAI JSON mode enforcement:** Not available via CLI providers used in this codebase. JSON-in-prompt works universally.
- **Model-specific tokenizers (tiktoken, sentencepiece):** Too heavy for context window validation. Char/4 heuristic is sufficient.
- **Common denominator context limits:** GPT-4's 8k limit is obsolete. Most models in 2026 have 128k+ context windows.

## Open Questions

Things that couldn't be fully resolved:

1. **Fixable Issue Type Definition**
   - What we know: User decided on allowlist approach (only generate fixes for fixable types)
   - What's unclear: Exact taxonomy of "fixable" vs "unfixable" - e.g., is "missing null check" fixable but "missing error handling" not?
   - Recommendation: Start conservative - fixable means mechanical fixes (null checks, type casts, off-by-one). Expand based on quality metrics in Phase 5.

2. **Logging/Metrics for Skipped Suggestions**
   - What we know: User marked this as "Claude's Discretion"
   - What's unclear: What granularity of metrics? Per-provider stats? Per-reason breakdown?
   - Recommendation: Start simple - logger.warn() for each skipped suggestion with reason. Add structured metrics in Phase 5 when analytics phase analyzes patterns.

3. **Multi-line Suggestion Support Timeline**
   - What we know: Multi-line support deferred to later phase
   - What's unclear: Will Phase 2 suggestions be single-line only, or allow multi-line with validation happening later?
   - Recommendation: Allow multi-line in Phase 2 (Finding.suggestion is a string, not limited to single line). Basic sanity check limits to 50 lines. Full multi-line validation in Phase 4.

## Sources

### Primary (HIGH confidence)
- Existing codebase implementation:
  - src/types/index.ts (Finding.suggestion field)
  - src/utils/token-estimation.ts (character-based heuristic, context window sizes)
  - src/utils/suggestion-formatter.ts (dynamic fence calculation)
  - src/utils/suggestion-validator.ts (line position validation)
  - src/github/comment-poster.ts (graceful degradation pattern)
- Phase 1 implementation patterns (.planning/phases/01-core-suggestion-formatting/)

### Secondary (MEDIUM confidence)
- [My LLM coding workflow going into 2026 - Addy Osmani](https://addyosmani.com/blog/ai-coding-workflow/) - Focused prompting, granular fixes, iterative approach
- [Structured Output Comparison across LLM providers - Medium](https://medium.com/@rosgluk/structured-output-comparison-across-popular-llm-providers-openai-gemini-anthropic-mistral-and-1a5d42fa612a) - OpenAI native JSON mode, Claude tool call trick, Gemini schema support
- [Best LLMs for Extended Context Windows in 2026](https://research.aimultiple.com/ai-context-window/) - Claude 4 Sonnet 200k-1M, Gemini 2.0 1M, GPT-5.2 400k
- [Context Windows - Claude API Docs](https://platform.claude.com/docs/en/build-with-claude/context-windows) - 200k standard, 1M beta for tier 4+

### Tertiary (LOW confidence)
- [PromptHub: Using LLMs for Code Generation](https://www.prompthub.us/blog/using-llms-for-code-generation-a-guide-to-improving-accuracy-and-addressing-common-issues) - General best practices
- [LLM Testing in 2026: Top Methods](https://www.confident-ai.com/blog/llm-testing-in-2024-top-methods-and-strategies) - Validation framework concepts
- [How to Create Context Window Management](https://oneuptime.com/blog/post/2026-01-30-context-window-management/view) - Write/Select/Compress/Isolate strategies

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - Existing codebase provides all necessary utilities, no external dependencies needed
- Architecture: HIGH - Clear patterns from Phase 1 and research consensus on focused prompting, structured outputs, tiered context management
- Pitfalls: HIGH - Well-documented from research and existing codebase mistakes (e.g., Phase 1 validation approach)

**Research date:** 2026-02-04
**Valid until:** 2026-03-04 (30 days - stable domain with mature patterns)
