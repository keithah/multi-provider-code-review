# API Changelog

## v0.2.1 - Path-Based Review Intensity & Trivial Change Detection

### New Features

#### PathMatcher API
**New module:** `src/analysis/path-matcher.ts`

Provides intelligent review intensity routing based on file paths. Critical security paths (auth, payment) receive thorough review, while test files get lighter review.

**Exports:**
```typescript
// Types
export type ReviewIntensity = 'thorough' | 'standard' | 'light';

export interface PathPattern {
  pattern: string;           // Glob pattern (e.g., "src/auth/**")
  intensity: ReviewIntensity; // Review depth
  description?: string;       // Human-readable reason
}

export interface PathMatcherConfig {
  enabled: boolean;           // Enable path-based routing
  patterns: PathPattern[];    // Pattern definitions
  defaultIntensity: ReviewIntensity; // Fallback intensity
}

export interface IntensityResult {
  intensity: ReviewIntensity;  // Determined intensity
  matchedPaths: string[];      // Files that matched
  reason: string;              // Human-readable explanation
}

// Class
export class PathMatcher {
  constructor(config: PathMatcherConfig)
  determineIntensity(files: FileChange[]): IntensityResult
}

// Factory
export function createDefaultPathMatcherConfig(): PathMatcherConfig
```

**Security Features:**
- Pattern length limit: 500 characters
- Complexity scoring: wildcards × 2 + braces × 3, max score 50
- Control character detection (0x00-0x1F)
- Result caching for performance

**Usage Example:**
```typescript
import { PathMatcher, createDefaultPathMatcherConfig } from './analysis/path-matcher';

const matcher = new PathMatcher(createDefaultPathMatcherConfig());
const result = matcher.determineIntensity(changedFiles);

console.log(`Review intensity: ${result.intensity}`);
console.log(`Reason: ${result.reason}`);
```

#### TrivialDetector API
**New module:** `src/analysis/trivial-detector.ts`

Detects trivial changes (dependency updates, docs, config) to skip unnecessary API costs.

**Exports:**
```typescript
// Types
export interface TrivialDetectionResult {
  isTrivial: boolean;        // Is entire PR trivial?
  reason?: string;           // Why PR is trivial
  trivialFiles: string[];    // Files to skip
  nonTrivialFiles: string[]; // Files to review
}

export interface TrivialDetectorConfig {
  enabled: boolean;
  skipDependencyUpdates: boolean;
  skipDocumentationOnly: boolean;
  skipFormattingOnly: boolean;
  skipTestFixtures: boolean;
  skipConfigFiles: boolean;
  skipBuildArtifacts: boolean;
  customTrivialPatterns: string[];
}

// Class
export class TrivialDetector {
  constructor(config: TrivialDetectorConfig)
  detect(files: FileChange[]): TrivialDetectionResult
  filterNonTrivial(files: FileChange[]): FileChange[]
}

// Factory
export function createDefaultTrivialConfig(): TrivialDetectorConfig
```

**Detection Categories:**
- Dependency lock files (package-lock.json, yarn.lock, etc.)
- Documentation (*.md, docs/, README, CHANGELOG)
- Test fixtures (__snapshots__, __mocks__, *.snap)
- Configuration files (.eslintrc, tsconfig.json, etc.)
- Build artifacts (dist/, build/, *.min.js)
- Custom regex patterns
- Formatting-only changes (semantic analysis of diffs)

**Usage Example:**
```typescript
import { TrivialDetector, createDefaultTrivialConfig } from './analysis/trivial-detector';

const detector = new TrivialDetector(createDefaultTrivialConfig());
const result = detector.detect(changedFiles);

if (result.isTrivial) {
  console.log(`Skipping review: ${result.reason}`);
  return;
}

const filesToReview = result.nonTrivialFiles;
```

### Breaking Changes

**None.** These are new additions that don't affect existing APIs.

### Migration Guide

#### Adopting Path-Based Intensity

If you want to use path-based review routing:

```typescript
// Before
const review = await orchestrator.review(context);

// After
const matcher = new PathMatcher({
  enabled: true,
  defaultIntensity: 'standard',
  patterns: [
    { pattern: 'src/auth/**', intensity: 'thorough' },
    { pattern: '**/*.test.ts', intensity: 'light' },
  ],
});

const intensityResult = matcher.determineIntensity(context.files);
// Use intensityResult.intensity to configure review depth
```

#### Adopting Trivial Change Detection

To skip reviews for trivial changes:

```typescript
// Before
const review = await orchestrator.review(context);

// After
const detector = new TrivialDetector(createDefaultTrivialConfig());
const trivialResult = detector.detect(context.files);

if (trivialResult.isTrivial) {
  console.log(`Skipping: ${trivialResult.reason}`);
  return null;
}

const filesToReview = trivialResult.nonTrivialFiles;
const review = await orchestrator.review({
  ...context,
  files: filesToReview,
});
```

### Performance Considerations

**PathMatcher:**
- Pattern matching results are cached (Map-based memoization)
- Validation happens once at construction time
- O(n×m) where n=files, m=patterns, but with caching

**TrivialDetector:**
- Simple file type checks are O(1) per file
- Formatting detection is O(n) where n=changed lines
- Semantic analysis adds minimal overhead

### Security Notes

**Pattern Validation:**
- All glob patterns are validated before use
- Length limited to 500 characters
- Complexity scored to prevent ReDoS
- Control characters rejected
- Uses battle-tested `minimatch` library

**Custom Patterns:**
- User patterns validated with `isValidRegexPattern()`
- Invalid patterns logged as warnings
- Fallback to literal string matching on error

### Configuration Schema Updates

No changes to existing configuration schemas. New optional fields may be added in future releases.

---

**Last Updated:** 2026-01-25 (v0.2.1)
