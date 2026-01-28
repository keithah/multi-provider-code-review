import { CacheStorage } from './storage';
import { CodeGraph } from '../analysis/context/graph-builder';
import { logger } from '../utils/logger';

// Graph cache schema version - increment when CodeGraph serialization format changes
const GRAPH_CACHE_VERSION = 1;

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

      // Check version for schema compatibility
      if (data.version !== GRAPH_CACHE_VERSION) {
        logger.debug(`Graph cache version mismatch for PR #${prNumber} (cached: ${data.version}, current: ${GRAPH_CACHE_VERSION})`);
        return null;
      }

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
      version: GRAPH_CACHE_VERSION,
      timestamp: Date.now(),
      graph: graph.serialize(),
    };

    await this.storage.write(key, JSON.stringify(data));
    logger.debug(`Cached graph for PR #${prNumber} (${headSha.slice(0, 7)})`);
  }

  /**
   * Clear all cached graphs for a specific PR
   * Deletes all cache entries matching the PR number prefix
   */
  async clear(prNumber: number): Promise<void> {
    const prefix = GraphCache.CACHE_KEY_PREFIX + prNumber;
    const deletedCount = await this.storage.deleteByPrefix(prefix);
    logger.info(`Cleared ${deletedCount} cached graph(s) for PR #${prNumber}`);
  }

  private key(prNumber: number, headSha: string): string {
    return `${GraphCache.CACHE_KEY_PREFIX}${prNumber}-${headSha}`;
  }
}
