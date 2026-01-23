import pRetry, { FailedAttemptError } from 'p-retry';
import { logger } from './logger';

export interface RetryOptions {
  retries: number;
  factor?: number;
  minTimeout?: number;
  maxTimeout?: number;
  retryOn?: (error: Error) => boolean;
}

export async function withRetry<T>(
  fn: () => Promise<T>,
  options: RetryOptions
): Promise<T> {
  if (options.retryOn) {
    const maxAttempts = options.retries + 1;
    const minTimeout = options.minTimeout ?? 500;
    const factor = options.factor ?? 2;
    let delay = minTimeout;

    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      try {
        return await fn();
      } catch (error) {
        const err = error as Error;
        if (!options.retryOn(err) || attempt === maxAttempts) {
          throw err;
        }
        logger.warn(`Retryable error: attempt ${attempt} of ${maxAttempts}`, err.message);
        await new Promise(resolve => setTimeout(resolve, delay));
        delay = Math.min(delay * factor, options.maxTimeout ?? 4000);
      }
    }
  }

  return pRetry(fn, {
    retries: options.retries,
    factor: options.factor ?? 2,
    minTimeout: options.minTimeout ?? 500,
    maxTimeout: options.maxTimeout ?? 4000,
    onFailedAttempt: (error: FailedAttemptError) => {
      logger.warn(
        `Retryable error: attempt ${error.attemptNumber} of ${options.retries + 1}`,
        error.message
      );
    },
  });
}
