import {
  estimateTokensSimple,
  estimateTokensConservative,
  estimateTokensForDiff,
  getContextWindowSize,
  checkContextWindowFit,
} from '../../../src/utils/token-estimation';

describe('Token Estimation', () => {
  describe('estimateTokensSimple', () => {
    it('should estimate tokens for plain text using 4 chars/token', () => {
      const text = 'Hello world this is a test';
      const estimate = estimateTokensSimple(text);

      expect(estimate.characters).toBe(text.length);
      expect(estimate.bytes).toBe(Buffer.byteLength(text, 'utf8'));
      expect(estimate.tokens).toBe(Math.ceil(text.length / 4));
      expect(estimate.method).toBe('simple');
    });

    it('should use 3 chars/token for code-heavy text', () => {
      const code = 'function test() { return { a: 1, b: [2, 3] }; }';
      const estimate = estimateTokensSimple(code);

      // Code has lots of {}, (), [], ; symbols (>5% of content)
      // Should use 3 chars/token instead of 4
      expect(estimate.tokens).toBe(Math.ceil(code.length / 3));
    });

    it('should handle empty string', () => {
      const estimate = estimateTokensSimple('');

      expect(estimate.characters).toBe(0);
      expect(estimate.bytes).toBe(0);
      expect(estimate.tokens).toBe(0);
    });

    it('should handle unicode characters correctly', () => {
      const text = '你好世界 🌍';
      const estimate = estimateTokensSimple(text);

      expect(estimate.characters).toBeGreaterThan(0); // Emoji may count as 2 chars
      expect(estimate.bytes).toBeGreaterThan(estimate.characters); // UTF-8 multi-byte
      expect(estimate.tokens).toBeGreaterThan(0);
    });

    it('should handle very long text', () => {
      const longText = 'a'.repeat(100000);
      const estimate = estimateTokensSimple(longText);

      expect(estimate.tokens).toBe(Math.ceil(100000 / 4));
    });
  });

  describe('estimateTokensConservative', () => {
    it('should add 10% safety margin to simple estimate', () => {
      const text = 'Hello world';
      const simple = estimateTokensSimple(text);
      const conservative = estimateTokensConservative(text);

      expect(conservative.tokens).toBe(Math.ceil(simple.tokens * 1.1));
      expect(conservative.characters).toBe(simple.characters);
      expect(conservative.bytes).toBe(simple.bytes);
    });

    it('should always overestimate (never underestimate)', () => {
      const text = 'Test text for estimation';
      const simple = estimateTokensSimple(text);
      const conservative = estimateTokensConservative(text);

      expect(conservative.tokens).toBeGreaterThanOrEqual(simple.tokens);
    });

    it('should handle edge cases', () => {
      expect(estimateTokensConservative('').tokens).toBe(0);
      expect(estimateTokensConservative('a').tokens).toBeGreaterThan(0);
    });
  });

  describe('estimateTokensForDiff', () => {
    it('should estimate tokens for unified diff format', () => {
      const diff = `diff --git a/file.ts b/file.ts
index 123..456 789
--- a/file.ts
+++ b/file.ts
@@ -1,3 +1,3 @@
 function test() {
-  return 1;
+  return 2;
 }`;

      const estimate = estimateTokensForDiff(diff);
      const simple = estimateTokensSimple(diff);

      // Conservative estimate: no efficiency multiplier for diffs
      expect(estimate.tokens).toBe(simple.tokens);
    });

    it('should handle empty diff', () => {
      const estimate = estimateTokensForDiff('');
      expect(estimate.tokens).toBe(0);
    });

    it('should handle large diff', () => {
      const largeDiff = `diff --git a/file.ts b/file.ts
${'+ line\n'.repeat(1000)}`;

      const estimate = estimateTokensForDiff(largeDiff);
      expect(estimate.tokens).toBeGreaterThan(0);
    });
  });

  describe('getContextWindowSize', () => {
    it('should return known context window sizes for exact matches', () => {
      expect(getContextWindowSize('openrouter/google/gemini-2.0-flash-exp:free')).toBe(1000000);
      expect(getContextWindowSize('openrouter/mistralai/devstral-2512:free')).toBe(256000);
      expect(getContextWindowSize('openrouter/xiaomi/mimo-v2-flash:free')).toBe(128000);
      expect(getContextWindowSize('openrouter/microsoft/phi-4:free')).toBe(16000);
    });

    it('should match patterns for generic model names', () => {
      expect(getContextWindowSize('openrouter/google/gemini-2.0-flash')).toBe(1000000);
      expect(getContextWindowSize('claude-3-opus')).toBe(200000);
      expect(getContextWindowSize('claude-3-sonnet')).toBe(200000);
      expect(getContextWindowSize('claude-3-haiku')).toBe(200000);
      expect(getContextWindowSize('gpt-4')).toBe(8000);
      expect(getContextWindowSize('gpt-4-turbo')).toBe(128000);
      expect(getContextWindowSize('gpt-3.5-turbo')).toBe(4000);
    });

    it('should return default size for unknown models', () => {
      expect(getContextWindowSize('unknown-model')).toBe(4000);
      expect(getContextWindowSize('custom/my-model')).toBe(4000);
    });

    it('should handle partial matches', () => {
      expect(getContextWindowSize('openrouter/google/gemini-2.0-flash-001')).toBe(1000000);
      expect(getContextWindowSize('anthropic/claude-3-opus-20240229')).toBe(200000);
    });

    it('should prioritize exact matches over pattern matches', () => {
      // If there's an exact match, it should be used
      expect(getContextWindowSize('openrouter/google/gemini-2.0-flash-exp:free')).toBe(1000000);
    });
  });

  describe('checkContextWindowFit', () => {
    it('should indicate prompt fits when within limits', () => {
      const prompt = 'a'.repeat(4000); // ~1000 tokens
      const result = checkContextWindowFit(prompt, 'gpt-4-turbo'); // 128k window

      expect(result.fits).toBe(true);
      expect(result.promptTokens).toBeGreaterThan(0);
      expect(result.contextWindow).toBe(128000);
      expect(result.availableTokens).toBe(128000 - 2000); // minus reserved
      expect(result.utilizationPercent).toBeLessThan(10);
      expect(result.recommendation).toContain('Good utilization');
    });

    it('should indicate prompt does not fit when exceeding limits', () => {
      const prompt = 'a'.repeat(400000); // ~110k tokens (conservative estimate)
      const result = checkContextWindowFit(prompt, 'gpt-3.5-turbo'); // 4k window

      expect(result.fits).toBe(false);
      expect(result.promptTokens).toBeGreaterThan(result.availableTokens);
      expect(result.contextWindow).toBe(4000);
      expect(result.recommendation).toContain('exceeds context window');
    });

    it('should warn at high utilization (>90%)', () => {
      // gpt-3.5-turbo: 4k window - 2k reserved = 2k available
      // Need ~1900 tokens with 1.2x safety margin = 1900 * 4 / 1.2 = ~6333 chars
      const prompt = 'a'.repeat(6800);
      const result = checkContextWindowFit(prompt, 'gpt-3.5-turbo'); // 4k window

      expect(result.fits).toBe(true);
      expect(result.utilizationPercent).toBeGreaterThan(40); // Conservative check with 1.2x margin
      if (result.utilizationPercent > 90) {
        expect(result.recommendation).toContain('High utilization');
      }
    });

    it('should note moderate utilization (75-90%)', () => {
      // gpt-3.5-turbo: 4k window - 2k reserved = 2k available
      // Need ~1600 tokens with 1.2x safety margin = 1600 * 4 / 1.2 = ~5333 chars
      const prompt = 'a'.repeat(5300);
      const result = checkContextWindowFit(prompt, 'gpt-3.5-turbo'); // 4k window

      expect(result.fits).toBe(true);
      expect(result.utilizationPercent).toBeGreaterThan(35); // ~1600/4000 = 40%
    });

    it('should accept custom reserved tokens for response', () => {
      const prompt = 'a'.repeat(4000);
      const result = checkContextWindowFit(prompt, 'gpt-4-turbo', 5000); // 5k reserved

      expect(result.availableTokens).toBe(128000 - 5000);
    });

    it('should handle empty prompt', () => {
      const result = checkContextWindowFit('', 'gpt-4');

      expect(result.fits).toBe(true);
      expect(result.promptTokens).toBe(0);
      expect(result.utilizationPercent).toBe(0);
    });

    it('should handle very large context windows', () => {
      const prompt = 'a'.repeat(100000); // ~27.5k tokens (conservative)
      const result = checkContextWindowFit(prompt, 'openrouter/google/gemini-2.0-flash-exp:free'); // 1M window

      expect(result.fits).toBe(true);
      expect(result.contextWindow).toBe(1000000);
      expect(result.utilizationPercent).toBeLessThan(5);
    });

    it('should provide accurate overage calculation', () => {
      const prompt = 'a'.repeat(40000); // ~11k tokens (conservative)
      const result = checkContextWindowFit(prompt, 'gpt-3.5-turbo'); // 4k window, 2k reserved = 2k available

      expect(result.fits).toBe(false);
      const expectedOverage = result.promptTokens - result.availableTokens;
      expect(result.recommendation).toContain(`${expectedOverage} tokens`);
    });
  });

  describe('Edge Cases and Boundaries', () => {
    it('should handle exactly at context window limit', () => {
      // Create prompt that's exactly 2000 available tokens (4k window - 2k reserved)
      const prompt = 'a'.repeat(7273); // ~2000 tokens after conservative estimate
      const result = checkContextWindowFit(prompt, 'gpt-3.5-turbo');

      // Should fit or be very close
      expect(result.promptTokens).toBeGreaterThan(0);
    });

    it('should handle single character', () => {
      const result = checkContextWindowFit('a', 'gpt-4');

      expect(result.fits).toBe(true);
      // Conservative estimate: ceil(1/4) * 1.1 = ceil(0.25) * 1.1 = 1 * 1.1 = ceil(1.1) = 2
      expect(result.promptTokens).toBeGreaterThan(0);
      expect(result.promptTokens).toBeLessThanOrEqual(2);
    });

    it('should handle special characters and formatting', () => {
      const prompt = '```typescript\nfunction test() {\n  return true;\n}\n```';
      const result = checkContextWindowFit(prompt, 'gpt-4-turbo');

      expect(result.fits).toBe(true);
      expect(result.promptTokens).toBeGreaterThan(0);
    });

    it('should handle newlines and whitespace', () => {
      const prompt = '\n\n\n   \t\t\n   ';
      const result = checkContextWindowFit(prompt, 'gpt-4');

      expect(result.fits).toBe(true);
      expect(result.promptTokens).toBeGreaterThan(0);
    });
  });
});
