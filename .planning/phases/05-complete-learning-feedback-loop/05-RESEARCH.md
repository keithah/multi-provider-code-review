# Phase 5: Complete Learning Feedback Loop - Research

**Researched:** 2026-02-05
**Domain:** GitHub Actions workflow orchestration, runtime component wiring, feedback loop integration
**Confidence:** HIGH

## Summary

Research focused on how to wire the existing AcceptanceDetector implementation (from Phase 4, Plan 08) into the runtime execution path to enable positive feedback learning. The primary challenge is orchestrating acceptance detection in a GitHub Actions workflow environment where webhooks for reactions don't exist, requiring a polling-based approach.

**Key Findings:**

1. **Existing patterns established**: Phase 4 Plan 09 demonstrates the exact wiring pattern needed - instantiate components in setup.ts and pass to consumers. AcceptanceDetector follows the same pattern as SuppressionTracker and ProviderWeightTracker.

2. **No webhook for reactions**: GitHub does not provide webhooks for comment reactions, only for comments themselves. This means acceptance detection via reactions requires API polling on workflow runs.

3. **Natural trigger point**: The `pull_request: synchronize` event (triggered when new commits are pushed) is the ideal time to detect acceptances, as this is when users have had time to review and react to suggestions.

4. **Orchestration location**: FeedbackFilter already loads reactions during each review run (line 22-27 in feedback.ts). This is the natural integration point - extend it to also detect and record acceptances.

**Primary recommendation:** Wire AcceptanceDetector into setup.ts following the exact pattern from Plan 04-09, then extend the orchestrator's feedback loading step to call acceptance detection methods and record results to ProviderWeightTracker.

## Standard Stack

The established libraries/tools for this integration pattern:

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| @actions/github | 6.0.0+ | GitHub API client | Official GitHub Actions toolkit, used throughout codebase |
| Octokit | via @actions/github | REST API wrapper | Standard GitHub API client, already integrated |
| TypeScript | 5.x | Type safety | Project standard, all components typed |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| CacheStorage | internal | Persistent storage | Already used by all learning components |
| ProviderWeightTracker | internal | Weight management | Already instantiated in setup.ts (Plan 04-09) |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Polling on workflow runs | GitHub webhooks | Webhooks don't exist for reactions (confirmed by GitHub community discussion #20824) |
| Separate orchestration service | Extend existing orchestrator | Adds complexity, no benefit for this use case |
| Custom event trigger | Use existing pull_request events | Custom triggers require separate infrastructure |

**Installation:**

No new dependencies required. All components already present in the codebase.

## Architecture Patterns

### Recommended Integration Structure

**Current architecture (from Phase 4):**
```
setup.ts
├── SuppressionTracker (instantiated)
├── ProviderWeightTracker (instantiated)
├── PromptEnricher (instantiated)
└── AcceptanceDetector (EXISTS but NOT instantiated) ← MISSING LINK
```

**Target architecture:**
```
setup.ts
├── AcceptanceDetector (instantiated with ProviderWeightTracker) ← ADD THIS
└── orchestrator.ts
    └── executeReview()
        └── FeedbackFilter.loadSuppressed()
            └── [NEW] Call AcceptanceDetector methods ← EXTEND THIS
                ├── detectFromCommits(commits, commentedFiles)
                ├── detectFromReactions(commentReactions)
                └── recordAcceptances(acceptances, weightTracker)
```

### Pattern 1: Component Wiring in setup.ts

**What:** Instantiate components with their dependencies in setup functions, following dependency injection pattern

**When to use:** For all components that need to be available during review execution

**Example from Phase 4 Plan 09:**
```typescript
// Source: src/setup.ts lines 242-246 (Phase 4 Plan 09)
const cacheStorage = new CacheStorage();
const repoKey = `${githubClient.owner}/${githubClient.repo}`;
const suppressionTracker = new SuppressionTracker(cacheStorage, repoKey);
const providerWeightTracker = new ProviderWeightTracker(cacheStorage);
const commentPoster = new CommentPoster(
  githubClient,
  config.dryRun,
  config,
  suppressionTracker,
  providerWeightTracker
);
```

