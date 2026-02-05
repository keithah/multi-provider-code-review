# Pitfalls Research

**Domain:** LLM-Generated Commit Suggestions for GitHub Code Review
**Researched:** 2026-02-04
**Confidence:** HIGH

## Critical Pitfalls

### Pitfall 1: Line Number Misalignment from Diff Position Mapping

**What goes wrong:**
GitHub's suggestion blocks require exact line numbers that correspond to the diff's position values. When line numbers are calculated incorrectly or don't align with the diff hunk positions, suggestions either fail to apply or apply to the wrong lines, corrupting code.

**Why it happens:**
Developers confuse three different coordinate systems: (1) absolute line numbers in the file, (2) line numbers relative to the diff hunk, and (3) GitHub's position-based API parameter (which is being deprecated). The existing codebase already has `mapLinesToPositions()` in `src/utils/diff.ts`, but suggestion blocks require the inverse—mapping positions back to exact line ranges.

**How to avoid:**
- Use GitHub's modern `line`, `start_line`, `side`, `start_side` parameters instead of deprecated `position`
- Parse diff hunk headers (`@@ -a,b +c,d @@`) to build bidirectional mappings
- For multi-line suggestions, validate that ALL lines in the range exist in the diff
- Test with edge cases: first line of file, last line of file, hunks with only deletions

**Warning signs:**
- Comments posting successfully but suggestion buttons not appearing
- "Suggestions cannot be applied" errors in GitHub UI
- Suggestions appearing on wrong lines when files have multiple changes
- Inline comments work but suggestions fail

**Phase to address:**
Phase 1 (Core Implementation) - This is foundational. Without correct line mapping, no suggestions will work reliably.

---

### Pitfall 2: Incorrect Fixes from Context Window Truncation

**What goes wrong:**
LLMs generate syntactically valid but semantically incorrect fixes when the context window truncates mid-file, cutting off critical context like function signatures, import statements, or closing braces. The fix may compile but break runtime behavior or introduce logic errors.

**Why it happens:**
Token limits (typical code review diffs can exceed 50k tokens) force truncation. Older models silently dropped context; newer models return errors but implementations may not handle them. The project already has `targetTokensPerBatch` configuration, but individual findings may still exceed single-request limits when generating fixes.

**How to avoid:**
- Implement token counting BEFORE sending fix generation prompts
- For large contexts, use chunking with explicit "must-have" vs "optional" context prioritization
- Always include: the exact changed lines, immediate surrounding context (±5 lines), and function/class signature
- Detect truncation errors from API responses and degrade gracefully (description-only finding)
- Set per-provider context limits in configuration (Claude: 200k, GPT-4: 128k, Gemini: 1M)

**Warning signs:**
- Fixes that import non-existent packages or functions
- Fixes referencing variables not in scope
- API responses return validation errors about context length
- Generated fixes work in isolation but break integration tests
- Higher error rates from providers with smaller context windows

**Phase to address:**
Phase 1 (Core Implementation) - Must be prevented before any fix generation runs in production.

---

### Pitfall 3: Markdown Syntax Conflicts in Suggestion Blocks

**What goes wrong:**
GitHub suggestion blocks use triple backticks (` ``` `) as delimiters. When the suggested code itself contains backticks, markdown, or special characters, it breaks the suggestion block syntax, causing the suggestion to render as plain text instead of an actionable button.

**Why it happens:**
LLMs generate fixes without awareness of the GitHub suggestion block format requirements. Raw code output gets wrapped in ` ```suggestion ` blocks, but if that code contains ` ``` `, shell commands with backticks, or markdown in comments, it terminates the block prematurely.

**How to avoid:**
- Post-process LLM output to escape problematic characters within suggestion blocks
- Use increased backtick delimiters (` ```` ` or ` ````` `) when content contains triple backticks
- Validate suggestion block syntax before posting (regex: `/^```suggestion\n.*\n```$/s`)
- Test with edge cases: code with embedded markdown, shell commands, regex patterns, template literals
- When escaping fails, fall back to code fence without suggestion tag (loses one-click apply but preserves readability)

