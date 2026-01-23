export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

export interface LogMetadata {
  [key: string]: unknown;
}

const LEVELS: Record<LogLevel, number> = {
  debug: 10,
  info: 20,
  warn: 30,
  error: 40,
};

const CURRENT_LEVEL: LogLevel = (process.env.LOG_LEVEL as LogLevel) || 'info';

function shouldLog(level: LogLevel): boolean {
  return LEVELS[level] >= LEVELS[CURRENT_LEVEL];
}

function formatMessage(level: LogLevel, message: string, metadata?: LogMetadata): string {
  const timestamp = new Date().toISOString();
  const levelStr = level.toUpperCase().padEnd(5);

  if (metadata && Object.keys(metadata).length > 0) {
    const metaStr = JSON.stringify(metadata);
    return `[${timestamp}] ${levelStr} ${message} ${metaStr}`;
  }

  return `[${timestamp}] ${levelStr} ${message}`;
}

export const logger = {
  debug(message: string, ...args: unknown[]): void {
    if (shouldLog('debug')) {
      const metadata = args.length > 0 && typeof args[0] === 'object' && !Array.isArray(args[0])
        ? args[0] as LogMetadata
        : undefined;
      console.debug(formatMessage('debug', message, metadata));
    }
  },
  info(message: string, ...args: unknown[]): void {
    if (shouldLog('info')) {
      const metadata = args.length > 0 && typeof args[0] === 'object' && !Array.isArray(args[0])
        ? args[0] as LogMetadata
        : undefined;
      console.info(formatMessage('info', message, metadata));
    }
  },
  warn(message: string, ...args: unknown[]): void {
    if (shouldLog('warn')) {
      const metadata = args.length > 0 && typeof args[0] === 'object' && !Array.isArray(args[0])
        ? args[0] as LogMetadata
        : undefined;
      console.warn(formatMessage('warn', message, metadata));
    }
  },
  error(message: string, ...args: unknown[]): void {
    if (shouldLog('error')) {
      let metadata: LogMetadata = {};
      let error: Error | undefined;

      // Support both error objects and metadata
      for (const arg of args) {
        if (arg instanceof Error) {
          error = arg;
        } else if (typeof arg === 'object' && arg !== null && !Array.isArray(arg)) {
          metadata = { ...metadata, ...(arg as LogMetadata) };
        }
      }

      if (error) {
        metadata.error = error.message;
        metadata.stack = error.stack;
      }

      console.error(formatMessage('error', message, Object.keys(metadata).length > 0 ? metadata : undefined));
    }
  },
};
