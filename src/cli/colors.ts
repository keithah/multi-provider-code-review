/**
 * CLI color utility
 * Provides colorized output for better terminal readability
 * Uses ANSI escape codes for cross-platform compatibility
 */

// Check if colors should be disabled (CI environments, pipes, etc.)
const shouldDisableColors = (): boolean => {
  // NO_COLOR environment variable (https://no-color.org/)
  if (process.env.NO_COLOR) {
    return true;
  }

  // Check if output is being piped or redirected
  if (!process.stdout.isTTY) {
    return true;
  }

  // FORCE_COLOR can override
  if (process.env.FORCE_COLOR) {
    return false;
  }

  return false;
};

const COLORS_DISABLED = shouldDisableColors();

// ANSI color codes
const RESET = '\x1b[0m';
const BOLD = '\x1b[1m';
const DIM = '\x1b[2m';

// Foreground colors
const BLACK = '\x1b[30m';
const RED = '\x1b[31m';
const GREEN = '\x1b[32m';
const YELLOW = '\x1b[33m';
const BLUE = '\x1b[34m';
const MAGENTA = '\x1b[35m';
const CYAN = '\x1b[36m';
const WHITE = '\x1b[37m';
const GRAY = '\x1b[90m';

// Background colors
const BG_RED = '\x1b[41m';
const BG_GREEN = '\x1b[42m';
const BG_YELLOW = '\x1b[43m';
const BG_BLUE = '\x1b[44m';

/**
 * Apply color to text
 */
function colorize(text: string, code: string): string {
  if (COLORS_DISABLED) {
    return text;
  }
  return `${code}${text}${RESET}`;
}

/**
 * Color utilities
 */
export const colors = {
  // Basic colors
  red: (text: string) => colorize(text, RED),
  green: (text: string) => colorize(text, GREEN),
  yellow: (text: string) => colorize(text, YELLOW),
  blue: (text: string) => colorize(text, BLUE),
  magenta: (text: string) => colorize(text, MAGENTA),
  cyan: (text: string) => colorize(text, CYAN),
  white: (text: string) => colorize(text, WHITE),
  gray: (text: string) => colorize(text, GRAY),
  black: (text: string) => colorize(text, BLACK),

  // Styles
  bold: (text: string) => colorize(text, BOLD),
  dim: (text: string) => colorize(text, DIM),

  // Semantic colors
  error: (text: string) => colorize(text, BOLD + RED),
  warn: (text: string) => colorize(text, YELLOW),
  success: (text: string) => colorize(text, GREEN),
  info: (text: string) => colorize(text, CYAN),
  debug: (text: string) => colorize(text, GRAY),

  // Severity colors (matching code review severities)
  critical: (text: string) => colorize(text, BG_RED + WHITE + BOLD),
  major: (text: string) => colorize(text, RED + BOLD),
  minor: (text: string) => colorize(text, YELLOW),

  // Special formatting
  highlight: (text: string) => colorize(text, BG_YELLOW + BLACK),
  link: (text: string) => colorize(text, CYAN),
  code: (text: string) => colorize(text, GRAY),
};

/**
 * Progress spinner
 */
export class Spinner {
  private frames = ['⠋', '⠙', '⠹', '⠸', '⠼', '⠴', '⠦', '⠧', '⠇', '⠏'];
  private currentFrame = 0;
  private interval: NodeJS.Timeout | null = null;
  private text: string;

  constructor(text: string) {
    this.text = text;
  }

  start(): void {
    if (COLORS_DISABLED || !process.stdout.isTTY) {
      // In non-TTY environments, just print the text once
      console.log(this.text);
      return;
    }

    this.interval = setInterval(() => {
      const frame = this.frames[this.currentFrame];
      process.stdout.write(`\r${colors.cyan(frame)} ${this.text}`);
      this.currentFrame = (this.currentFrame + 1) % this.frames.length;
    }, 80);
  }

