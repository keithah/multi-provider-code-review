import { encodeURIComponentSafe } from '../../../src/utils/sanitize';

describe('sanitize', () => {
  describe('encodeURIComponentSafe', () => {
    it('should create filesystem-safe keys', () => {
      const input = 'openrouter/google/gemini-2.0-flash:free';
      const result = encodeURIComponentSafe(input);

      // Should not contain filesystem-unsafe characters
      expect(result).not.toContain('/');
      expect(result).not.toContain(':');
      expect(result).not.toContain('*');
      expect(result).not.toContain('?');
      expect(result).not.toContain('"');
      expect(result).not.toContain('<');
      expect(result).not.toContain('>');
      expect(result).not.toContain('|');
    });

    it('should produce consistent output for same input', () => {
      const input = 'test/provider:model';
      const result1 = encodeURIComponentSafe(input);
      const result2 = encodeURIComponentSafe(input);

      expect(result1).toBe(result2);
    });

    it('should produce different outputs for different inputs', () => {
      const input1 = 'openrouter/google/gemini-2.0';
      const input2 = 'openrouter/google/gemini-3.0';
      const result1 = encodeURIComponentSafe(input1);
      const result2 = encodeURIComponentSafe(input2);

      expect(result1).not.toBe(result2);
    });

    it('should handle edge cases', () => {
      expect(encodeURIComponentSafe('')).toBeTruthy();
      expect(encodeURIComponentSafe('simple')).toBeTruthy();
      expect(encodeURIComponentSafe('a'.repeat(1000))).toBeTruthy();
    });

    it('should detect potential collisions', () => {
      // Create a set of similar inputs that could collide
      const inputs = [
        'openrouter/google/gemini-1.0',
        'openrouter/google/gemini-1-0',
        'openrouter/google/gemini.1.0',
        'openrouter.google.gemini-1.0',
      ];

      const results = inputs.map(encodeURIComponentSafe);

      // All results should be unique (no collisions)
      const uniqueResults = new Set(results);
      expect(uniqueResults.size).toBe(inputs.length);
    });

    it('should handle unicode characters', () => {
      const input = '你好/provider:model🌍';
      const result = encodeURIComponentSafe(input);

      expect(result).toBeTruthy();
      expect(typeof result).toBe('string');
    });

    it('should produce reasonable length outputs', () => {
      // Even very long inputs should produce bounded outputs
      const longInput = 'a'.repeat(10000);
      const result = encodeURIComponentSafe(longInput);

      // Should be significantly shorter than input due to hashing
      expect(result.length).toBeLessThan(200);
    });

    it('should include hash suffix for collision resistance', () => {
      // The function should append a hash suffix to help prevent collisions
      const input = 'test/provider';
      const result = encodeURIComponentSafe(input);

      // Result should be longer than just the encoded prefix
      // (indicating hash suffix is appended)
      const simpleEncode = encodeURIComponent(input.replace(/[/:]/g, '-'));
      expect(result.length).toBeGreaterThan(simpleEncode.length);
    });
  });
});