**Warning signs:**
- Suggestion blocks rendering as plain code blocks in GitHub UI
- No "Commit suggestion" button appears
- Visual inspection shows premature block termination
- Suggestions work for simple changes but fail for complex ones
- Comments with template literals or shell scripts fail

**Phase to address:**
Phase 2 (Validation & Formatting) - After basic fix generation works, add robust format validation.

---

### Pitfall 4: Hallucinated Fixes from Insufficient Context

**What goes wrong:**
LLMs generate fixes that introduce non-existent dependencies, call undefined functions, or violate project-specific patterns because they lack full codebase context. The fix looks plausible but is incorrect for this specific project.

**Why it happens:**
Research shows this is "context misalignment"—claims in fixes that are unsupported by or contradictory to the actual code diff. LLMs trained on common patterns invent "standard" solutions that don't fit the actual architecture. With 68.50% correctness rate (GPT-4o) and 54.26% correction rate (Gemini 2.0 Flash) in recent studies, this is the dominant failure mode.

**How to avoid:**
- Include project-specific context in fix generation prompts: coding guidelines, architectural constraints, dependency manifests
- Leverage the existing `graphEnabled` and `graphCacheEnabled` features to provide call graph context
- Add syntax validation step: parse the fix with language-appropriate parser before posting
- Implement provider-level quality checks: require multiple providers to agree on fix approach for critical issues
- Use the existing `learningEnabled` system to track fix acceptance rates and penalize hallucination-prone patterns

**Warning signs:**
- Fixes import packages not in package.json/requirements.txt
- Fixes use APIs that don't exist in the project's dependency versions
- Fixes suggest patterns inconsistent with existing codebase style
- High rate of developers rejecting or modifying suggestions
- Increased bug reports after suggested fixes are applied

**Phase to address:**
Phase 3 (Quality & Reliability) - After basic functionality works, add context-aware validation.

---

### Pitfall 5: Multi-Line Suggestions with Deleted Lines

**What goes wrong:**
GitHub's multi-line suggestion feature fails when the suggestion spans lines that include deletions. The UI shows "Suggestions cannot be applied" because GitHub doesn't support suggestions that modify the "before" state—only the "after" state.

**Why it happens:**
Multi-line diffs show both deletions (-) and additions (+), but GitHub suggestions only work on the RIGHT side (new code). When an LLM generates a fix spanning multiple lines where some were deleted, the position calculation breaks because deleted lines don't have positions in the new file.

**How to avoid:**
- When parsing diffs, separate deleted lines from added/context lines
- For suggestions, ONLY use line numbers from the RIGHT side (additions and unchanged context)
- If a fix requires suggesting changes to deleted lines, split into two comments: describe what should have been kept (regular comment) + suggest fix for what remains (suggestion block)
- Limit multi-line suggestions to 10-20 lines to reduce conflict probability
- Validate all lines in suggestion range exist on the RIGHT side before formatting

**Warning signs:**
- Suggestions work for single-line changes but fail for multi-line
- "Cannot be applied" errors concentrated in files with heavy refactoring
- Success rate correlates with additions-only vs mixed change types
- Manual testing shows suggestions fail when diff includes deletions

**Phase to address:**
Phase 2 (Validation & Formatting) - Essential for handling realistic diffs with deletions.

---

### Pitfall 6: Untested Fixes Applied by Users

**What goes wrong:**
Developers click "Commit suggestion" trusting the AI-generated fix without review or testing. The fix breaks tests, introduces regressions, or creates security vulnerabilities that only surface in production.

**Why it happens:**
The one-click convenience bypasses normal code review discipline. Users assume AI-verified means production-ready. CodeRabbit's 2025 report shows AI-generated code creates 1.7x more issues than human code, with 40% containing security flaws.

**How to avoid:**
- Add clear warnings in suggestion comments: "⚠️ Review before applying - Generated fix may require testing"
- Never suggest fixes for critical severity findings without extensive context validation
- Include test scenarios in the fix comment: "After applying, verify: [checklist]"
- Integrate with existing CI: suggest fixes as draft commits that trigger test runs
- Use the `learningEnabled` feedback mechanism to track which suggestions caused CI failures

