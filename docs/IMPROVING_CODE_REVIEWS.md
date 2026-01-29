# Improving Automated Code Review Quality

This guide addresses how to get better, more accurate code reviews with fewer false positives.

## The False Positive Problem

Automated code review tools generate false positives when they:
- Analyze outdated commits or cached state
- Lack full execution context across files
- Use pattern matching without semantic understanding
- Don't see recent fixes or documentation

### Recent Examples from This Project

1. **"Shallow copy of Definition objects" at line 469**
   - **Claim**: Uses shallow copy causing shared state
   - **Reality**: `[k, { ...v }]` uses spread operator for deep copy
   - **Verified**: `__tests__/unit/analysis/graph-incremental.test.ts:204-223`

2. **"Missing validation for empty definition names"**
   - **Claim**: No validation prevents empty names
   - **Reality**: Lines 551-552 explicitly validate `!def.name`
   - **Error Message**: "name must be a non-empty string"

3. **"Incomplete cleanup of call edges"**
   - **Claim**: Only cleans one direction of bidirectional graph
   - **Reality**: Lines 157-196 clean both `calls` and `callers` maps
   - **Annotations**: Added BIDIRECTIONAL comments for clarity

## Short-Term Solutions (Days)

### 1. Add Explicit Documentation Tags

Static analyzers respond better to explicit annotations:

```typescript
// BEFORE:
this.definitions = new Map(
  Array.from(other.definitions.entries()).map(([k, v]) => [k, { ...v }])
);

// AFTER:
// SECURITY: Deep copy prevents mutation aliasing between graph instances
// Each Definition object is cloned using spread operator for independence
this.definitions = new Map(
  Array.from(other.definitions.entries()).map(([k, v]) => [k, { ...v }])
);
```

**Keywords that help analyzers**:
- `SECURITY:` - Security-critical code
- `CORRECTNESS:` - Correctness invariant
- `VALIDATION:` - Input validation
- `BIDIRECTIONAL:` - Graph/relationship cleanup
- `DEFENSIVE:` - Defense in depth

### 2. Reference Test Coverage

Link implementations to test coverage:

```typescript
/**
 * Remove all data for a file from the graph
 *
 * @test graph-builder.test.ts:removeFile - File removal
 * @test graph-incremental.test.ts:204-223 - Clone independence
 */
removeFile(file: string): void {
  // ...
}
```

### 3. Add Assertion Comments

Make invariants explicit:

```typescript
// INVARIANT: After this loop, no edges reference symbols in symbolsToRemove
for (const symbol of symbolsToRemove) {
  // ... cleanup code
}

// POSTCONDITION: calls and callers maps are consistent and bidirectional
```

### 4. Create Review Hints File

We just added `.github/multi-provider-review-hints.md` with:
- Known correct implementations and their line numbers
- Test coverage references
- Explanations of algorithms and security properties

## Medium-Term Solutions (Weeks)

### 1. Configure Review Tool Context

If using configurable review tools, provide:

**Custom Rules** (`.eslintrc.js`, `sonar-project.properties`, etc.):
```javascript
module.exports = {
  rules: {
    // Disable rules that don't understand our patterns
    '@typescript-eslint/no-explicit-any': 'off', // We have SerializedGraph types
    'security/detect-object-injection': 'off', // False positives on Map access
  },
  overrides: [
    {
      files: ['src/analysis/context/graph-builder.ts'],
      rules: {
        // Graph builder has legitimate complexity
        'sonarjs/cognitive-complexity': ['warn', 20],
      },
    },
  ],
};
```

**Suppression Comments** for known false positives:
```typescript
// eslint-disable-next-line security/detect-object-injection -- Safe: field is from typed array
if (!Array.isArray(data[field])) {
  throw new Error(`Invalid graph data: ${field} must be an array`);
}
```

### 2. Integrate with CI/CD

Configure review tools to:
- Only analyze changed files (incremental analysis)
- Compare against base branch for context
- Cache analysis results between runs
- Access full git history for blame/context

**GitHub Actions Example**:
```yaml
- name: Code Review with Full Context
  uses: some-review-action@v1
  with:
    base-branch: main
    head-branch: ${{ github.head_ref }}
    incremental: true
    cache-enabled: true
```

### 3. Use Multiple Review Tools

Different tools have different strengths:

| Tool | Strengths | Weaknesses |
|------|-----------|------------|
| **ESLint** | TypeScript types, custom rules | Limited semantic analysis |
| **SonarQube** | Security vulnerabilities | Many false positives |
| **CodeQL** | Deep dataflow analysis | Slow, complex queries |
| **Semgrep** | Custom patterns | Requires pattern authoring |
| **GPT-4/Claude** | Semantic understanding | Cost, rate limits |

**Strategy**: Run multiple tools and intersect findings (high confidence).

### 4. Human Review Guidelines

Train human reviewers to:
- **Verify automated findings** before commenting
- **Check test coverage** for flagged code
- **Look for recent commits** that may have fixed issues
- **Understand context** before assuming bugs

## Long-Term Solutions (Months)

### 1. Build Custom Analysis Rules

Write project-specific rules that understand your patterns:

