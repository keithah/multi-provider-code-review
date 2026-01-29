/**
 * Test file with defensive programming patterns
 * This should NOT generate false positive warnings
 */

// Pattern 1: Type check + error return (from sanitize.ts)
export function encodeURIComponentSafe(value: string): string {
  if (typeof value !== 'string') {
    return 'invalid';
  }

  const encoded = encodeURIComponent(value);
  return encoded.replace(/%/g, '_');
}

// Pattern 2: Try-catch with graceful degradation (from storage.ts)
export async function deleteByPrefix(prefix: string): Promise<number> {
  try {
    await fs.mkdir(this.baseDir, { recursive: true });
  } catch (error) {
    logger.error('Failed to create cache directory', error);
    return 0;
  }

  const files = await fs.readdir(this.baseDir);
  return files.length;
}

// Pattern 3: Intentionally unused parameter (from opencode.ts)
export async function healthCheck(_timeoutMs: number = 5000): Promise<boolean> {
  try {
    await this.resolveBinary();
    return true;
  } catch (error) {
    logger.warn('Health check failed', error);
    return false;
  }
}

// Pattern 4: Parameter validation with throw (from batch-orchestrator.ts)
export function createBatches(files: any[], batchSize: number): any[][] {
  if (!Number.isInteger(batchSize) || batchSize < 1) {
    throw new Error(`Invalid batch size: ${batchSize}`);
  }

  const batches: any[][] = [];
  for (let i = 0; i < files.length; i += batchSize) {
    batches.push(files.slice(i, i + batchSize));
  }
  return batches;
}

// Pattern 5: Locking for concurrency safety (from circuit-breaker.ts)
export class CircuitBreaker {
  private readonly locks = new Map<string, any>();

  async recordFailure(providerId: string): Promise<void> {
    await this.acquireLock(providerId);
    try {
      // Critical section - safe from race conditions
      const state = await this.load(providerId);
      await this.setState(providerId, { failures: state.failures + 1 });
    } finally {
      this.releaseLock(providerId);
    }
  }

  private async acquireLock(key: string): Promise<void> {
    // Lock implementation
  }

  private releaseLock(key: string): void {
    this.locks.delete(key);
  }
}

// Pattern 6: Timeout enforcement with Promise.race
export async function executeWithTimeout<T>(
  operation: Promise<T>,
  timeoutMs: number
): Promise<T> {
  return Promise.race([
    operation,
    new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error('Timeout')), timeoutMs)
    ),
  ]);
}
