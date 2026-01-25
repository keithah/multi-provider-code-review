# User Guide

## Dismissing Findings

Multi-Provider Code Review supports dismissing individual findings that you don't want to see again. This is useful for:

- **False positives** - Findings that aren't actually issues
- **Intentional patterns** - Code that's flagged but acceptable for your use case
- **Acknowledged technical debt** - Issues you're aware of but not ready to fix

### How to Dismiss a Finding

When the action posts an inline review comment on your PR, you can dismiss it by adding a thumbs-down (👎) reaction to the comment.

**Steps:**

1. Navigate to the inline review comment you want to dismiss
2. Click the reaction button (😊) on the comment
3. Select the thumbs-down (👎) emoji

**What happens next:**

- The system remembers this dismissal for the current PR
- If you update your PR and the same finding appears again, it will be **automatically suppressed**
- The finding won't appear in inline comments on subsequent reviews

### How the System Identifies Findings

The suppression system creates a unique signature for each finding based on:

- **File path** (case-insensitive)
- **Line number**
- **Finding title** (extracted from bold text in the comment, case-insensitive)

For example, if you dismiss a "Security Issue" finding at `src/auth.ts:42`, the system will suppress any future finding with the same title at that exact location.

### Important Notes

- **Per-PR scope**: Suppressions are specific to each pull request
- **Incremental reviews**: Works seamlessly with incremental review mode
- **Safe to use**: Dismissing a finding doesn't affect other PRs or branches
- **Reversible**: Remove the 👎 reaction to un-dismiss a finding

### Example

**Initial Review:**
```
📝 Inline Comment at src/api/auth.ts:42

**Potential SQL Injection**

The query construction uses string concatenation which could lead to SQL injection.
Consider using parameterized queries instead.
```

**You add a 👎 reaction because:**
- You're using an ORM that auto-escapes queries
- This is a false positive

**Next Review (after PR update):**
- The same finding at `src/api/auth.ts:42` will NOT be posted
- New findings or findings at different lines will still appear

## Feedback Learning

The action also learns from your positive feedback (👍 reactions) to improve confidence scoring over time.

### How It Works

- **Thumbs Up (👍)**: Indicates the finding is valuable
- **Thumbs Down (👎)**: Suppresses the finding and indicates it's not useful

The system tracks:
- Which findings get positive vs. negative reactions
- Provider agreement on findings
- Confidence levels over time

### Configuration

Feedback learning is controlled by these environment variables:

```yaml
- LEARNING_ENABLED: true  # Enable feedback learning
- LEARNING_MIN_FEEDBACK_COUNT: 5  # Min feedback before adjusting confidence
- LEARNING_LOOKBACK_DAYS: 30  # How far back to look for feedback
```

See the main [README](../README.md#configuration) for full configuration options.

## Tips for Effective Review

### When to Dismiss

✅ **Good reasons to dismiss:**
- Confirmed false positive after investigation
- Finding conflicts with your team's style guide
- External library code you can't modify
- Technical debt that's tracked elsewhere

❌ **Avoid dismissing:**
- Legitimate security issues
- Actual bugs
- Findings you haven't investigated
- Issues because "the tests pass"

### Managing Noise

If you're seeing too many low-confidence findings, consider:

1. **Quiet Mode**: Filters findings below a confidence threshold
   ```yaml
   - QUIET_MODE_ENABLED: true
   - QUIET_MIN_CONFIDENCE: 0.6  # Only show findings ≥60% confidence
   ```

2. **Severity Filtering**: Only show critical/major findings
   ```yaml
   - INLINE_MIN_SEVERITY: major  # Skip minor findings in inline comments
   ```

3. **Comment Limits**: Cap the number of inline comments
   ```yaml
   - INLINE_MAX_COMMENTS: 20  # Maximum inline comments per review
   ```

### Working with the Summary Comment

The action posts a summary comment on each PR with:
- Overall statistics (critical/major/minor counts)
- All findings grouped by severity
- Performance metrics (duration, cost, providers used)

**On incremental reviews**, the summary comment is updated in place rather than creating a new comment each time.

## Advanced Usage

### Dry Run Mode

Test the action without posting comments:

```yaml
- DRY_RUN: true
```

The action will:
- Run the full review
- Generate all findings and comments
- Log what it would have posted (check Action logs)
- NOT actually post any comments to GitHub

### Custom Severity Thresholds

Control which findings appear in inline comments vs. summary only:

```yaml
# Only post critical findings as inline comments
- INLINE_MIN_SEVERITY: critical

# Require high provider agreement for inline comments
- INLINE_MIN_AGREEMENT: 0.7  # 70% of providers must agree
```

### Performance Optimization

For large PRs, optimize review speed:

```yaml
# Enable incremental mode (reviews only changed files since last run)
- INCREMENTAL_ENABLED: true

# Use faster models for AST analysis
- ENABLE_AST_ANALYSIS: false  # Disable AST if not needed

# Limit concurrent provider calls
- PROVIDER_MAX_PARALLEL: 3  # Reduce parallel requests
```

See [analytics.md](analytics.md) for tracking costs and performance.