**Warning signs:**
- Increased production incidents after enabling suggestion feature
- High rate of fix-reverts or follow-up fixes to suggestions
- CI failure rate increases after suggestions are applied
- Security scanning tools flag issues introduced by suggested fixes

**Phase to address:**
Phase 1 (Core Implementation) - Build warnings and disclaimers into the initial release to establish safe usage patterns.

---

## Technical Debt Patterns

Shortcuts that seem reasonable but create long-term problems.

| Shortcut | Immediate Benefit | Long-term Cost | When Acceptable |
|----------|-------------------|----------------|-----------------|
| Skip syntax validation on generated fixes | Faster implementation, no parser dependencies | 15-30% of suggestions fail with syntax errors users discover after applying | Never - syntax validation is lightweight |
| Use position API instead of line/start_line | Simpler initial implementation | Position API is deprecated, will break in future GitHub versions | Never - GitHub already deprecated it |
| Single-provider fix generation | Lower latency, simpler code | No consensus validation, higher hallucination rate | Only for minor severity findings with human review |
| Generate fixes in initial review pass | Single API call, faster overall | Fix quality depends on initial context which may be incomplete | Acceptable for MVP, but add two-pass option for critical findings |
| Fallback to description when fix fails | Graceful degradation | May hide systematic issues with fix generation | Always acceptable - better than failing silently |
| Apply character limits to fix suggestions | Prevent API overload | Complex fixes get truncated mid-solution | Acceptable up to 2000 chars, fail explicitly beyond that |
| Cache generated fixes aggressively | Reduce API costs | Stale fixes for files that changed | Only cache for same commit SHA, never across commits |

## Integration Gotchas

Common mistakes when connecting to external services.

