import { createHash } from 'crypto';

/**
 * Encode a string for safe filesystem/storage keys.
 * Uses encodeURIComponent, normalizes reserved characters, and appends a hash to avoid collisions.
 */
export function encodeURIComponentSafe(value: string): string {
  if (typeof value !== 'string') {
    return 'invalid';
  }

  const encoded = encodeURIComponent(value);
  // Replace characters that are unsafe or reserved in typical filesystems
  const normalized = encoded
    .replace(/[+]/g, '_')
    .replace(/%/g, '_')
    .replace(/[<>:"|?*]/g, '_');
  const MAX_PREFIX = 120;
  const prefix = normalized.length > MAX_PREFIX ? normalized.slice(0, MAX_PREFIX) : normalized;

  // Collision-resistant hash (SHA-256) over the original value
  const hashSuffix = createHash('sha256').update(value).digest('hex').slice(0, 16);
  return `${prefix}-${hashSuffix}`;
}