**Apply same pattern for AcceptanceDetector:**
```typescript
// In both createComponents() and createComponentsForCLI()
const acceptanceDetector = new AcceptanceDetector();
// Pass to orchestrator or make available via ReviewComponents
```

### Pattern 2: Orchestration Hook Pattern

**What:** Extend existing orchestration points to add new behavior without disrupting core flow

**When to use:** When adding feedback/learning behavior that should run alongside existing operations

**Current pattern in orchestrator.ts:**
```typescript
// Source: src/core/orchestrator.ts lines 696-698
const suppressed = await this.components.feedbackFilter.loadSuppressed(pr.number);
const inlineFiltered = review.inlineComments.filter(c =>
  this.components.feedbackFilter.shouldPost(c, suppressed));
```

**Extend with acceptance detection:**
```typescript
// After loading suppressed, before filtering
const suppressed = await this.components.feedbackFilter.loadSuppressed(pr.number);

// NEW: Detect and record acceptances
if (this.components.acceptanceDetector && this.components.providerWeightTracker) {
  await this.detectAndRecordAcceptances(pr.number);
}

const inlineFiltered = review.inlineComments.filter(c =>
  this.components.feedbackFilter.shouldPost(c, suppressed));
```

### Pattern 3: Feedback Collection Pattern

**What:** Fetch PR comments and reactions, map to file/line/provider metadata, detect acceptances

**When to use:** During each review run, after posting comments (on subsequent runs)

**Implementation approach:**
```typescript
// New orchestrator method
private async detectAndRecordAcceptances(prNumber: number): Promise<void> {
  // 1. Fetch PR commits (for commit-based acceptances)
  const commits = await this.fetchPRCommits(prNumber);

  // 2. Fetch review comments with reactions
  const comments = await this.fetchReviewCommentsWithReactions(prNumber);

  // 3. Build file/line/provider map from comments
  const commentedFiles = this.buildCommentMetadataMap(comments);

  // 4. Detect acceptances from both sources
  const commitAcceptances = this.components.acceptanceDetector.detectFromCommits(
    commits,
    commentedFiles
  );
  const reactionAcceptances = this.components.acceptanceDetector.detectFromReactions(
    comments
  );

  // 5. Record all acceptances
  const allAcceptances = [...commitAcceptances, ...reactionAcceptances];
  await this.components.acceptanceDetector.recordAcceptances(
    allAcceptances,
    this.components.providerWeightTracker
  );

  logger.info(`Recorded ${allAcceptances.length} suggestion acceptances`);
}
```

### Anti-Patterns to Avoid

- **Don't poll on every event**: Only check for acceptances on `pull_request: synchronize` or workflow_dispatch, not on every comment/reaction
- **Don't duplicate feedback loading**: Reuse GitHub API responses from FeedbackFilter where possible to minimize API calls
- **Don't wire before dependencies exist**: AcceptanceDetector requires ProviderWeightTracker - ensure it's instantiated first
- **Don't mutate shared components**: Pass dependencies as constructor args, don't modify shared instances

## Don't Hand-Roll

Problems that look simple but have existing solutions:

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Detecting suggestion commits | Custom commit message parser | AcceptanceDetector.detectFromCommits | Already implements GitHub's patterns with tests |
| Mapping reactions to providers | Custom metadata parser | AcceptanceDetector.detectFromReactions | Handles provider attribution edge cases |
| Recording feedback | Direct ProviderWeightTracker calls | AcceptanceDetector.recordAcceptances | Centralizes acceptance recording logic |
| GitHub API pagination | Custom pagination logic | Octokit.paginate | Built-in, handles rate limits |
| Provider attribution storage | Custom comment metadata | CommentPoster provider tracking | Already embeds provider in comments |

**Key insight:** Phase 4 Plan 08 already implemented all acceptance detection logic with comprehensive tests (20 test cases). The only missing piece is runtime wiring and orchestration - don't reimplement detection logic.

## Common Pitfalls

### Pitfall 1: Webhook Assumption for Reactions