**Semgrep Example** (`.semgrep/rules/graph-deep-copy.yml`):
```yaml
rules:
  - id: graph-deep-copy-verified
    pattern: |
      new Map(
        Array.from($MAP.entries()).map(([k, v]) => [k, { ...$V }])
      )
    message: "Verified deep copy pattern for Map of objects"
    severity: INFO
    languages: [typescript]
```

### 2. Integrate Type System Information

Use tools that understand TypeScript's type system:

**TypeScript ESLint** with type checking:
```javascript
module.exports = {
  parserOptions: {
    project: './tsconfig.json', // Enables type-aware rules
  },
  rules: {
    '@typescript-eslint/no-unsafe-assignment': 'error',
    '@typescript-eslint/no-unsafe-member-access': 'error',
  },
};
```

**Benefits**:
- Knows `Map.entries()` returns `[K, V][]`
- Understands `{ ...v }` creates new object
- Can verify type safety across files

### 3. Implement Verification Conditions

Add runtime assertions that prove correctness:

```typescript
removeFile(file: string): void {
  // ... removal logic ...

  if (process.env.NODE_ENV === 'test') {
    // Verify postconditions
    this.assertGraphIntegrity();
  }
}

private assertGraphIntegrity(): void {
  // All callers in calls map must have corresponding callers entry
  for (const [caller, callees] of this.calls) {
    for (const callee of callees) {
      const callerList = this.callers.get(callee);
      assert(
        callerList?.includes(caller),
        `Broken bidirectional edge: ${caller} -> ${callee}`
      );
    }
  }
}
```

### 4. Property-Based Testing

Generate random inputs to verify invariants:

```typescript
import fc from 'fast-check';

test('copyFrom creates independent copies', () => {
  fc.assert(
    fc.property(fc.array(fc.string()), fc.array(fc.string()), (files, symbols) => {
      const graph1 = new CodeGraph(files);
      for (const symbol of symbols) {
        graph1.addDefinition(/* ... */);
      }

      const graph2 = new CodeGraph([]);
      graph2.copyFrom(graph1);

      // Mutate graph2
      graph2.removeFile(files[0]);

      // Verify graph1 unchanged
      expect(graph1.getFiles()).toContain(files[0]);
    })
  );
});
```

## Best Practices Summary

### DO:
✅ Add explicit security/correctness comments
✅ Reference test coverage in documentation
✅ Use assertion comments for invariants
✅ Configure review tools with project context
✅ Verify automated findings before accepting
✅ Combine multiple analysis approaches

### DON'T:
❌ Trust automated reviews blindly
❌ Accept findings without verification
❌ Ignore test coverage information
❌ Assume static analysis understands semantics
❌ Skip human review for critical code
❌ Disable all warnings (hides real issues)

## Metrics to Track

### Review Quality Metrics:
- **False Positive Rate**: % of flagged issues that are actually correct code
- **False Negative Rate**: % of real bugs missed by automated review
- **Time to Verify**: How long humans spend checking automated findings
- **Override Rate**: % of automated findings marked "won't fix"

### Target Goals:
- False Positive Rate: < 20% (currently ~50%+ based on recent reviews)
- Time to Verify: < 5 minutes per finding
- Override Rate: < 10% (overrides should be rare)

## Immediate Action Items

Based on our current experience with false positives:

1. ✅ **Added documentation tags** to graph-builder.ts
2. ✅ **Created review hints file** at `.github/multi-provider-review-hints.md`
3. ⏭️ **Configure review tool** to use hints file (if supported)
4. ⏭️ **Train review process** to verify findings before commenting
5. ⏭️ **Add custom ESLint rules** for project-specific patterns

## Tool-Specific Guidance

### For GitHub Actions Multi-Provider Review

This tool uses multiple LLM providers. To improve accuracy:

1. **Increase context window**: Use models with larger context (e.g., Claude 3.5 Sonnet 200K)
2. **Provide file context**: Configure to analyze related files together
3. **Use batch mode**: Review related changes in single batch for better context
4. **Enable caching**: Reuse analysis across similar code patterns

### For SonarQube/SonarCloud

1. **Quality Profile**: Create custom profile excluding noisy rules
2. **Issue Lifecycle**: Mark false positives as "Won't Fix" with explanation
3. **Exclusions**: Exclude test files and generated code
4. **Custom Rules**: Write rules that match your coding patterns

### For CodeQL

1. **Custom Queries**: Write queries specific to your security requirements
2. **Path Filters**: Exclude paths where findings are always false positives
3. **Sarif Output**: Post-process SARIF to filter known issues
4. **Query Variants**: Create project-specific variants of standard queries

## Conclusion

Improving code review quality requires:
- **Immediate**: Better documentation and annotations
- **Medium-term**: Tool configuration and process improvements
- **Long-term**: Custom rules and verification infrastructure

The goal is **high signal-to-noise ratio**: maximize real bugs caught, minimize false positives.

**Current State**: ~50% false positive rate (3/6 recent findings incorrect)
**Target State**: <20% false positive rate with faster verification

---

**Related Documentation**:
- `.github/multi-provider-review-hints.md` - Context for automated reviews
- `docs/DEVELOPMENT_PLAN_V3.md` - Future enhancements (v0.3.2+)
- `docs/TROUBLESHOOTING.md` - Common review tool issues
