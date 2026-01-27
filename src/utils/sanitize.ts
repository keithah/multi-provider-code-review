import { createHash } from 'node:crypto';

/**
 * Encode a string for safe filesystem/storage keys.
 * Uses encodeURIComponent, normalizes reserved characters, and appends a hash to avoid collisions.
 */
export function encodeURIComponentSafe(value: string): string {
  const encoded = encodeURIComponent(value);
  // Replace characters that are unsafe or reserved in typical filesystems
  const normalized = encoded
    .replace(/[+]/g, '_')
    .replace(/%/g, '_')
    .replace(/[<>:"|?*]/g, '_');
  const hash = createHash('sha256').update(value).digest('hex').slice(0, 8);
  return `${normalized}-${hash}`;
}