**What goes wrong:** Assuming GitHub provides webhooks for reaction events, leading to reactive architecture that never triggers

**Why it happens:** Intuitive assumption that all GitHub events have webhooks

**How to avoid:**
- Confirmed by GitHub community discussion #20824: "Webhooks for reactions on pull request review comments" is a feature request, not an existing capability
- Use polling approach on workflow runs instead
- The `pull_request: synchronize` event already triggers on new commits, providing natural check point

**Warning signs:**
- Workflow never detects acceptances despite reactions being added
- No logs showing acceptance detection calls
- Provider weights don't increase despite accepted suggestions

### Pitfall 2: Missing Provider Attribution

**What goes wrong:** Cannot attribute acceptances to providers when comments lack provider metadata

**Why it happens:** Provider tracking was added in Phase 4, but earlier comments don't have it

**How to avoid:**
- Use "unknown" provider fallback (already in AcceptanceDetector implementation)
- CommentPoster embeds provider in comments (Phase 4 Plan 06) - new comments have attribution
- Accept graceful degradation for historical comments

**Warning signs:**
- Most acceptances recorded with "unknown" provider
- Provider weights don't reflect actual acceptance patterns
- Logs show missing provider in acceptance events

### Pitfall 3: API Rate Limit Exhaustion

**What goes wrong:** Fetching all comments and reactions on every workflow run exceeds GitHub API rate limits

**Why it happens:** Each PR can have hundreds of comments, each requiring separate reaction API calls

**How to avoid:**
- GitHub API rate limit: 5000 requests/hour for authenticated Actions workflows
- GitHubClient already implements rate limiting and backoff (lines 56-95 in client.ts)
- FeedbackFilter already paginates comments efficiently (line 13-18 in feedback.ts)
- Reuse existing API response data where possible

**Warning signs:**
- GitHub API returns 403 errors
- GitHubClient logs show rate limit warnings
- Workflow failures due to API exhaustion

### Pitfall 4: Race Conditions with Concurrent Reviews

**What goes wrong:** Multiple workflow runs on different PRs conflict when recording provider weights

**Why it happens:** CacheStorage uses file-based persistence, concurrent writes can corrupt

**How to avoid:**
- ProviderWeightTracker already uses CacheStorage which handles file locks
- GitHub Actions concurrency control prevents same PR from running concurrently (workflow config line 38-44)
- Different PRs use different cache keys (`${owner}/${repo}` scoped)

**Warning signs:**
- Inconsistent provider weight values
- Cache corruption errors
- Missing weight updates despite recorded acceptances

### Pitfall 5: Detecting Acceptances Before Comments Posted

**What goes wrong:** First workflow run tries to detect acceptances before any comments exist

**Why it happens:** Acceptance detection runs on every PR update, including initial review

**How to avoid:**
- Check if comments exist before attempting detection
- FeedbackFilter.loadSuppressed already handles empty comment lists gracefully
- AcceptanceDetector methods return empty arrays for no matches (safe)

**Warning signs:**
- Errors when fetching comments on new PRs
- Unnecessary API calls on initial review
- Logs showing "0 acceptances" is expected, not an error

## Code Examples

Verified patterns from implementation and Phase 4:

### Component Wiring in setup.ts

```typescript
// Source: Extending setup.ts following Plan 04-09 pattern

// In createComponents() function (production mode):
import { AcceptanceDetector } from './learning/acceptance-detector';

// After providerWeightTracker instantiation (around line 245):
const providerWeightTracker = new ProviderWeightTracker(cacheStorage);
const acceptanceDetector = new AcceptanceDetector();

// Add to ReviewComponents return (around line 284):
return {
  config,
  providerRegistry,
  // ... other components
  suppressionTracker,      // Already added in Plan 04-09
  providerWeightTracker,   // Already added in Plan 04-09
  acceptanceDetector,      // NEW: Add this
  githubClient,
};

// Also add to ReviewComponents interface in orchestrator.ts:
export interface ReviewComponents {
  config: ReviewConfig;
  // ... other components
  suppressionTracker?: SuppressionTracker;
  providerWeightTracker?: ProviderWeightTracker;
  acceptanceDetector?: AcceptanceDetector;  // NEW: Add this
  githubClient?: GitHubClient;
}
```

