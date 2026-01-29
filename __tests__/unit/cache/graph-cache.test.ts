import { GraphCache } from '../../../src/cache/graph-cache';
import { CacheStorage } from '../../../src/cache/storage';
import { CodeGraph } from '../../../src/analysis/context/graph-builder';

// Mock the storage
jest.mock('../../../src/cache/storage');

describe('GraphCache', () => {
  let cache: GraphCache;
  let mockStorage: jest.Mocked<CacheStorage>;

  beforeEach(() => {
    mockStorage = new CacheStorage() as jest.Mocked<CacheStorage>;
    cache = new GraphCache(mockStorage);
  });

  describe('get', () => {
    it('should return null when cache miss', async () => {
      mockStorage.read.mockResolvedValue(null);

      const result = await cache.get(123, 'abc123');

      expect(result).toBeNull();
    });

    it('should deserialize and return cached graph', async () => {
      const graph = new CodeGraph(['file1.ts', 'file2.ts'], 100);
      const cached = {
        version: 1,
        timestamp: Date.now(),
        graph: graph.serialize(),
      };

      mockStorage.read.mockResolvedValue(JSON.stringify(cached));

      const result = await cache.get(123, 'abc123');

      expect(result).toBeInstanceOf(CodeGraph);
      expect(result?.files).toEqual(['file1.ts', 'file2.ts']);
      expect(result?.buildTime).toBe(100);
    });

    it('should return null for expired cache', async () => {
      const graph = new CodeGraph(['file1.ts'], 100);
      const cached = {
        version: 1,
        timestamp: Date.now() - 25 * 60 * 60 * 1000, // 25 hours ago
        graph: graph.serialize(),
      };

      mockStorage.read.mockResolvedValue(JSON.stringify(cached));

      const result = await cache.get(123, 'abc123');

      expect(result).toBeNull();
    });

    it('should return graph within TTL', async () => {
      const graph = new CodeGraph(['file1.ts'], 100);
      const cached = {
        version: 1, // Match GRAPH_CACHE_VERSION
        timestamp: Date.now() - 20 * 60 * 60 * 1000, // 20 hours ago (within 24hr TTL)
        graph: graph.serialize(),
      };

      mockStorage.read.mockResolvedValue(JSON.stringify(cached));

      const result = await cache.get(123, 'abc123');

      expect(result).not.toBeNull();
      expect(result?.files).toEqual(['file1.ts']);
    });

    it('should handle malformed JSON gracefully', async () => {
      mockStorage.read.mockResolvedValue('not valid json');

      const result = await cache.get(123, 'abc123');

      expect(result).toBeNull();
    });

    it('should handle deserialization errors gracefully', async () => {
      // Test with completely invalid graph structure that will cause deserialize to throw
      const invalid = {
        version: 1,
        timestamp: Date.now(),
        graph: null,
      };

      mockStorage.read.mockResolvedValue(JSON.stringify(invalid));

      const result = await cache.get(123, 'abc123');

      expect(result).toBeNull();
    });

    it('should return null for version mismatch', async () => {
      const graph = new CodeGraph(['file1.ts'], 100);
      const cachedWithOldVersion = {
        version: 0, // Old version
        timestamp: Date.now(),
        graph: graph.serialize(),
      };

      mockStorage.read.mockResolvedValue(JSON.stringify(cachedWithOldVersion));

      const result = await cache.get(123, 'abc123');

      expect(result).toBeNull();
    });
  });

  describe('set', () => {
    it('should serialize and cache graph', async () => {
      const graph = new CodeGraph(['file1.ts', 'file2.ts'], 100);

      await cache.set(123, 'abc123', graph);

      expect(mockStorage.write).toHaveBeenCalledTimes(1);
      const callArgs = mockStorage.write.mock.calls[0];
      expect(callArgs[0]).toBe('code-graph-123-abc123');

      const serialized = JSON.parse(callArgs[1]);
      expect(serialized.version).toBe(1); // Should include version
      expect(serialized.timestamp).toBeDefined();
      expect(serialized.graph).toBeDefined();
      expect(serialized.graph.files).toEqual(['file1.ts', 'file2.ts']);
    });

    it('should use correct cache key format', async () => {
      const graph = new CodeGraph(['file1.ts'], 100);

      await cache.set(456, 'def789', graph);

      expect(mockStorage.write).toHaveBeenCalledWith(
        'code-graph-456-def789',
        expect.any(String)
      );
    });
  });

  describe('Round-trip', () => {
    it('should successfully round-trip a graph', async () => {
      const originalGraph = new CodeGraph(['file1.ts', 'file2.ts'], 100);

      // Save
      await cache.set(123, 'abc123', originalGraph);

      // Get the cached data
      const callArgs = mockStorage.write.mock.calls[0];
      mockStorage.read.mockResolvedValue(callArgs[1]);

      // Load
      const loadedGraph = await cache.get(123, 'abc123');

      expect(loadedGraph).not.toBeNull();
      expect(loadedGraph?.files).toEqual(originalGraph.files);
      expect(loadedGraph?.buildTime).toBe(originalGraph.buildTime);
    });
  });
});
