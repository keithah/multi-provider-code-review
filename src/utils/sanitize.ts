/**
 * Encode a string for safe filesystem/storage keys.
 * Uses encodeURIComponent and also replaces '%' to avoid reserved chars in filenames.
 */
export function encodeURIComponentSafe(value: string): string {
  return encodeURIComponent(value).replace(/%/g, '_');
}
