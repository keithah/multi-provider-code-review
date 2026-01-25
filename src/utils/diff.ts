/**
 * Trim diff intelligently by keeping complete files until we reach the size limit.
 * This prevents false positives where LLMs see files listed but their diffs are missing.
 */
export function trimDiff(diff: string, maxBytes: number): string {
  const buf = Buffer.from(diff, 'utf8');
  if (buf.byteLength <= maxBytes) return diff;

  // Split by file boundaries (diff --git lines)
  const fileChunks: string[] = [];
  const lines = diff.split('\n');
  let currentChunk: string[] = [];

  for (const line of lines) {
    if (line.startsWith('diff --git ') && currentChunk.length > 0) {
      // New file starts, save previous chunk
      fileChunks.push(currentChunk.join('\n'));
      currentChunk = [line];
    } else {
      currentChunk.push(line);
    }
  }
  if (currentChunk.length > 0) {
    fileChunks.push(currentChunk.join('\n'));
  }

  // Keep as many complete files as possible within the limit
  const includedChunks: string[] = [];
  let currentBytes = 0;
  const truncationMarker = '\n\n...remaining files truncated to stay within size limit...\n';
  const markerBytes = Buffer.byteLength(truncationMarker, 'utf8');

  for (const chunk of fileChunks) {
    const chunkBytes = Buffer.byteLength(chunk, 'utf8');

    // Check if adding this chunk would exceed limit (accounting for marker)
    if (currentBytes + chunkBytes + markerBytes > maxBytes && includedChunks.length > 0) {
      break;
    }

    includedChunks.push(chunk);
    currentBytes += chunkBytes + 1; // +1 for newline separator
  }

  // If we truncated any files, add marker
  if (includedChunks.length < fileChunks.length) {
    const truncatedCount = fileChunks.length - includedChunks.length;
    return includedChunks.join('\n') + `\n\n...${truncatedCount} file(s) truncated to stay within size limit...\n`;
  }

  return includedChunks.join('\n');
}

export interface AddedLine {
  line: number;
  content: string;
}

export interface LinePosition {
  line: number;
  position: number;
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
  const noNewlineMarker = '\\ No newline at end of file';

  for (const raw of lines) {
    if (raw === noNewlineMarker) {
      continue; // marker only, do not advance line numbers
    }

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

/**
 * Map absolute line numbers to diff positions for GitHub PR review comments.
 * Position is the line number within the diff (1-indexed).
 */
export function mapLinesToPositions(patch: string | undefined): Map<number, number> {
  const map = new Map<number, number>();
  if (!patch) return map;

  const lines = patch.split('\n');
  let currentNew = 0;
  let position = 0;
  const hunkRegex = /^@@ -(\d+)(?:,\d+)? \+(\d+)(?:,\d+)? @@/;
  const noNewlineMarker = '\\ No newline at end of file';

  for (const raw of lines) {
    if (raw === noNewlineMarker) {
      continue; // marker only, do not advance counters
    }

    position += 1;

    const hunkMatch = raw.match(hunkRegex);
    if (hunkMatch) {
      currentNew = parseInt(hunkMatch[2], 10);
      continue;
    }

    if (raw.startsWith('+')) {
      map.set(currentNew, position);
      currentNew += 1;
    } else if (raw.startsWith('-')) {
      // Deleted lines don't advance new line counter
    } else {
      map.set(currentNew, position);
      currentNew += 1;
    }
  }

  return map;
}

/**
 * Filter a full diff to only include chunks for the given files.
 * Uses string scanning (no regex) to avoid ReDoS and keep memory usage low.
 */
export function filterDiffByFiles(diff: string, files: { filename: string }[]): string {
  if (files.length === 0) return '';

  const fileNames = new Set(files.map(f => f.filename));
  const diffChunks: string[] = [];
  const DIFF_MARKER = 'diff --git ';

  let startIdx = 0;

  while (startIdx < diff.length) {
    const markerIdx = diff.indexOf(DIFF_MARKER, startIdx);
    if (markerIdx === -1) break;

    // Skip if not at start of line
    if (markerIdx > 0 && diff[markerIdx - 1] !== '\n') {
      startIdx = markerIdx + DIFF_MARKER.length;
      continue;
    }

    // Find next diff marker or end
    let nextIdx = diff.indexOf('\n' + DIFF_MARKER, markerIdx + 1);
    if (nextIdx === -1) {
      nextIdx = diff.length;
    } else {
      nextIdx += 1;
    }

    const chunk = diff.substring(markerIdx, nextIdx);

    // Extract filename from first line
    const firstLineEnd = chunk.indexOf('\n');
    const firstLine = firstLineEnd === -1 ? chunk : chunk.substring(0, firstLineEnd);
    const bIndex = firstLine.indexOf(' b/');

    if (bIndex !== -1) {
      const filename = firstLine.substring(bIndex + 3).trim();
      if (fileNames.has(filename)) {
        diffChunks.push(chunk);
      }
    }

    startIdx = nextIdx;
  }

  return diffChunks.join('');
}
