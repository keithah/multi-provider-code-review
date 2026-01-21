import * as fs from 'fs/promises';
import * as path from 'path';
import * as os from 'os';
import { logger } from '../utils/logger';

export interface RateLimitInfo {
  provider: string;
  limitedUntil: number;
  reason: string;
}

export class RateLimiter {
  private readonly lockDir = path.join(os.tmpdir(), 'mpr-ratelimits');

  constructor() {
    fs.mkdir(this.lockDir, { recursive: true }).catch(() => undefined);
  }

  async isRateLimited(provider: string): Promise<boolean> {
    const lockFile = this.getLockFile(provider);

    try {
      const raw = await fs.readFile(lockFile, 'utf8');
      const info: RateLimitInfo = JSON.parse(raw);
      if (Date.now() < info.limitedUntil) {
        logger.warn(`Provider ${provider} rate-limited until ${new Date(info.limitedUntil).toISOString()}`);
        return true;
      }

      await fs.unlink(lockFile).catch(() => undefined);
      return false;
    } catch {
      return false;
    }
  }

  async markRateLimited(provider: string, durationMinutes: number, reason: string): Promise<void> {
    const lockFile = this.getLockFile(provider);
    const info: RateLimitInfo = {
      provider,
      limitedUntil: Date.now() + durationMinutes * 60 * 1000,
      reason,
    };

    await fs.writeFile(lockFile, JSON.stringify(info), 'utf8');
    logger.warn(`Marked ${provider} as rate-limited for ${durationMinutes} minutes: ${reason}`);
  }

  async clear(provider: string): Promise<void> {
    const lockFile = this.getLockFile(provider);
    await fs.unlink(lockFile).catch(() => undefined);
  }

  private getLockFile(provider: string): string {
    const safe = provider.replace(/[^a-z0-9]/gi, '_');
    return path.join(this.lockDir, `${safe}.json`);
  }
}
