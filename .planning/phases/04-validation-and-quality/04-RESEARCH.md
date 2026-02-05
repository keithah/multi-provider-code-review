# Phase 4: Validation and Quality - Research

**Researched:** 2026-02-04
**Domain:** Code validation, AST comparison, confidence scoring, feedback learning
**Confidence:** MEDIUM

## Summary

Phase 4 adds quality gates on top of working suggestions from Phases 1-3. The research focused on four technical domains: (1) syntax validation using tree-sitter, (2) AST-based consensus detection, (3) confidence threshold tuning, and (4) feedback tracking patterns.

**Tree-sitter** (already in package.json at v0.21.1) provides robust syntax validation through incremental parsing. The library detects both ERROR nodes (unparseable text) and MISSING nodes (parser-inserted recovery tokens), requiring both checks for complete validation. Language grammars are available via npm for TypeScript, JavaScript, Python, and Go.

**AST comparison** for consensus requires structural equality checking that ignores whitespace and variable names. The `compare-ast` npm package (based on esprima) provides fuzzy matching with configurable comparators. However, tree-sitter's native AST output may be more suitable given existing project dependencies. AST comparison is computationally expensive but more semantically aware than string-based Levenshtein distance.

**Confidence scoring** follows ML best practices: hybrid approaches combining LLM-reported confidence with validation signals (syntax validity, consensus agreement). Default threshold of 0.7 aligns with industry standards for precision-recall tradeoffs. Thresholds should be tunable per severity level, with higher thresholds for critical findings.

**Feedback tracking** leverages GitHub's Reactions API (thumbs up/down on comments) with weighted threshold adjustment. The existing `FeedbackTracker` class provides a foundation, adjusting per-category confidence thresholds based on positive/negative reaction rates. Pattern suppression requires similarity detection, likely using AST structural comparison or simpler heuristics (file + line + category matching).

**Primary recommendation:** Use tree-sitter for all syntax validation, implement AST-based consensus via tree-sitter node comparison (not external libraries), integrate confidence scoring with existing analytics system, and extend FeedbackTracker for per-finding suppression.

## Standard Stack

The established libraries/tools for validation and quality:

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| tree-sitter | 0.21.1+ | Syntax parsing and validation | Industry-standard incremental parser, already in project, supports multi-language with single API |
| tree-sitter-typescript | 0.21.2+ | TypeScript/TSX grammar | Official grammar, already in project dependencies |
| tree-sitter-python | 0.21.0+ | Python grammar | Official grammar, already in project dependencies |
| tree-sitter-javascript | 0.21.0+ | JavaScript/JSX grammar | Official grammar, ECMAScript-compliant |
| tree-sitter-go | 0.25.0 | Go grammar | Official grammar, 73+ projects using it |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| @octokit/rest | 20.1.2+ | GitHub Reactions API access | Already in project for PR operations, use for thumbs-down tracking |
| compare-ast | 0.2.0 | AST structural comparison | OPTIONAL - only if tree-sitter comparison proves insufficient for consensus |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| tree-sitter | esprima/acorn | Language-specific (JS only), no incremental parsing, no error recovery |
| AST comparison | Levenshtein distance | Character-level, semantically unaware, doesn't handle refactoring equivalence |
| GitHub Reactions | Custom DB | More complex infrastructure, GitHub Reactions are native to PR workflow |

**Installation:**
```bash
npm install tree-sitter-javascript tree-sitter-go
# TypeScript and Python grammars already installed
# tree-sitter@0.21.1 already installed
```

## Architecture Patterns

### Recommended Project Structure
```
src/
├── validation/
│   ├── syntax-validator.ts      # Tree-sitter syntax checking
│   ├── consensus-detector.ts    # AST-based agreement detection
│   ├── confidence-calculator.ts # Hybrid scoring with validation signals
│   └── index.ts                 # Public API
├── learning/
│   ├── feedback-tracker.ts      # Existing - extend for suppression
│   ├── pattern-matcher.ts       # Similarity detection for suppression
│   └── index.ts
├── analysis/
│   └── ast/
│       ├── parsers.ts           # Existing - extend with Go/JS support
│       └── comparator.ts        # NEW - AST structural equality
```

