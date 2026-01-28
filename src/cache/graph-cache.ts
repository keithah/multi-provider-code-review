import { CacheStorage } from './storage';
import { CodeGraph } from '../analysis/context/graph-builder';
import { logger } from '../utils/logger';

export class GraphCache {
  private static readonly CACHE_KEY_PREFIX = 'code-graph-';
  private static readonly CACHE_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours

  constructor(private readonly storage = new CacheStorage()) {}

  /**
   * Get cached graph for a PR
   */
  async get(prNumber: number, headSha: string): Promise<CodeGraph | null> {
    const key = this.key(prNumber, headSha);
    const cached = await this.storage.read(key);

    if (!cached) {
      return null;
    }

    try {
      const data = JSON.parse(cached);

      // Check TTL
      if (Date.now() - data.timestamp > GraphCache.CACHE_TTL_MS) {
        logger.debug(`Graph cache expired for PR #${prNumber}`);
        return null;
      }

      // Deserialize graph
      const graph = CodeGraph.deserialize(data.graph);
      logger.debug(`Graph cache hit for PR #${prNumber} (${headSha.slice(0, 7)})`);

      return graph;
    } catch (error) {
      logger.warn(`Failed to deserialize cached graph for PR #${prNumber}`, error as Error);
      return null;
    }
  }

  /**
   * Save graph to cache
   */
  async set(prNumber: number, headSha: string, graph: CodeGraph): Promise<void> {
    const key = this.key(prNumber, headSha);

    const data = {
      timestamp: Date.now(),
      graph: graph.serialize(),
    };

    await this.storage.write(key, JSON.stringify(data));
    logger.debug(`Cached graph for PR #${prNumber} (${headSha.slice(0, 7)})`);
  }

  /**
   * Clear cache for a PR
   * Note: Currently only logs the intent. Full prefix-based deletion would require
   * extending CacheStorage interface to support key iteration/scanning.
   */
  async clear(prNumber: number): Promise<void> {
    const prefix = GraphCache.CACHE_KEY_PREFIX + prNumber;
    logger.info(`Cache clear requested for PR #${prNumber} (prefix: ${prefix}). ` +
      `Full implementation requires CacheStorage.deleteByPrefix() support.`);
    // TODO: Implement deleteByPrefix() in CacheStorage backends (InMemory, Redis)
    // and call await this.storage.deleteByPrefix(prefix) here
  }

  private key(prNumber: number, headSha: string): string {
    return `${GraphCache.CACHE_KEY_PREFIX}${prNumber}-${headSha}`;
  }
}