  succeed(message?: string): void {
    this.stop(colors.success('✓'), message);
  }

  fail(message?: string): void {
    this.stop(colors.error('✗'), message);
  }

  stop(symbol?: string, message?: string): void {
    if (this.interval) {
      clearInterval(this.interval);
      this.interval = null;
    }

    if (!COLORS_DISABLED && process.stdout.isTTY) {
      process.stdout.write('\r\x1b[K'); // Clear line
    }

    if (symbol || message) {
      const finalMessage = message || this.text;
      const prefix = symbol || '';
      console.log(`${prefix} ${finalMessage}`);
    }
  }

  updateText(text: string): void {
    this.text = text;
  }
}

/**
 * Create a progress bar
 */
export function progressBar(current: number, total: number, width: number = 40): string {
  if (COLORS_DISABLED) {
    return `[${current}/${total}]`;
  }

  const percentage = Math.min(current / total, 1);
  const filled = Math.floor(percentage * width);
  const empty = width - filled;

  const bar = colors.green('█'.repeat(filled)) + colors.gray('░'.repeat(empty));
  const percent = colors.bold(`${Math.floor(percentage * 100)}%`);

  return `${bar} ${percent} (${current}/${total})`;
}

/**
 * Format a table with colors
 */
export function table(headers: string[], rows: string[][]): string {
  if (rows.length === 0) {
    return '';
  }

  // Calculate column widths
  const columnWidths = headers.map((header, i) => {
    const values = [header, ...rows.map(row => row[i] || '')];
    return Math.max(...values.map(v => v.length));
  });

  // Format header
  const headerRow = headers
    .map((header, i) => colors.bold(header.padEnd(columnWidths[i])))
    .join('  ');

  const separator = columnWidths.map(w => '─'.repeat(w)).join('  ');

  // Format rows
  const dataRows = rows.map(row =>
    row.map((cell, i) => cell.padEnd(columnWidths[i])).join('  ')
  );

  return [
    headerRow,
    colors.gray(separator),
    ...dataRows,
  ].join('\n');
}

/**
 * Box drawing characters
 */
export const box = {
  topLeft: '┌',
  topRight: '┐',
  bottomLeft: '└',
  bottomRight: '┘',
  horizontal: '─',
  vertical: '│',
  cross: '┼',
  teeDown: '┬',
  teeUp: '┴',
  teeRight: '├',
  teeLeft: '┤',
};

/**
 * Create a boxed message
 */
export function boxed(message: string, title?: string): string {
  const lines = message.split('\n');
  const maxWidth = Math.max(...lines.map(l => l.length), title?.length || 0);

  const topBorder = title
    ? `${box.topLeft}${box.horizontal} ${title} ${box.horizontal.repeat(maxWidth - title.length - 1)}${box.topRight}`
    : `${box.topLeft}${box.horizontal.repeat(maxWidth + 2)}${box.topRight}`;

  const content = lines.map(line =>
    `${box.vertical} ${line.padEnd(maxWidth)} ${box.vertical}`
  );

  const bottomBorder = `${box.bottomLeft}${box.horizontal.repeat(maxWidth + 2)}${box.bottomRight}`;

  if (COLORS_DISABLED) {
    return [topBorder, ...content, bottomBorder].join('\n');
  }

  return [
    colors.gray(topBorder),
    ...content,
    colors.gray(bottomBorder),
  ].join('\n');
}

/**
 * Icons for common statuses
 */
export const icons = {
  success: COLORS_DISABLED ? '✓' : colors.success('✓'),
  error: COLORS_DISABLED ? '✗' : colors.error('✗'),
  warning: COLORS_DISABLED ? '⚠' : colors.warn('⚠'),
  info: COLORS_DISABLED ? 'ℹ' : colors.info('ℹ'),
  bullet: '•',
  arrow: '→',
  check: '✓',
  cross: '✗',
};
