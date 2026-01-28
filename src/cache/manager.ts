import { CacheStorage } from './storage';
import { PRContext, Finding, Review, ReviewConfig } from '../types';
import { buildCacheKey, hashConfig } from './key-builder';
import { versionCache, unversionCache } from './version';
import { logger } from '../utils/logger';

interface CachedPayload {
  findings: Finding[];
  timestamp: number;
}

export class CacheManager {
  // Default TTL: 7 days in milliseconds
  private readonly TTL_MS = 7 * 24 * 60 * 60 * 1000;

  constructor(
    private readonly storage = new CacheStorage(),
    private readonly config?: ReviewConfig
  ) {}

  async load(pr: PRContext): Promise<Finding[] | null> {
    const configHash = this.config ? hashConfig(this.config) : undefined;
    const key = buildCacheKey(pr, configHash);
    const raw = await this.storage.read(key);
    if (!raw) return null;

    // Validate version and TTL
    const payload = unversionCache<CachedPayload>(raw, this.TTL_MS);

    if (!payload) {
      logger.debug(`Cache invalid or expired for ${key}`);
      return null;
    }

    logger.info(`Cache hit for ${key}: ${payload.findings.length} findings`);
    return payload.findings;
  }

  async save(pr: PRContext, review: Review): Promise<void> {
    const configHash = this.config ? hashConfig(this.config) : undefined;
    const key = buildCacheKey(pr, configHash);
    const payload: CachedPayload = {
      findings: review.findings,
      timestamp: Date.now(),
    };

    // Wrap with version metadata
    const versioned = versionCache(payload);

    await this.storage.write(key, JSON.stringify(versioned));
    logger.info(`Cached ${review.findings.length} findings for ${key}`);
  }
}
