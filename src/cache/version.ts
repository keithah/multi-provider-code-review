/**
 * Cache versioning for coherency
 *
 * Increment VERSION when:
 * - Finding schema changes
 * - Analysis algorithm updates
 * - Config format changes
 * - Any breaking cache format change
 */

export const CACHE_VERSION = 3; // Current version

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
 * @param cached - Stringified versioned cache
 * @param maxAge - Maximum age in milliseconds (optional)
 * @returns Unwrapped data or null if invalid/expired
 */
export function unversionCache<T>(
  cached: string,
  maxAge?: number
): T | null {
  try {
    const parsed: VersionedCache<T> = JSON.parse(cached);

    // Version mismatch - invalid cache
    if (parsed.version !== CACHE_VERSION) {
      return null;
    }

    // Age check
    if (maxAge && Date.now() - parsed.timestamp > maxAge) {
      return null;
    }

    return parsed.data;
  } catch (error) {
    return null;
  }
}