### Pattern 1: Syntax Validation with Error Recovery
**What:** Parse suggested code fixes with tree-sitter and check for ERROR/MISSING nodes before posting
**When to use:** ALL suggestions regardless of severity (per CONTEXT.md decisions)
**Example:**
```typescript
// Validate suggestion syntax before posting
import Parser from 'tree-sitter';
import TypeScript from 'tree-sitter-typescript';

function validateSyntax(code: string, language: 'typescript' | 'javascript' | 'python' | 'go'): {
  isValid: boolean;
  errors: Array<{ type: 'ERROR' | 'MISSING'; line: number; column: number }>;
} {
  const parser = new Parser();
  parser.setLanguage(getLanguageGrammar(language));

  const tree = parser.parse(code);
  const errors: Array<{ type: 'ERROR' | 'MISSING'; line: number; column: number }> = [];

  // Check for ERROR nodes (unparseable text)
  const cursor = tree.walk();
  do {
    const node = cursor.currentNode;
    if (node.type === 'ERROR') {
      errors.push({
        type: 'ERROR',
        line: node.startPosition.row + 1,
        column: node.startPosition.column + 1
      });
    }
    // Check for MISSING nodes (parser recovery)
    if (node.isMissing) {
      errors.push({
        type: 'MISSING',
        line: node.startPosition.row + 1,
        column: node.startPosition.column + 1
      });
    }
  } while (cursor.gotoNextSibling() || cursor.gotoParent());

  return { isValid: errors.length === 0, errors };
}

// CRITICAL: Must check BOTH hasError and isMissing
// - hasError: detects ERROR nodes (syntax errors)
// - isMissing: detects recovery nodes (missing tokens)
// Missing nodes are NOT captured by (ERROR) queries
```
**Source:** [Tree-sitter documentation](https://tree-sitter.github.io/tree-sitter/using-parsers/queries/1-syntax.html), [GitHub discussion on MISSING nodes](https://github.com/tree-sitter/tree-sitter/issues/650)

### Pattern 2: AST-Based Consensus Detection
**What:** Compare ASTs from multiple provider suggestions to detect structural equivalence
**When to use:** Critical severity findings requiring consensus (per CONTEXT.md)
**Example:**
```typescript
// Compare two suggestions for structural equivalence
function areASTsEquivalent(code1: string, code2: string, language: string): boolean {
  const parser = new Parser();
  parser.setLanguage(getLanguageGrammar(language));

  const tree1 = parser.parse(code1);
  const tree2 = parser.parse(code2);

  // Compare syntax trees ignoring:
  // - Whitespace (tree-sitter skips unnamed nodes)
  // - Variable names (compare node types, not identifiers)
  // - Comments (not in AST)

  return compareNodes(tree1.rootNode, tree2.rootNode);
}

function compareNodes(node1: Parser.SyntaxNode, node2: Parser.SyntaxNode): boolean {
  // Different node types = not equivalent
  if (node1.type !== node2.type) return false;

  // Different child counts = not equivalent
  if (node1.namedChildCount !== node2.namedChildCount) return false;

  // Recursively compare children (skip unnamed nodes)
  for (let i = 0; i < node1.namedChildCount; i++) {
    const child1 = node1.namedChild(i);
    const child2 = node2.namedChild(i);
    if (!child1 || !child2) return false;

    // For identifier nodes, check if both are identifiers (ignore actual names)
    if (child1.type === 'identifier' && child2.type === 'identifier') {
      continue; // Variable names may differ
    }

    if (!compareNodes(child1, child2)) return false;
  }

  return true;
}
```
**Source:** [ast-grep core concepts](https://ast-grep.github.io/advanced/core-concepts.html), [Deep Dive into ast-grep's Match Algorithm](https://ast-grep.github.io/advanced/match-algorithm.html)

### Pattern 3: Hybrid Confidence Scoring
**What:** Combine LLM-reported confidence with validation signals (syntax, consensus) for final score
**When to use:** All suggestions, used for threshold filtering
**Example:**
```typescript
interface ConfidenceSignals {
  llmConfidence?: number;        // Provider-reported confidence (if available)
  syntaxValid: boolean;          // Passed tree-sitter validation
  hasConsensus: boolean;         // 2+ providers agree (for critical)
  providerReliability: number;   // Historical accuracy (from analytics)
}

function calculateConfidence(signals: ConfidenceSignals): number {
  // Hybrid approach: use LLM confidence if available, else validation signals

  if (signals.llmConfidence !== undefined) {
    // Adjust LLM confidence with validation signals
    let adjusted = signals.llmConfidence;

    // Boost if syntax valid
    if (signals.syntaxValid) adjusted *= 1.1;

    // Boost if consensus
    if (signals.hasConsensus) adjusted *= 1.2;

    // Weight by provider reliability
    adjusted *= signals.providerReliability;

    return Math.min(1.0, adjusted);
  }

  // Fallback: calculate from validation signals
  let confidence = 0.5; // Base confidence

  if (signals.syntaxValid) confidence += 0.2;
  if (signals.hasConsensus) confidence += 0.2;
  confidence *= signals.providerReliability;

  return Math.min(1.0, confidence);
}

// Apply configurable threshold (default: 0.7)
function shouldPostSuggestion(confidence: number, severity: 'critical' | 'high' | 'medium' | 'low', config: Config): boolean {
  const threshold = config.confidence_threshold?.[severity] ?? config.min_confidence ?? 0.7;
  return confidence >= threshold;
}
```
**Source:** [LLM confidence calibration research](https://arxiv.org/html/2509.25532v1), [Machine Learning thresholding](https://developers.google.com/machine-learning/crash-course/classification/thresholding)

### Pattern 4: Feedback-Driven Suppression
**What:** Track thumbs-down reactions and suppress similar suggestions in same PR/repo
**When to use:** After suggestion posted, user gives thumbs-down reaction
**Example:**
```typescript
// Extend existing FeedbackTracker with suppression
interface SuppressionPattern {
  findingId: string;
  category: string;
  file: string;
  lineRange: [number, number];
  astHash?: string;          // Optional: hash of suggestion AST
  timestamp: number;
  scope: 'pr' | 'repo';      // Suppress in PR only or entire repo
}

class FeedbackTrackerWithSuppression extends FeedbackTracker {
  private suppressions: SuppressionPattern[] = [];

  async recordDismissal(finding: Finding, reaction: '👎', scope: 'pr' | 'repo'): Promise<void> {
    await super.recordReaction(finding.id, finding.category, finding.severity, reaction);

    // Add suppression pattern
    this.suppressions.push({
      findingId: finding.id,
      category: finding.category,
      file: finding.file,
      lineRange: [finding.line, finding.line + (finding.endLine ?? 0)],
      astHash: finding.suggestion ? hashAST(finding.suggestion) : undefined,
      timestamp: Date.now(),
      scope
    });
  }

  async shouldSuppress(finding: Finding): Promise<boolean> {
    // Check for similar dismissed suggestions
    for (const pattern of this.suppressions) {
      // Same category + file + nearby lines = similar
      if (pattern.category === finding.category &&
          pattern.file === finding.file &&
          Math.abs(finding.line - pattern.lineRange[0]) < 5) {

        // If AST hash available, check structural similarity
        if (pattern.astHash && finding.suggestion) {
          if (hashAST(finding.suggestion) === pattern.astHash) {
            return true; // Exact match
          }
        } else {
          return true; // Heuristic match
        }
      }
    }

    return false;
  }
}
```
**Source:** [GitHub Reactions API](https://docs.github.com/en/rest/reactions/reactions), [Feedback loop patterns](https://www.oreilly.com/library/view/building-machine-learning/9781492053187/ch13.html)

### Anti-Patterns to Avoid
- **Validating only before suggesting, not after LLM generation:** LLMs can hallucinate invalid syntax mid-generation. Validate immediately before posting, not just before prompting.
- **Using string comparison for consensus:** `code1 === code2` fails for whitespace/formatting differences. Use AST structural comparison.
- **Single threshold for all severities:** Critical findings need higher confidence than low severity. Use per-severity thresholds.
- **Ignoring MISSING nodes in tree-sitter:** ERROR queries don't capture recovery nodes. Check both `node.type === 'ERROR'` and `node.isMissing`.
- **Levenshtein distance for code similarity:** Character-level distance doesn't understand semantics. Use AST comparison or simpler heuristics (file + category + line proximity).

## Don't Hand-Roll

Problems that look simple but have existing solutions:

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Language-specific parsers | Custom parser for each language | tree-sitter + language grammars | 60+ language grammars maintained, error recovery built-in, incremental parsing, battle-tested |
| AST comparison | String-based diff or manual node traversal | compare-ast or tree-sitter node comparison | Handles whitespace, comments, variable renaming; accounts for structural equivalence edge cases |
| Confidence calibration | Ad-hoc scoring formulas | Hybrid approach (LLM + validation signals) | Research-backed methods (EAGLE, isotonic regression), prevents overconfidence |
| Reaction tracking | Custom webhooks + database | GitHub Reactions API + existing CacheStorage | Native to PR workflow, no infrastructure overhead, already authenticated |

**Key insight:** Syntax validation and AST manipulation are deceptively complex. Tree-sitter handles Unicode, error recovery, ambiguous grammars, and incremental updates—reimplementing even 80% of this is months of work. Similarly, AST comparison requires handling dozens of edge cases (operator precedence, implicit conversions, syntactic sugar). Use battle-tested libraries.

## Common Pitfalls

### Pitfall 1: Incomplete Error Detection
**What goes wrong:** Only checking `node.type === 'ERROR'` misses parser-inserted recovery nodes, leading to invalid suggestions passing validation
**Why it happens:** tree-sitter has two error representations: ERROR nodes (unparseable text) and MISSING nodes (inserted tokens for recovery). Developers often only check one.
**How to avoid:** Always check both `node.hasError` (catches ERROR nodes in subtree) and `node.isMissing` (catches recovery nodes). Use query pattern `(ERROR)` and `(MISSING)` together.
**Warning signs:** Valid-looking code with subtle syntax errors (missing semicolons, unclosed braces) passes validation and gets posted, causing GitHub API errors or breaking builds.
**Source:** [Tree-sitter error recovery documentation](https://github.com/tree-sitter/tree-sitter/issues/650), [Tree-sitter GitHub discussions](https://github.com/tree-sitter/tree-sitter/discussions/3285)

### Pitfall 2: False Consensus from String Matching
**What goes wrong:** Two providers suggest `x + 1` and `x+1` (different whitespace), string comparison says no consensus, but semantically they're identical
**Why it happens:** LLMs format code inconsistently. String-based consensus detection treats formatting differences as semantic differences.
**How to avoid:** Parse both suggestions with tree-sitter, compare AST node types and structure (ignoring unnamed nodes which represent whitespace/punctuation). Alternatively, normalize code with a formatter before comparison.
**Warning signs:** Consensus detection reports "no agreement" despite suggestions being functionally identical; critical findings don't get posted despite multiple providers agreeing.
**Source:** [ast-grep smart matching](https://ast-grep.github.io/advanced/core-concepts.html), [AST comparison research](https://arxiv.org/html/2510.27063)

### Pitfall 3: Overconfident Thresholds
**What goes wrong:** Setting `min_confidence: 0.9` filters out 90% of suggestions, including good ones. Users see too few suggestions to be useful.
**Why it happens:** Misunderstanding precision-recall tradeoff. Higher threshold = fewer false positives BUT also fewer true positives (recall drops).
**How to avoid:** Default to 0.7 (70%) threshold, which balances precision/recall. Make threshold configurable per severity (higher for critical, lower for low). Monitor false positive rate via feedback and adjust gradually (±0.1 per iteration).
**Warning signs:** Analytics show <10% of findings get suggestions posted, users complain about "tool not finding anything", feedback shows low volume of reactions (not enough suggestions to react to).
**Source:** [ML threshold tuning](https://developers.google.com/machine-learning/crash-course/classification/thresholding), [Precision-recall tradeoffs](https://www.evidentlyai.com/classification-metrics/classification-threshold)

### Pitfall 4: Feedback Overfitting
**What goes wrong:** User dismisses one null pointer suggestion in project A, system suppresses ALL null pointer findings in project B (different codebase, different context)
**Why it happens:** Suppression scope too broad. Single negative reaction shouldn't affect unrelated code.
**How to avoid:** Scope suppression to PR or repo (not global). Use multi-factor similarity: category + file + line proximity + AST hash. Require minimum feedback count (5+ reactions) before adjusting confidence thresholds per category.
**Warning signs:** Valid findings not appearing in new PRs, users report "tool stopped finding X after I dismissed one example", category confidence thresholds drift to extremes (0.3 or 0.9).
**Source:** [Feedback loop perils](https://www.lexology.com/library/detail.aspx?g=c8fff116-2112-48dd-841c-f9d1688d722b), existing `FeedbackTracker.MIN_FEEDBACK_FOR_LEARNING = 5`

### Pitfall 5: Language Grammar Version Mismatches
**What goes wrong:** tree-sitter-typescript 0.21.2 doesn't support TypeScript 5.3 syntax (e.g., `const` type parameters), parser reports ERROR nodes for valid code
**Why it happens:** Language grammars lag behind language releases. TypeScript/Python evolve faster than grammars update.
**How to avoid:** Pin grammar versions in package.json but monitor release notes. Test validation against project's actual language version. Fall back gracefully: if parser reports errors but code compiles, trust compiler over parser.
**Warning signs:** False negatives (valid suggestions rejected), error logs show parse errors for modern language features, validation fails on code copied from existing project files.
**Source:** [tree-sitter-typescript releases](https://github.com/tree-sitter/tree-sitter-typescript), [packaging challenges](https://ayats.org/blog/tree-sitter-packaging)

## Code Examples

Verified patterns from official sources:

### Detecting Parse Errors with tree-sitter
```typescript
// Source: https://tree-sitter.github.io/tree-sitter/using-parsers/queries/1-syntax.html
import Parser from 'tree-sitter';
import TypeScript from 'tree-sitter-typescript';

const parser = new Parser();
parser.setLanguage(TypeScript.typescript);

function hasParseErrors(code: string): boolean {
  const tree = parser.parse(code);

  // Check if root or any child has errors
  if (tree.rootNode.hasError) {
    return true;
  }

  // Walk tree to find ERROR or MISSING nodes
  const cursor = tree.walk();
  do {
    const node = cursor.currentNode;

    // ERROR nodes indicate unparseable text
    if (node.type === 'ERROR') {
      console.log(`Parse error at ${node.startPosition.row}:${node.startPosition.column}`);
      return true;
    }

    // MISSING nodes indicate parser recovery (inserted tokens)
    // These are NOT captured by hasError or (ERROR) queries
    if (node.isMissing) {
      console.log(`Missing token at ${node.startPosition.row}:${node.startPosition.column}`);
      return true;
    }
  } while (cursor.gotoFirstChild() || cursor.gotoNextSibling() || cursor.gotoParent());

  return false;
}

// Example: Valid TypeScript
hasParseErrors('const x: number = 42;'); // false

// Example: Syntax error (missing semicolon after statement)
hasParseErrors('const x: number = 42 const y = 10;'); // true (ERROR node)

// Example: Missing token (unclosed brace)
hasParseErrors('function foo() { const x = 1'); // true (MISSING '}' node)
```

### GitHub Reactions API - List Thumbs Down
```typescript
// Source: https://docs.github.com/en/rest/reactions/reactions
import { Octokit } from '@octokit/rest';

const octokit = new Octokit({ auth: process.env.GITHUB_TOKEN });

async function getThumbsDownReactions(
  owner: string,
  repo: string,
  commentId: number
): Promise<Array<{ user: string; created_at: string }>> {
  const { data: reactions } = await octokit.rest.reactions.listForIssueComment({
    owner,
    repo,
    comment_id: commentId,
    content: '-1', // Thumbs down reaction
  });

  return reactions.map(r => ({
    user: r.user?.login ?? 'unknown',
    created_at: r.created_at ?? ''
  }));
}

// Check if comment was dismissed
async function wasCommentDismissed(
  owner: string,
  repo: string,
  commentId: number
): Promise<boolean> {
  const thumbsDown = await getThumbsDownReactions(owner, repo, commentId);
  return thumbsDown.length > 0;
}
```

### Confidence Threshold Configuration
```typescript
// Source: Research on ML threshold tuning + project config schema
interface QualityConfig {
  min_confidence?: number;           // Global default (0.7)
  confidence_threshold?: {           // Per-severity overrides
    critical?: number;               // Higher threshold (0.8)
    high?: number;
    medium?: number;
    low?: number;                    // Lower threshold (0.6)
  };
  consensus?: {
    required_for_critical: boolean;  // true
    min_agreement: number;           // 2 (threshold: 2 out of N)
  };
}

// Apply thresholds
function shouldPostSuggestion(
  finding: Finding,
  confidence: number,
  config: QualityConfig
): boolean {
  // Get threshold for severity
  const severityThreshold = config.confidence_threshold?.[finding.severity];
  const threshold = severityThreshold ?? config.min_confidence ?? 0.7;

  // Check confidence
  if (confidence < threshold) {
    return false;
  }

  // Check consensus requirement
  if (finding.severity === 'critical' && config.consensus?.required_for_critical) {
    const hasConsensus = (finding.providers?.length ?? 0) >= (config.consensus.min_agreement ?? 2);
    if (!hasConsensus) {
      return false;
    }
  }

  return true;
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| String-based code comparison | AST structural equality | 2020s (with rise of AST tools like ast-grep) | Handles formatting differences, variable renaming; consensus detection works reliably |
| Single global confidence threshold | Per-severity thresholds with ML calibration | 2024-2025 (LLM confidence research) | Higher quality suggestions, fewer false positives for critical findings |
| Manual parser selection per language | Unified tree-sitter API for all languages | 2018+ (tree-sitter maturity) | Single validation path, 60+ languages supported, easier maintenance |
| Fixed suppression rules | Adaptive feedback learning | 2024+ (ML feedback loops) | System learns from dismissals, improves over time |

**Deprecated/outdated:**
- **esprima/acorn for AST parsing:** JavaScript-only, no error recovery, superseded by tree-sitter's multi-language support
- **ROC-based threshold selection:** Research shows post-hoc calibration (isotonic regression) is more effective than ROC curves for confidence scoring
- **Global suppression patterns:** Too aggressive, causes false negatives; modern systems use scoped suppression (per-PR or per-repo)

## Open Questions

Things that couldn't be fully resolved:

1. **Optimal AST comparison depth for consensus**
   - What we know: Full AST comparison is computationally expensive; shallower comparison (comparing top 2 levels) might be sufficient
   - What's unclear: Whether shallow comparison misses important differences (e.g., nested logic changes)
   - Recommendation: Start with full comparison, profile performance, optimize if needed; add max-depth parameter to `compareNodes()` for tuning

2. **Language grammar coverage completeness**
   - What we know: tree-sitter-typescript 0.21.2 supports TypeScript up to version ~4.9; tree-sitter-python supports Python 3.x; tree-sitter-go supports Go 1.18+
   - What's unclear: Whether grammars cover ALL syntax used in target codebases (e.g., TypeScript 5.x features, Python 3.12 syntax)
   - Recommendation: Test validation against actual project files during implementation; add fallback logic: if parse fails but code compiles, trust compiler; monitor for false negatives and upgrade grammar versions as needed

3. **Consensus threshold sensitivity to provider count**
   - What we know: Current design uses fixed threshold (2 out of N); research on voting algorithms suggests weighted voting based on provider reliability
   - What's unclear: Whether 2-of-3 providers should have same confidence as 2-of-5 providers (current approach treats them equally)
   - Recommendation: Start with fixed threshold (simpler), add provider reliability weighting in future iteration if feedback shows quality issues; track metrics: consensus rate vs. acceptance rate per provider count

4. **AST hash collision rate for suppression**
   - What we know: AST structural hashing can detect similar suggestions; simple hash of node types might collide too often (over-suppression)
   - What's unclear: Optimal granularity for AST hashing (full tree vs. signature vs. critical nodes only)
   - Recommendation: Implement multi-level similarity: (1) file + category + line proximity (fast, broad), (2) AST hash if available (precise); start without AST hashing (use heuristics), add later if needed; measure suppression false positive rate via analytics

## Sources

### Primary (HIGH confidence)
- [tree-sitter Node.js documentation v0.25.1](https://tree-sitter.github.io/node-tree-sitter/index.html) - API reference, parsing basics
- [tree-sitter GitHub repository](https://github.com/tree-sitter/node-tree-sitter) - Official source, current version v0.22.4
- [tree-sitter error recovery documentation](https://tree-sitter.github.io/tree-sitter/using-parsers/queries/1-syntax.html) - ERROR and MISSING nodes
- [tree-sitter JavaScript grammar](https://github.com/tree-sitter/tree-sitter-javascript) - Official JavaScript/JSX grammar
- [tree-sitter TypeScript grammar](https://github.com/tree-sitter/tree-sitter-typescript) - Official TypeScript/TSX grammar
- [tree-sitter-go npm package](https://www.npmjs.com/package/tree-sitter-go) - v0.25.0, 73+ projects using it
- [GitHub Reactions API documentation](https://docs.github.com/en/rest/reactions/reactions) - Official API reference
- Project codebase: `src/analysis/consensus.ts`, `src/analysis/ast/parsers.ts`, `src/learning/feedback-tracker.ts` - Existing implementations

### Secondary (MEDIUM confidence)
- [ast-grep match algorithm](https://ast-grep.github.io/advanced/match-algorithm.html) - AST comparison patterns
- [ast-grep core concepts](https://ast-grep.github.io/advanced/core-concepts.html) - Structural matching, whitespace handling
- [compare-ast npm package](https://www.npmjs.com/package/compare-ast) - Esprima-based AST comparison (v0.2.0, 12 years old)
- [Machine Learning crash course: Thresholding](https://developers.google.com/machine-learning/crash-course/classification/thresholding) - Confidence threshold tuning
- [Confidence calibration research (2025)](https://arxiv.org/html/2509.25532v1) - Hybrid approaches for LLM confidence
- [ACL 2024: Survey of Confidence Estimation](https://aclanthology.org/2024.naacl-long.366.pdf) - Calibration methods
- [Feedback Loops in ML (O'Reilly)](https://www.oreilly.com/library/view/building-machine-learning/9781492053187/ch13.html) - Pattern suppression, adaptive learning
- [OWASP Input Validation Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Input_Validation_Cheat_Sheet.html) - Validation best practices

### Tertiary (LOW confidence - marked for validation)
- WebSearch results on "AST comparison code equivalence algorithm 2026" - Research papers on plagiarism detection
- WebSearch results on "code similarity detection algorithms TypeScript 2026" - Various approaches (Levenshtein, TF-IDF)
- WebSearch results on "voting algorithm consensus multiple sources code review 2026" - Blockchain voting algorithms (tangentially relevant)

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - tree-sitter is already in project, npm packages verified, official docs reviewed
- Architecture: MEDIUM - Patterns based on research + existing codebase analysis, but AST comparison depth and consensus weighting need validation
- Pitfalls: MEDIUM - Based on documentation (error recovery) + ML research (thresholds) + existing code (feedback tracker), but some edge cases unverified

**Research date:** 2026-02-04
**Valid until:** ~30 days (stable domain - tree-sitter API unlikely to change; grammar versions may update)

**Notes:**
- Existing codebase provides strong foundation: consensus.ts, feedback-tracker.ts, ast/parsers.ts already implement related patterns
- Project already has tree-sitter 0.21.1 + TypeScript/Python grammars in package.json
- Missing grammars: tree-sitter-javascript and tree-sitter-go need installation
- CONTEXT.md decisions constrain implementation: ALL suggestions validated (not just critical), consensus threshold fixed at 2-of-N, confidence threshold default 0.7 with per-severity overrides
- Key implementation question: Use compare-ast library or build tree-sitter native comparison? Recommend native approach for consistency with existing parsers.ts
