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

  /**
   * Delete all cache entries matching a given prefix
   * Useful for clearing PR-specific or feature-specific caches
   */
  async deleteByPrefix(prefix: string): Promise<number> {
    try {
      // Ensure cache directory exists
      await fs.mkdir(this.baseDir, { recursive: true });

      // Read all files in cache directory
      const files = await fs.readdir(this.baseDir);

      // Filter files matching the prefix pattern
      const matchingFiles = files.filter(file => {
        // Remove .json extension and check if it starts with prefix
        const key = file.replace(/\.json$/, '');
        return key.startsWith(prefix);
      });

      // Delete matching files
      let deletedCount = 0;
      for (const file of matchingFiles) {
        try {
          await fs.unlink(path.join(this.baseDir, file));
          deletedCount++;
        } catch (error) {
          logger.warn(`Failed to delete cache file ${file}`, error as Error);
        }
      }

      if (deletedCount > 0) {
        logger.info(`Deleted ${deletedCount} cache entries with prefix: ${prefix}`);
      }

      return deletedCount;
    } catch (error) {
      logger.warn(`Failed to delete cache entries by prefix ${prefix}`, error as Error);
      return 0;
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
