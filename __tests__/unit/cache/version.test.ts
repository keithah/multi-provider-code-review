import {
  CACHE_VERSION,
  versionCache,
  unversionCache,
  VersionedCache,
} from '../../../src/cache/version';

describe('Cache Versioning', () => {
  describe('versionCache', () => {
    it('should wrap data with version and timestamp', () => {
      const data = { foo: 'bar' };
      const before = Date.now();

      const versioned = versionCache(data);

      expect(versioned.version).toBe(CACHE_VERSION);
      expect(versioned.data).toEqual(data);
      expect(versioned.timestamp).toBeGreaterThanOrEqual(before);
      expect(versioned.timestamp).toBeLessThanOrEqual(Date.now());
    });

    it('should handle different data types', () => {
      const cases = [
        { data: 'string' },
        { data: 123 },
        { data: true },
        { data: { nested: { object: true } } },
        { data: [1, 2, 3] },
      ];

      for (const { data } of cases) {
        const versioned = versionCache(data);
        expect(versioned.data).toEqual(data);
      }
    });
  });

  describe('unversionCache', () => {
    it('should unwrap valid versioned cache', () => {
      const data = { foo: 'bar' };
      const cached: VersionedCache<typeof data> = {
        version: CACHE_VERSION,
        timestamp: Date.now(),
        data,
      };

      const result = unversionCache<typeof data>(JSON.stringify(cached));

      expect(result).toEqual(data);
    });

    it('should return null for version mismatch', () => {
      const data = { foo: 'bar' };
      const cached: VersionedCache<typeof data> = {
        version: CACHE_VERSION - 1, // Old version
        timestamp: Date.now(),
        data,
      };

      const result = unversionCache<typeof data>(JSON.stringify(cached));

      expect(result).toBeNull();
    });

    it('should return null for expired cache', () => {
      const data = { foo: 'bar' };
      const cached: VersionedCache<typeof data> = {
        version: CACHE_VERSION,
        timestamp: Date.now() - 10000, // 10 seconds ago
        data,
      };

      // Max age of 5 seconds
      const result = unversionCache<typeof data>(JSON.stringify(cached), 5000);

      expect(result).toBeNull();
    });

    it('should return data when within TTL', () => {
      const data = { foo: 'bar' };
      const cached: VersionedCache<typeof data> = {
        version: CACHE_VERSION,
        timestamp: Date.now() - 3000, // 3 seconds ago
        data,
      };

      // Max age of 5 seconds
      const result = unversionCache<typeof data>(JSON.stringify(cached), 5000);

      expect(result).toEqual(data);
    });

    it('should ignore TTL when not specified', () => {
      const data = { foo: 'bar' };
      const cached: VersionedCache<typeof data> = {
        version: CACHE_VERSION,
        timestamp: Date.now() - 1000000, // Very old
        data,
      };

      // No max age specified
      const result = unversionCache<typeof data>(JSON.stringify(cached));

      expect(result).toEqual(data);
    });

    it('should return null for malformed JSON', () => {
      const result = unversionCache<any>('not valid json');

      expect(result).toBeNull();
    });

    it('should return null for invalid structure', () => {
      const invalid = { invalid: 'structure' };
      const result = unversionCache<any>(JSON.stringify(invalid));

      expect(result).toBeNull();
    });

    it('should handle edge case of exactly expired cache', () => {
      const data = { foo: 'bar' };
      const maxAge = 5000;
      const cached: VersionedCache<typeof data> = {
        version: CACHE_VERSION,
        timestamp: Date.now() - maxAge - 1, // Exactly expired + 1ms
        data,
      };

      const result = unversionCache<typeof data>(JSON.stringify(cached), maxAge);

      expect(result).toBeNull();
    });
  });

  describe('Round-trip', () => {
    it('should successfully round-trip data', () => {
      const data = { complex: { nested: ['data', 123, true] } };

      const versioned = versionCache(data);
      const serialized = JSON.stringify(versioned);
      const result = unversionCache<typeof data>(serialized);

      expect(result).toEqual(data);
    });

    it('should fail round-trip after version change', () => {
      const data = { foo: 'bar' };

      const versioned = versionCache(data);
      // Simulate version change
      versioned.version = CACHE_VERSION + 1;
      const serialized = JSON.stringify(versioned);
      const result = unversionCache<typeof data>(serialized);

      expect(result).toBeNull();
    });
  });
});
