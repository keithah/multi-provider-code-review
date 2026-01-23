import * as fs from 'fs/promises';
import * as path from 'path';
import { logger } from '../utils/logger';

interface Lock {
  promise: Promise<void>;
  resolve: () => void;
}

export class CacheStorage {
  private readonly locks = new Map<string, Lock>();

  constructor(private readonly baseDir = path.join(process.cwd(), '.mpr-cache')) {}

  async read(key: string): Promise<string | null> {
    const file = path.join(this.baseDir, `${key}.json`);
    try {
      return await fs.readFile(file, 'utf8');
    } catch {
      return null;
    }
  }

  async write(key: string, value: string): Promise<void> {
    // Wait for any existing write operation on this key to complete
    await this.acquireLock(key);

    try {
      const file = path.join(this.baseDir, `${key}.json`);
      await fs.mkdir(this.baseDir, { recursive: true });
      await fs.writeFile(file, value, 'utf8');
      logger.info(`Cached results at ${file}`);
    } finally {
      this.releaseLock(key);
    }
  }

  private async acquireLock(key: string): Promise<void> {
    // If there's an existing lock, wait for it
    const existingLock = this.locks.get(key);
    if (existingLock) {
      await existingLock.promise;
    }

    // Create a new lock with both promise and resolver
    let resolver!: () => void;
    const lockPromise = new Promise<void>(resolve => {
      resolver = resolve;
    });

    this.locks.set(key, {
      promise: lockPromise,
      resolve: resolver,
    });
  }

  private releaseLock(key: string): void {
    const lock = this.locks.get(key);
    if (lock) {
      lock.resolve(); // Resolve the promise to unblock waiters
      this.locks.delete(key);
    }
  }
}
