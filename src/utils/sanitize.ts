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
  // Small, dependency-free hash (FNV-1a) to reduce collision risk without requiring node:crypto
  let hash = 0x811c9dc5;
  for (let i = 0; i < value.length; i += 1) {
    hash ^= value.charCodeAt(i);
    hash = (hash * 0x01000193) >>> 0; // 32-bit overflow
  }
  const hashSuffix = hash.toString(16).padStart(8, '0');
  return `${normalized}-${hashSuffix}`;
}