| Integration | Common Mistake | Correct Approach |
|-------------|----------------|------------------|
| GitHub Suggestion API | Using deprecated `position` parameter | Migrate to `line`, `start_line`, `side`, `start_side` per [GitHub API docs](https://docs.github.com/en/rest/pulls/comments) |
| Multi-provider LLMs | Assuming uniform suggestion format across providers | Parse each provider's output separately, normalize to common Finding structure before formatting |
| Diff parsing | Counting line numbers from file start | Parse hunk headers `@@ -a,b +c,d @@` to get relative positions within each hunk |
| Comment size limits | Posting entire fix explanation in one comment | GitHub has 65,536 char limit; chunk large suggestions or use collapsible details |
| Markdown escaping | Wrapping code directly in suggestion blocks | Escape special chars: backticks, brackets, hashes per [markdown spec](https://github.com/mattcone/markdown-guide/blob/master/_basic-syntax/escaping-characters.md) |
| Line endings | Generating fixes with wrong line endings (CRLF vs LF) | Detect line ending style from original file, preserve in suggestion |

## Performance Traps

Patterns that work at small scale but fail as usage grows.

| Trap | Symptoms | Prevention | When It Breaks |
|------|----------|------------|----------------|
| Generating fixes for every finding | Initial reviews work fine | Review time increases linearly with findings; token costs 2-3x | >50 findings per PR |
| No timeout on fix generation | Most fixes generate quickly | Occasional complex context causes 60s+ hangs | Large files (>1000 lines) or deep call graphs |
| Synchronous fix generation per finding | Simple implementation | Blocks review completion for slow providers | >10 findings with fix requests |
| Loading entire file content for context | Works for small files | Memory exhaustion, rate limit issues | Files >5000 lines or >50 files with fixes |
| Caching fixes by file path only | Fast cache hits | Cache hits on stale code after file changes | High-velocity PRs with multiple commits |
| No batching for multi-finding files | One API call per finding | API rate limits, inefficient token usage | Multiple findings in same function |

## Security Mistakes

Domain-specific security issues beyond general web security.

| Mistake | Risk | Prevention |
|---------|------|------------|
| Including secrets in fix context | API keys, credentials leaked to LLM provider logs | Scan context for patterns (env vars, tokens) before sending; use existing secrets scanner |
| Suggesting fixes that bypass security checks | LLM suggests removing "annoying" auth checks | Include security validation rules in fix prompts; never suggest removing security code |
| Fixing input validation vulnerabilities incorrectly | Partial sanitization introduces new injection vectors | Validate suggestions against OWASP rules; prefer library-based fixes over manual escaping |
| Suggesting outdated crypto patterns | Fix uses deprecated MD5, weak ciphers | Include dependency versions in context; validate against security best practices database |
| Exposing sensitive diff content in public comments | Private code patterns visible in public repo issues | Verify repo visibility before posting; redact sensitive patterns |
| Privilege escalation in suggested changes | Fix changes permissions or access control | Flag any permission-related code changes for manual review; never auto-suggest auth changes |

## UX Pitfalls

Common user experience mistakes in this domain.

| Pitfall | User Impact | Better Approach |
|---------|-------------|-----------------|
| No visual distinction between AI suggestions and human comments | Users trust AI fixes equally to human review | Add clear "🤖 AI-Generated Fix" prefix and warning footer |
| Suggestion button appears but fails silently | User clicks, nothing happens, frustration | Validate suggestion will work before formatting; show error message if validation fails |
| Fix explanations use AI jargon | Users don't understand "hallucination", "context window", "token limit" | Use plain language: "The fix may be incomplete", "Limited information available" |
| No way to provide feedback on bad suggestions | Bad fixes keep appearing, users lose trust | Integrate with GitHub reactions (👎 = bad fix) and learning system |
| Fixes without explanation | User sees code change but doesn't understand why | Always include reasoning: "This fixes X by doing Y" |
| Overwhelming number of suggestions | 30+ suggestion blocks paralyze decision-making | Prioritize: critical=always suggest, major=suggest if high confidence, minor=description only |
| Suggestion conflicts with manual edits | User edited code, suggestion no longer applies | Check if lines changed since review started; mark stale suggestions |

## "Looks Done But Isn't" Checklist

Things that appear complete but are missing critical pieces.

- [ ] **Suggestion formatting:** Often missing escape handling for backticks in code — verify with regex test on real codebase examples
- [ ] **Line number mapping:** Often missing bidirectional position↔line conversion — verify both inline comments AND suggestions work on same diff
- [ ] **Context truncation detection:** Often missing explicit API error handling — verify behavior when context exceeds provider limits
- [ ] **Multi-line boundary validation:** Often missing check that ALL lines exist on RIGHT side — verify with diff containing deletions
- [ ] **Syntax validation:** Often missing language-specific parsing — verify generated fixes compile/parse before posting
- [ ] **Rate limit handling:** Often missing backoff for suggestion posting — verify behavior under GitHub API secondary rate limits
- [ ] **Markdown conflicts:** Often missing detection of special chars in code — verify with code containing markdown, shell commands, regex
- [ ] **Provider consensus:** Often missing cross-validation for high-severity fixes — verify critical fixes checked by multiple providers
- [ ] **Stale suggestion detection:** Often missing check if file changed since review — verify suggestions marked invalid after new commits
- [ ] **Whitespace preservation:** Often missing indentation/spacing preservation — verify suggested code matches file's style (tabs vs spaces)

## Recovery Strategies

When pitfalls occur despite prevention, how to recover.

| Pitfall | Recovery Cost | Recovery Steps |
|---------|---------------|----------------|
| Line misalignment breaks suggestions | LOW | Edit comment to replace suggestion block with regular code fence; user can copy-paste |
| Hallucinated fix posted | MEDIUM | Bot edits comment to add "⚠️ This suggestion may be incorrect" warning; learning system downgrades pattern |
| Suggestion syntax breaks markdown | LOW | Webhook detects broken render, bot auto-corrects by escaping or removing suggestion tag |
| Context truncation generates bad fix | MEDIUM | Regenerate with reduced context (function-only instead of file); if still fails, fall back to description |
| Multi-line suggestion conflicts | MEDIUM | Split into single-line suggestions for each changed line separately |
| User applied breaking fix | HIGH | Learning system records feedback; bot posts follow-up comment with test checklist; update docs with "Always test suggestions" |
| Rate limit exceeded | LOW | Queue suggestions for delayed posting; post critical first, defer minor |
| Provider returns invalid suggestion | LOW | Try fallback provider; if all fail, post finding without suggestion |

## Pitfall-to-Phase Mapping

How roadmap phases should address these pitfalls.

| Pitfall | Prevention Phase | Verification |
|---------|------------------|--------------|
| Line number misalignment | Phase 1: Core Implementation | Test suite with diffs containing: first line, last line, multiple hunks, only additions, mixed adds/deletes |
| Context window truncation | Phase 1: Core Implementation | Monitor API errors for context length violations; alert on truncation; test with large files (>10k lines) |
| Markdown syntax conflicts | Phase 2: Validation & Formatting | Regex validation of all suggestion blocks before posting; integration test with code containing backticks/markdown |
| Hallucinated fixes | Phase 3: Quality & Reliability | Syntax validation using language parsers; multi-provider consensus for critical findings; learning system tracking acceptance rate |
| Multi-line with deletions | Phase 2: Validation & Formatting | Test with diffs where every hunk includes deletions; validate suggestions only reference RIGHT side lines |
| Untested fixes applied | Phase 1: Core Implementation | Add warning text to all suggestions; documentation on testing requirements; track fix-induced CI failures |
| No consensus validation | Phase 3: Quality & Reliability | Require 2+ providers agree on fix approach for critical severity; track disagreement rates |
| Insufficient context | Phase 3: Quality & Reliability | Include call graph analysis, project guidelines, dependency versions in prompts; validate against codebase standards |
| Silent syntax errors | Phase 2: Validation & Formatting | Add language-specific parsers (TypeScript, Python, Go, etc.); fail loudly when syntax validation fails |
| Rate limit issues | Phase 4: Production Hardening | Implement request queuing with exponential backoff; monitor GitHub API rate limit headers; circuit breaker for posting |

## Sources

### High Confidence (Official/Research)

- [GitHub API - Pull Request Review Comments](https://docs.github.com/en/rest/pulls/comments) - Position parameter deprecation, modern line-based approach
- [GitHub Changelog - Multi-line Code Suggestions](https://github.blog/changelog/2020-04-15-multi-line-code-suggestions-general-availability/) - Official multi-line support details
- [HalluJudge: Hallucination Detection for Code Review](https://arxiv.org/html/2601.19072) - Context misalignment research
- [Evaluating Large Language Models for Code Review](https://arxiv.org/html/2505.20206v1) - 68.50% correctness rate (GPT-4o), 63.89% (Gemini 2.0)
- [GitHub Community Discussion #114597](https://github.com/orgs/community/discussions/114597) - Multi-line suggestions with deletions limitation

### Medium Confidence (Industry Reports)

- [CodeRabbit State of AI vs Human Code Report 2025](https://www.coderabbit.ai/blog/state-of-ai-vs-human-code-generation-report) - 1.7x more issues in AI code, 40% security flaws
- [8 Best AI Code Review Tools 2026](https://www.qodo.ai/blog/best-ai-code-review-tools-2026/) - 40% quality deficit projection
- [Context Window Overflow in 2026](https://redis.io/blog/context-window-overflow/) - Silent truncation vs explicit errors
- [Edge Cases and Error Handling](https://codefix.dev/2026/02/02/ai-coding-edge-case-fix/) - AI training overrepresents common scenarios
- [The Register: GitHub AI Slop Flood](https://www.theregister.com/2026/02/03/github_kill_switch_pull_requests_ai) - GitHub considering PR restrictions

### Low Confidence (Community/Blogs)

- [How to suggest changes in GitHub PR](https://graphite.com/guides/suggest-changes-github-pr) - Suggestion block syntax guide
- [Markdown Special Characters](https://github.com/sonic-net/SONiC/wiki/Special-Characters-and-Escaping) - Escaping requirements
- [CodeSignal Diff Parser Guide](https://codesignal.com/learn/courses/ai-integration-and-analysis/lessons/diff-parser-breaking-down-code-changes-for-review) - Hunk header parsing

---
*Pitfalls research for: LLM-Generated Commit Suggestions for GitHub Code Review*
*Researched: 2026-02-04*
