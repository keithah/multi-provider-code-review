import { CacheStorage } from './storage';
import { PRContext, Finding, Review } from '../types';
import { buildCacheKey } from './key-builder';
import { logger } from '../utils/logger';

interface CachedPayload {
  findings: Finding[];
  timestamp: number;
}

export class CacheManager {
  constructor(private readonly storage = new CacheStorage()) {}

  async load(pr: PRContext): Promise<Finding[] | null> {
    const key = buildCacheKey(pr);
    const raw = await this.storage.read(key);
    if (!raw) return null;

    try {
      const parsed = JSON.parse(raw) as CachedPayload;
      logger.info(`Loaded cached findings for ${key}`);
      return parsed.findings;
    } catch (error) {
      logger.warn('Failed to parse cache payload', error as Error);
      return null;
    }
  }

  async save(pr: PRContext, review: Review): Promise<void> {
    const key = buildCacheKey(pr);
    const payload: CachedPayload = {
      findings: review.findings,
      timestamp: Date.now(),
    };

    await this.storage.write(key, JSON.stringify(payload));
  }
}
