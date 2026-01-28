/**
 * Cache versioning for schema coherency and safe evolution
 *
 * VERSIONING STRATEGY:
 * Increment CACHE_VERSION (current: 4) when making ANY breaking change to:
 * - Finding schema (src/types/index.ts: Finding interface)
 * - Analysis algorithm (changes that alter review output semantics)
 * - Config format (ReviewConfig interface changes that affect cache key)
 * - Serialization format (changes to CachedPayload structure)
 *
 * BREAKING VS NON-BREAKING CHANGES:
 *
 * BREAKING (requires version bump):
 * ✗ Removing fields from Finding interface
 * ✗ Changing field types (string → number, etc.)
 * ✗ Renaming fields
 * ✗ Changing analysis algorithm logic that affects review quality/content
 * ✗ Modifying cache key generation (hashConfig changes)
 *
 * NON-BREAKING (no version bump needed):
 * ✓ Adding optional fields to Finding interface (backward compatible)
 * ✓ Adding new config options with defaults
 * ✓ Bug fixes that don't change review semantics
 * ✓ Performance improvements without output changes
 *
 * CACHE INVALIDATION BEHAVIOR:
 * - Version mismatch → cache entry silently ignored, fresh review triggered
 * - No migration logic needed (old caches expire naturally via TTL)
 * - No user intervention required (automatic recovery)
 *
 * VERSION HISTORY:
 * - v1: Initial implementation with basic findings
 * - v2: Added AI detection fields (aiLikelihood, aiReasoning)
 * - v3: Extended Finding schema
 * - v4: Added graph serialization features (CodeGraph with deep copy support)
 *
 * TESTING:
 * When bumping version, verify:
 * 1. Old caches are rejected (unversionCache returns null)
 * 2. New caches use updated version number
 * 3. Reviews run successfully after cache miss
 * See: __tests__/unit/cache/version.test.ts
 */

export const CACHE_VERSION = 4; // Current version - increment for breaking changes

export interface VersionedCache<T> {
  version: number;
  timestamp: number;
  data: T;
}

/**
 * Wrap data with version metadata
 */
export function versionCache<T>(data: T): VersionedCache<T> {
  return {
    version: CACHE_VERSION,
    timestamp: Date.now(),
    data,
  };
}

/**
 * Unwrap versioned cache, validating version and age
 *
 * @param cached - Stringified versioned cache (JSON format)
 * @param maxAge - Maximum age in milliseconds (optional, no limit if omitted)
 * @returns Unwrapped data or null if invalid/expired
 *
 * RETURNS NULL WHEN:
 * - JSON parse fails (corrupted cache)
 * - Version mismatch (schema incompatibility)
 * - Age exceeds maxAge (stale cache)
 * - Missing required fields (malformed cache)
 *
 * GRACEFUL DEGRADATION:
 * - Null return triggers fresh review (cache miss)
 * - No exceptions thrown (silent failure mode)
 * - Caller doesn't need to distinguish error types
 * - Corrupted/outdated caches are automatically replaced
 *
 * SECURITY:
 * - JSON.parse is safe (no code execution)
 * - Type assertion is defensive (runtime validation via checks)
 * - No external dependencies
 */
export function unversionCache<T>(
  cached: string,
  maxAge?: number
): T | null {
  try {
    const parsed: VersionedCache<T> = JSON.parse(cached);

    // Validate structure to handle corrupted/malicious cache data
    if (typeof parsed !== 'object' || parsed === null) {
      return null;
    }
    if (typeof parsed.version !== 'number' || typeof parsed.timestamp !== 'number') {
      return null;
    }

    // Version mismatch - schema incompatibility
    // This is the primary mechanism for cache invalidation after breaking changes
    if (parsed.version !== CACHE_VERSION) {
      return null;
    }

    // Age check - enforce TTL if specified
    if (maxAge && Date.now() - parsed.timestamp > maxAge) {
      return null;
    }

    return parsed.data;
  } catch (error) {
    // JSON parse error or any other exception → treat as cache miss
    return null;
  }
}
