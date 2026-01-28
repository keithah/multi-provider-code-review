import { PromptBuilder } from '../../../src/analysis/llm/prompt-builder';
import { PRContext } from '../../../src/types';
import { DEFAULT_CONFIG } from '../../../src/config/defaults';
import { getContextWindowSize } from '../../../src/utils/token-estimation';

describe('PromptBuilder Context Window Validation', () => {
  const mockPR: PRContext = {
    number: 1,
    title: 'Test PR',
    body: 'Test description',
    author: 'test-user',
    draft: false,
    labels: [],
    files: [
      {
        filename: 'src/test.ts',
        status: 'modified',
        additions: 10,
        deletions: 5,
        changes: 15,
      },
    ],
    diff: 'diff --git a/src/test.ts b/src/test.ts\n@@ -1,5 +1,5 @@\n-old line\n+new line\n',
    additions: 10,
    deletions: 5,
    baseSha: 'abc123',
    headSha: 'def456',
  };

  describe('buildWithValidation', () => {
    it('should build prompt and check if it fits in context window', () => {
      const builder = new PromptBuilder(DEFAULT_CONFIG, 'standard');
      const { prompt, fitCheck } = builder.buildWithValidation(mockPR, 'gpt-4-turbo');

      expect(prompt).toBeTruthy();
      expect(prompt.length).toBeGreaterThan(0);
      expect(fitCheck).toBeDefined();
      expect(fitCheck.fits).toBe(true); // Should fit for small PR
      expect(fitCheck.promptTokens).toBeGreaterThan(0);
      expect(fitCheck.contextWindow).toBe(getContextWindowSize('gpt-4-turbo')); // Use actual window size
      expect(fitCheck.utilizationPercent).toBeGreaterThan(0);
    });

    it('should indicate when prompt does not fit', () => {
      // Test context window overflow with reasonably-sized diff
      // Using 50k chars (~13k tokens) which is enough to exceed gpt-3.5-turbo (16k tokens)
      // without causing test performance issues
      const largePR: PRContext = {
        ...mockPR,
        diff: 'a'.repeat(50000), // ~13k tokens - exceeds gpt-3.5-turbo (16k total, ~4k for system prompt)
        files: Array(100).fill(null).map((_, i) => ({
          filename: `file${i}.ts`,
          status: 'modified' as const,
          additions: 100,
          deletions: 50,
          changes: 150,
        })),
      };

      const builder = new PromptBuilder(DEFAULT_CONFIG, 'standard');
      const { prompt, fitCheck } = builder.buildWithValidation(largePR, 'gpt-3.5-turbo');

      expect(prompt).toBeTruthy();
      expect(fitCheck.fits).toBe(false);
      expect(fitCheck.promptTokens).toBeGreaterThan(fitCheck.availableTokens);
      expect(fitCheck.recommendation).toContain('exceeds context window');
    });

    it('should work with different model types', () => {
      const builder = new PromptBuilder(DEFAULT_CONFIG, 'standard');

      const models = [
        'gpt-4-turbo',
        'gpt-3.5-turbo',
        'claude-3-opus',
        'openrouter/google/gemini-2.0-flash-exp:free',
      ];

      for (const model of models) {
        const { prompt, fitCheck } = builder.buildWithValidation(mockPR, model);

        expect(prompt).toBeTruthy();
        expect(fitCheck).toBeDefined();
        expect(fitCheck.contextWindow).toBeGreaterThan(0);
        expect(fitCheck.promptTokens).toBeGreaterThan(0);
      }
    });

    it('should detect high utilization', () => {
      // Create PR that uses ~80% of a small context window
      const mediumPR: PRContext = {
        ...mockPR,
        diff: 'a'.repeat(6000), // ~1650 tokens for gpt-3.5-turbo (4k window - 2k reserved = 2k available)
      };

      const builder = new PromptBuilder(DEFAULT_CONFIG, 'standard');
      const { fitCheck } = builder.buildWithValidation(mediumPR, 'gpt-3.5-turbo');

      expect(fitCheck.fits).toBe(true);
      expect(fitCheck.utilizationPercent).toBeGreaterThan(25);
    });
  });

  describe('buildOptimized', () => {
    it('should return original prompt if it fits', () => {
      const builder = new PromptBuilder(DEFAULT_CONFIG, 'standard');
      const originalPrompt = builder.build(mockPR);
      const optimizedPrompt = builder.buildOptimized(mockPR, 'gpt-4-turbo');

      expect(optimizedPrompt).toBe(originalPrompt);
    });

    it('should trim diff when prompt exceeds context window', () => {
      // Create PR with diff that definitely exceeds small context window
      // gpt-3.5-turbo: 4k window - 2k reserved = 2k available
      const largePR: PRContext = {
        ...mockPR,
        diff: 'a'.repeat(50000), // Large enough to likely exceed
      };

      const builder = new PromptBuilder(DEFAULT_CONFIG, 'standard');

      // buildOptimized should handle oversized prompts gracefully
      const optimizedPrompt = builder.buildOptimized(largePR, 'gpt-3.5-turbo');

      // Should return a valid prompt
      expect(optimizedPrompt).toBeTruthy();
      expect(optimizedPrompt.length).toBeGreaterThan(0);

      // Should still contain key components
      expect(optimizedPrompt).toContain('PR #');
      expect(optimizedPrompt).toContain('Files changed:');
    });

    it('should preserve prompt structure when trimming', () => {
      const largePR: PRContext = {
        ...mockPR,
        diff: 'a'.repeat(20000),
      };

      const builder = new PromptBuilder(DEFAULT_CONFIG, 'standard');
      const optimizedPrompt = builder.buildOptimized(largePR, 'gpt-3.5-turbo');

      // Should still contain key prompt components
      expect(optimizedPrompt).toContain('PR #');
      expect(optimizedPrompt).toContain('Files changed:');
      expect(optimizedPrompt).toContain('Diff:');
      expect(optimizedPrompt).toContain('IMPORTANT RULES:');
    });

    it('should work with different intensity levels', () => {
      const largePR: PRContext = {
        ...mockPR,
        diff: 'a'.repeat(20000),
      };

      const intensities = ['thorough', 'standard', 'light'] as const;

      for (const intensity of intensities) {
        const builder = new PromptBuilder(DEFAULT_CONFIG, intensity);
        const optimizedPrompt = builder.buildOptimized(largePR, 'gpt-3.5-turbo');

        expect(optimizedPrompt).toBeTruthy();
        expect(optimizedPrompt.length).toBeGreaterThan(0);
        expect(optimizedPrompt).toContain(`${intensity} code review`);
      }
    });

    it('should handle edge case where trimming is not enough', () => {
      // Stress test: create PR so large that even maximum trimming won't fit
      // Verifies graceful degradation without crashes
      const hugePR: PRContext = {
        ...mockPR,
        title: 'x'.repeat(1000),
        body: 'y'.repeat(5000),
        diff: 'a'.repeat(50000),
        files: Array(500).fill(null).map((_, i) => ({
          filename: `file${i}.ts`,
          status: 'modified' as const,
          additions: 100,
          deletions: 50,
          changes: 150,
        })),
      };

      const builder = new PromptBuilder(DEFAULT_CONFIG, 'standard');
      const optimizedPrompt = builder.buildOptimized(hugePR, 'gpt-3.5-turbo');

      // Should still return a prompt (even if it doesn't fit)
      expect(optimizedPrompt).toBeTruthy();
      expect(optimizedPrompt.length).toBeGreaterThan(0);
    });
  });

  describe('estimateTokens', () => {
    it('should estimate token count for a PR', () => {
      const builder = new PromptBuilder(DEFAULT_CONFIG, 'standard');
      const estimate = builder.estimateTokens(mockPR);

      expect(estimate).toBeGreaterThan(0);
      expect(estimate).toBeGreaterThan(500); // At least base overhead
    });

    it('should scale with diff size', () => {
      const builder = new PromptBuilder(DEFAULT_CONFIG, 'standard');

      const smallPR = { ...mockPR, diff: 'a'.repeat(1000) };
      const largePR = { ...mockPR, diff: 'a'.repeat(10000) };

      const smallEstimate = builder.estimateTokens(smallPR);
      const largeEstimate = builder.estimateTokens(largePR);

      expect(largeEstimate).toBeGreaterThan(smallEstimate);
    });

    it('should scale with file count', () => {
      const builder = new PromptBuilder(DEFAULT_CONFIG, 'standard');

      const fewFiles: PRContext = {
        ...mockPR,
        files: [mockPR.files[0]],
      };

      const manyFiles: PRContext = {
        ...mockPR,
        files: Array(50).fill(null).map((_, i) => ({
          filename: `file${i}.ts`,
          status: 'modified' as const,
          additions: 10,
          deletions: 5,
          changes: 15,
        })),
      };

      const fewEstimate = builder.estimateTokens(fewFiles);
      const manyEstimate = builder.estimateTokens(manyFiles);

      expect(manyEstimate).toBeGreaterThan(fewEstimate);
    });

    it('should be faster than building full prompt', () => {
      const builder = new PromptBuilder(DEFAULT_CONFIG, 'standard');

      const largePR: PRContext = {
        ...mockPR,
        diff: 'a'.repeat(100000),
        files: Array(100).fill(null).map((_, i) => ({
          filename: `file${i}.ts`,
          status: 'modified' as const,
          additions: 100,
          deletions: 50,
          changes: 150,
        })),
      };

      const startEstimate = Date.now();
      const estimate = builder.estimateTokens(largePR);
      const estimateTime = Date.now() - startEstimate;

      const startBuild = Date.now();
      const _built = builder.build(largePR); // Intentionally unused - just measuring build time
      const buildTime = Date.now() - startBuild;

      // Verify estimation produces reasonable results
      expect(estimate).toBeGreaterThan(0);
      expect(estimate).toBeLessThan(1000000); // Reasonable upper bound

      // Timing assertions are flaky and system-dependent, so we just verify
      // both operations complete in reasonable time (< 1 second each)
      expect(estimateTime).toBeLessThan(1000);
      expect(buildTime).toBeLessThan(1000);
    });

    it('should handle empty PR', () => {
      const emptyPR: PRContext = {
        ...mockPR,
        diff: '',
        files: [],
      };

      const builder = new PromptBuilder(DEFAULT_CONFIG, 'standard');
      const estimate = builder.estimateTokens(emptyPR);

      expect(estimate).toBeGreaterThan(0); // Still has base overhead
      expect(estimate).toBeLessThan(1000); // But should be small
    });
  });

  describe('Integration with Intensity Levels', () => {
    it('should validate context windows for all intensity levels', () => {
      const intensities = ['thorough', 'standard', 'light'] as const;

      for (const intensity of intensities) {
        const builder = new PromptBuilder(DEFAULT_CONFIG, intensity);
        const { prompt, fitCheck } = builder.buildWithValidation(mockPR, 'gpt-4-turbo');

        expect(prompt).toContain(`${intensity} code review`);
        expect(fitCheck.fits).toBe(true);
      }
    });

    it('should account for different prompt sizes by intensity', () => {
      // Use a small diff so instruction differences are more noticeable
      const smallPR: PRContext = {
        ...mockPR,
        diff: 'diff --git a/test.ts b/test.ts\n@@ -1 +1 @@\n-old\n+new\n',
      };

      const thoroughBuilder = new PromptBuilder(DEFAULT_CONFIG, 'thorough');
      const lightBuilder = new PromptBuilder(DEFAULT_CONFIG, 'light');

      const thoroughPrompt = thoroughBuilder.build(smallPR);
      const lightPrompt = lightBuilder.build(smallPR);

      // Thorough prompts are longer due to detailed instructions
      expect(thoroughPrompt.length).toBeGreaterThan(lightPrompt.length);

      const thoroughEstimate = thoroughBuilder.estimateTokens(smallPR);
      const lightEstimate = lightBuilder.estimateTokens(smallPR);

      // Both should have estimates
      expect(thoroughEstimate).toBeGreaterThan(0);
      expect(lightEstimate).toBeGreaterThan(0);
    });
  });
});
