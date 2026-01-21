export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

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

export const logger = {
  debug(message: string, ...args: unknown[]): void {
    if (shouldLog('debug')) {
      console.debug(`DEBUG ${message}`, ...args);
    }
  },
  info(message: string, ...args: unknown[]): void {
    if (shouldLog('info')) {
      console.info(`INFO  ${message}`, ...args);
    }
  },
  warn(message: string, ...args: unknown[]): void {
    if (shouldLog('warn')) {
      console.warn(`WARN  ${message}`, ...args);
    }
  },
  error(message: string, ...args: unknown[]): void {
    if (shouldLog('error')) {
      console.error(`ERROR ${message}`, ...args);
    }
  },
};
