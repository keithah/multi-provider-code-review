/**
 * Encode a string for safe filesystem/storage keys.
 * Uses encodeURIComponent, then normalizes reserved characters to avoid unsafe filenames.
 */
export function encodeURIComponentSafe(value: string): string {
  const encoded = encodeURIComponent(value);
  // Replace characters that are unsafe or reserved in typical filesystems
  return encoded
    .replace(/[+]/g, '_')
    .replace(/%/g, '_')
    .replace(/[<>:"|?*]/g, '_');
}
