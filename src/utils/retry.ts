import pRetry, { FailedAttemptError } from 'p-retry';
import { logger } from './logger';

export interface RetryOptions {
  retries: number;
  factor?: number;
  minTimeout?: number;
  maxTimeout?: number;
}

export async function withRetry<T>(
  fn: () => Promise<T>,
  options: RetryOptions
): Promise<T> {
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
