export function trimDiff(diff: string, maxBytes: number): string {
  const bytes = Buffer.byteLength(diff, 'utf8');
  if (bytes <= maxBytes) return diff;

  // Keep head and tail chunks for context
  const half = Math.floor(maxBytes / 2);
  const head = diff.slice(0, half);
  const tail = diff.slice(-half);
  return `${head}\n...diff truncated...\n${tail}`;
}

export interface AddedLine {
  line: number;
  content: string;
}

/**
 * Parse a unified diff patch and return the added lines with their absolute
 * line numbers on the new file.
 */
export function mapAddedLines(patch: string | undefined): AddedLine[] {
  if (!patch) return [];

  const lines = patch.split('\n');
  const added: AddedLine[] = [];

  let currentNew = 0;
  const hunkRegex = /^@@ -(\d+)(?:,\d+)? \+(\d+)(?:,\d+)? @@/;

  for (const raw of lines) {
    const hunkMatch = raw.match(hunkRegex);
    if (hunkMatch) {
      currentNew = parseInt(hunkMatch[2], 10);
      continue;
    }

    if (raw.startsWith('+')) {
      added.push({ line: currentNew, content: raw.slice(1) });
      currentNew += 1;
    } else if (raw.startsWith('-')) {
      // Only advance old line counter; no change to new file.
    } else {
      currentNew += 1;
    }
  }

  return added;
}
