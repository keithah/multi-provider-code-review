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
 * Uses lightweight line scanning with a minimal regex for headers.
 */
export function filterDiffByFiles(diff: string, files: { filename: string }[]): string {
  if (files.length === 0) return '';
  if (!diff || diff.trim().length === 0) return '';

  const target = new Set(files.map(f => f.filename));
  const lines = diff.split('\n');
  const chunks: string[] = [];
  let currentChunk: string[] = [];
  let includeCurrent = false;

  const pushChunkIfIncluded = () => {
    if (includeCurrent && currentChunk.length > 0) {
      chunks.push(currentChunk.join('\n'));
    }
    currentChunk = [];
    includeCurrent = false;
  };

  for (const line of lines) {
    const normalizedLine = line.replace(/\r$/, '');
    const isHeader = normalizedLine.startsWith('diff --git ');
    if (isHeader) {
      pushChunkIfIncluded();
      const match = normalizedLine.match(/^diff --git\s+a\/(.+?)\s+b\/(.+)$/);
      if (!match) {
        currentChunk.push(line);
        continue;
      }
      const rawA = match[1].trim();
      const rawB = match[2].trim();
      const aPath = unquoteGitPath(rawA);
      const bPath = unquoteGitPath(rawB);
      // Check both paths to correctly handle renames/moves
      includeCurrent = target.has(bPath) || target.has(aPath);
      currentChunk.push(line);
    } else {
      currentChunk.push(line);
    }
  }

  pushChunkIfIncluded();

  // Remove possible trailing empty string from split/join differences
  return chunks.join('\n').trimEnd();
}

function unquoteGitPath(path: string): string {
  // Git may quote paths with spaces or special chars using C-style escapes
  if (path.startsWith('"') && path.endsWith('"')) {
    path = path.slice(1, -1);
  }
  // Unescape common sequences produced by git (\" and \\ and \t etc.)
  try {
    path = path.replace(/\\([\\"tnr])/g, (_m, ch) => {
      switch (ch) {
        case '\\':
          return '\\';
        case '"':
          return '"';
        case 't':
          return '\t';
        case 'n':
          return '\n';
        case 'r':
          return '\r';
        default:
          return ch;
      }
    });
  } catch {
    // If anything goes wrong, fall back to raw path
  }
  return path;
}