### Orchestration Hook in executeReview()

```typescript
// Source: Extending orchestrator.ts executeReview() method

// Add after feedback filter loading (after line 698):
const suppressed = await this.components.feedbackFilter.loadSuppressed(pr.number);

// NEW: Detect and record acceptances
if (this.components.acceptanceDetector &&
    this.components.providerWeightTracker &&
    this.components.githubClient) {
  try {
    await this.detectAndRecordAcceptances(pr.number);
  } catch (error) {
    // Don't fail review if acceptance detection fails
    logger.warn('Failed to detect acceptances', error as Error);
  }
}

const inlineFiltered = review.inlineComments.filter(c =>
  this.components.feedbackFilter.shouldPost(c, suppressed));
```

### Acceptance Detection Implementation

```typescript
// Source: New private method in ReviewOrchestrator class

private async detectAndRecordAcceptances(prNumber: number): Promise<void> {
  const { githubClient, acceptanceDetector, providerWeightTracker } = this.components;
  if (!githubClient || !acceptanceDetector || !providerWeightTracker) return;

  const { octokit, owner, repo } = githubClient;

  // 1. Fetch PR commits
  const commitsResponse = await octokit.rest.pulls.listCommits({
    owner,
    repo,
    pull_number: prNumber,
    per_page: 100,
  });

  const commits = commitsResponse.data.map(commit => ({
    sha: commit.sha,
    message: commit.commit.message,
    files: commit.files?.map(f => f.filename) || [],
    timestamp: new Date(commit.commit.author?.date || Date.now()).getTime(),
  }));

  // 2. Fetch review comments with reactions
  const comments = await octokit.paginate(octokit.rest.pulls.listReviewComments, {
    owner,
    repo,
    pull_number: prNumber,
    per_page: 100,
  });

  const commentReactions = [];
  for (const comment of comments) {
    const reactions = await octokit.rest.reactions.listForPullRequestReviewComment({
      owner,
      repo,
      comment_id: comment.id,
    });

    // Extract provider from comment body (embedded by CommentPoster)
    const providerMatch = comment.body?.match(/\*\*Provider:\*\* `([^`]+)`/);
    const provider = providerMatch?.[1];

    commentReactions.push({
      commentId: comment.id,
      file: comment.path,
      line: comment.line || comment.original_line || 0,
      provider,
      reactions: reactions.data.map(r => ({
        user: r.user?.login || 'unknown',
        content: r.content,
      })),
    });
  }

  // 3. Build file/line/provider map for commit detection
  const commentedFiles = new Map<string, Array<{ line: number; provider?: string }>>();
  for (const comment of comments) {
    const file = comment.path;
    const line = comment.line || comment.original_line || 0;
    const providerMatch = comment.body?.match(/\*\*Provider:\*\* `([^`]+)`/);
    const provider = providerMatch?.[1];

    if (!commentedFiles.has(file)) {
      commentedFiles.set(file, []);
    }
    commentedFiles.get(file)!.push({ line, provider });
  }

  // 4. Detect acceptances
  const commitAcceptances = acceptanceDetector.detectFromCommits(commits, commentedFiles);
  const reactionAcceptances = acceptanceDetector.detectFromReactions(commentReactions);

  // 5. Record to weight tracker
  const allAcceptances = [...commitAcceptances, ...reactionAcceptances];
  await acceptanceDetector.recordAcceptances(allAcceptances, providerWeightTracker);

  logger.info(
    `Acceptance detection: ${commitAcceptances.length} from commits, ` +
    `${reactionAcceptances.length} from reactions, ${allAcceptances.length} total`
  );
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| No acceptance tracking | Dismissal tracking only | Phase 4 Plan 04 | One-directional learning (negative only) |
| Negative feedback only | Bi-directional feedback | Phase 4 Plan 08 | AcceptanceDetector implemented but not wired |
| Manual weight adjustment | Automated weight learning | Phase 4 Plan 04-09 | ProviderWeightTracker in runtime |
| Webhook-based assumptions | Polling-based orchestration | Phase 5 (current) | No webhooks exist for reactions |

**Deprecated/outdated:**

- **Webhook assumptions for reactions**: GitHub does not provide reaction webhooks, confirmed by official feature request community/discussions#20824
- **Separate feedback orchestration service**: Not needed - extend existing orchestrator pattern
- **Real-time reaction detection**: Not possible without webhooks - use workflow run polling instead

## Open Questions

Things that couldn't be fully resolved:

1. **Should acceptance detection run on every workflow trigger or only specific events?**
   - What we know: The workflow runs on `pull_request: [opened, synchronize, reopened]` events
   - What's unclear: Whether detecting acceptances on `opened` (first review) adds value vs overhead
   - Recommendation: Only detect on `synchronize` (subsequent runs) - no comments exist on first run

2. **How to handle provider attribution for batch suggestion commits?**
   - What we know: GitHub's "Apply suggestions" can batch multiple files, AcceptanceDetector handles multiple files in one commit
   - What's unclear: If batch commits from multiple providers should credit all providers equally
   - Recommendation: Current implementation credits each provider for their specific file - keep as-is

3. **Should acceptance detection failures block review posting?**
   - What we know: Acceptance detection is supplementary learning, not core review functionality
   - What's unclear: Impact of failed detection on user experience
   - Recommendation: Wrap in try-catch, log warning, continue review (shown in code example)

4. **Rate limiting strategy for PRs with hundreds of comments?**
   - What we know: GitHub API limit is 5000 requests/hour, GitHubClient implements backoff
   - What's unclear: Whether very large PRs (100+ comments) could exhaust limits
   - Recommendation: Monitor in practice, consider pagination limits or batch API if needed

## Sources

### Primary (HIGH confidence)

- **AcceptanceDetector implementation**: src/learning/acceptance-detector.ts (Phase 4 Plan 08)
- **Setup.ts wiring pattern**: src/setup.ts lines 242-246 (Phase 4 Plan 09)
- **FeedbackFilter pattern**: src/github/feedback.ts lines 8-42 (existing)
- **GitHub REST API - Reactions**: [https://docs.github.com/en/rest/reactions](https://docs.github.com/en/rest/reactions)
- **GitHub Actions - Events**: [https://docs.github.com/actions/learn-github-actions/events-that-trigger-workflows](https://docs.github.com/actions/learn-github-actions/events-that-trigger-workflows)

### Secondary (MEDIUM confidence)

- **GitHub Actions pull request triggers**: [Using GitHub Actions on pull requests](https://graphite.com/guides/github-actions-on-pull-requests)
- **Pull request synchronize event**: [What is a pull_request synchronize event · GitHub Community](https://github.com/orgs/community/discussions/24567)
- **Webhooks vs polling patterns**: [Webhooks vs. Polling](https://medium.com/@nile.bits/webhooks-vs-polling-431294f5af8a)

### Tertiary (LOW confidence - community-reported limitations)

- **No webhooks for reactions**: [Feature Request: Webhooks for reactions · GitHub Community #20824](https://github.com/orgs/community/discussions/20824) - Feature request indicates webhooks don't exist
- **GitHub Actions orchestration**: [GitHub Webhooks: Complete Guide](https://www.magicbell.com/blog/github-webhooks-guide)

## Metadata

**Confidence breakdown:**

- Standard stack: HIGH - All components already in codebase, no new dependencies
- Architecture: HIGH - Follows exact pattern from Phase 4 Plan 09, proven in production
- Pitfalls: MEDIUM - Rate limiting impact uncertain at scale, but mitigations identified
- Integration approach: HIGH - Natural extension of existing orchestration, minimal changes

**Research date:** 2026-02-05

**Valid until:** 90 days (stable domain - GitHub Actions and API patterns change infrequently)

**Key limitations:**

1. No webhook support for reactions confirmed - polling is only option
2. Provider attribution depends on Phase 4 comment metadata - historical comments lack it
3. API rate limits may become issue for very large PRs (100+ comments) - needs monitoring
