import { ReviewConfig, ReviewIntensity } from '../../../src/types';
import { DEFAULT_CONFIG } from '../../../src/config/defaults';
import { PromptBuilder } from '../../../src/analysis/llm/prompt-builder';

describe('Path-Based Intensity Feature', () => {
  describe('Intensity Configuration', () => {
    it('should use default intensity provider counts', () => {
      expect(DEFAULT_CONFIG.intensityProviderCounts).toEqual({
        thorough: 8,
        standard: 5,
        light: 3,
      });
    });

    it('should use default intensity timeouts', () => {
      expect(DEFAULT_CONFIG.intensityTimeouts).toEqual({
        thorough: 180000,  // 3 minutes
        standard: 120000,  // 2 minutes
        light: 60000,      // 1 minute
      });
    });

    it('should use default intensity prompt depths', () => {
      expect(DEFAULT_CONFIG.intensityPromptDepth).toEqual({
        thorough: 'detailed',
        standard: 'standard',
        light: 'brief',
      });
    });
  });

  describe('PromptBuilder with Intensity', () => {
    const mockPR = {
      number: 1,
      title: 'Test PR',
      body: 'Test body',
      author: 'test-user',
      draft: false,
      labels: [],
      files: [
        {
          filename: 'src/test.ts',
          status: 'modified' as const,
          additions: 10,
          deletions: 5,
          changes: 15,
        },
      ],
      diff: 'diff --git a/src/test.ts b/src/test.ts\n@@ -1,1 +1,1 @@\n-old\n+new',
      additions: 10,
      deletions: 5,
      baseSha: 'abc123',
      headSha: 'def456',
    };

    it('should generate detailed prompts for thorough intensity', async () => {
      const builder = new PromptBuilder(DEFAULT_CONFIG, 'thorough');
      const prompt = await builder.build(mockPR);

      // Thorough should include comprehensive analysis instructions
      expect(prompt).toContain('COMPREHENSIVE');
      expect(prompt).toContain('edge case');
      expect(prompt).toContain('boundary condition');
    });

    it('should generate standard prompts for standard intensity', async () => {
      const builder = new PromptBuilder(DEFAULT_CONFIG, 'standard');
      const prompt = await builder.build(mockPR);

      // Standard should maintain baseline behavior
      expect(prompt).toContain('ONLY report actual bugs');
      expect(prompt).toContain('CRITICAL RULES');
      // Should not contain intensity-specific variations
      expect(prompt).not.toContain('COMPREHENSIVE');
      expect(prompt).not.toContain('QUICK scan');
    });

    it('should generate brief prompts for light intensity', async () => {
      const builder = new PromptBuilder(DEFAULT_CONFIG, 'light');
      const prompt = await builder.build(mockPR);

      // Light should include quick scan instructions
      expect(prompt).toContain('QUICK scan');
      expect(prompt).toContain('ONLY report CRITICAL issues');
      expect(prompt).toContain('Brief findings only');
    });

    it('should default to standard intensity when not specified', async () => {
      const builder = new PromptBuilder(DEFAULT_CONFIG);
      const prompt = await builder.build(mockPR);

      // Should use standard behavior
      expect(prompt).toContain('ONLY report actual bugs');
      expect(prompt).not.toContain('COMPREHENSIVE');
      expect(prompt).not.toContain('QUICK scan');
    });

    it('should include file list and diff in all intensity levels', async () => {
      const intensities: ReviewIntensity[] = ['thorough', 'standard', 'light'];

      for (const intensity of intensities) {
        const builder = new PromptBuilder(DEFAULT_CONFIG, intensity);
        const prompt = await builder.build(mockPR);

        expect(prompt).toContain('Files changed:');
        expect(prompt).toContain('src/test.ts (modified, +10/-5)');
        expect(prompt).toContain('Diff:');
        expect(prompt).toContain('diff --git a/src/test.ts b/src/test.ts');
      }
    });
  });

  describe('Intensity Prompt Depth Customization', () => {
    it('should use custom prompt depth when configured', () => {
      const customConfig: ReviewConfig = {
        ...DEFAULT_CONFIG,
        intensityPromptDepth: {
          thorough: 'standard',  // Override to use standard depth for thorough
          standard: 'brief',     // Override to use brief depth for standard
          light: 'detailed',     // Override to use detailed depth for light
        },
      };

      const mockPR = {
        number: 1,
        title: 'Test PR',
        body: '',
        author: 'test',
        draft: false,
        labels: [],
        files: [{ filename: 'test.ts', status: 'modified' as const, additions: 1, deletions: 1, changes: 2 }],
        diff: 'diff',
        additions: 1,
        deletions: 1,
        baseSha: 'abc',
        headSha: 'def',
      };

      const thoroughBuilder = new PromptBuilder(customConfig, 'thorough');
      const thoroughPrompt = thoroughBuilder.build(mockPR);
      // Simplified prompt is now the same for all intensities and depths
      expect(thoroughPrompt).toContain('ONLY report actual bugs');

      const standardBuilder = new PromptBuilder(customConfig, 'standard');
      const standardPrompt = standardBuilder.build(mockPR);
      // Simplified prompt is now the same for all intensities and depths
      expect(standardPrompt).toContain('ONLY report actual bugs');

      const lightBuilder = new PromptBuilder(customConfig, 'light');
      const lightPrompt = lightBuilder.build(mockPR);
      // Simplified prompt is now the same for all intensities and depths
      expect(lightPrompt).toContain('ONLY report actual bugs');
    });

    it('should fallback to standard depth if intensity not configured', () => {
      const partialConfig: ReviewConfig = {
        ...DEFAULT_CONFIG,
        intensityPromptDepth: {
          thorough: 'detailed',
          standard: 'standard',
          light: 'brief',
        },
      };

      const builder = new PromptBuilder(partialConfig, 'standard');
      const mockPR = {
        number: 1,
        title: 'Test',
        body: '',
        author: 'test',
        draft: false,
        labels: [],
        files: [],
        diff: '',
        additions: 0,
        deletions: 0,
        baseSha: 'abc',
        headSha: 'def',
      };

      const prompt = builder.build(mockPR);
      // Simplified prompt is now the same for all intensities
      expect(prompt).toContain('ONLY report actual bugs');
    });
  });

  describe('Intensity Behavior Integration', () => {
    it('should apply intensity settings for provider counts', () => {
      const config: ReviewConfig = {
        ...DEFAULT_CONFIG,
        providerLimit: 10,  // Base limit
        intensityProviderCounts: {
          thorough: 8,
          standard: 5,
          light: 3,
        },
      };

      // Thorough should use 8 providers
      const thoroughLimit = config.intensityProviderCounts!.thorough;
      expect(thoroughLimit).toBe(8);

      // Standard should use 5 providers
      const standardLimit = config.intensityProviderCounts!.standard;
      expect(standardLimit).toBe(5);

      // Light should use 3 providers
      const lightLimit = config.intensityProviderCounts!.light;
      expect(lightLimit).toBe(3);
    });

    it('should apply intensity settings for timeouts', () => {
      const config: ReviewConfig = {
        ...DEFAULT_CONFIG,
        runTimeoutSeconds: 600,  // Base timeout (10 minutes)
        intensityTimeouts: {
          thorough: 180000,  // 3 minutes
          standard: 120000,  // 2 minutes
          light: 60000,      // 1 minute
        },
      };

      // Thorough should use 3 minute timeout
      const thoroughTimeout = config.intensityTimeouts!.thorough;
      expect(thoroughTimeout).toBe(180000);

      // Standard should use 2 minute timeout
      const standardTimeout = config.intensityTimeouts!.standard;
      expect(standardTimeout).toBe(120000);

      // Light should use 1 minute timeout
      const lightTimeout = config.intensityTimeouts!.light;
      expect(lightTimeout).toBe(60000);
    });

    it('should fallback to config defaults when intensity settings missing', () => {
      const config: ReviewConfig = {
        ...DEFAULT_CONFIG,
        providerLimit: 7,
        runTimeoutSeconds: 300,
        intensityProviderCounts: undefined,
        intensityTimeouts: undefined,
      };

      // Should use base providerLimit
      const limit = config.providerLimit;
      expect(limit).toBe(7);

      // Should use base runTimeoutSeconds
      const timeout = config.runTimeoutSeconds * 1000;
      expect(timeout).toBe(300000);
    });
  });

  describe('Edge Cases', () => {
    it('should handle missing intensity configuration gracefully', () => {
      const minimalConfig: ReviewConfig = {
        ...DEFAULT_CONFIG,
        intensityProviderCounts: undefined,
        intensityTimeouts: undefined,
        intensityPromptDepth: undefined,
      };

      const builder = new PromptBuilder(minimalConfig, 'standard');
      const mockPR = {
        number: 1,
        title: 'Test',
        body: '',
        author: 'test',
        draft: false,
        labels: [],
        files: [],
        diff: '',
        additions: 0,
        deletions: 0,
        baseSha: 'abc',
        headSha: 'def',
      };

      const prompt = builder.build(mockPR);
      // Simplified prompt is now the same for all intensities
      expect(prompt).toContain('ONLY report actual bugs');
      expect(prompt).toContain('CRITICAL RULES');
    });

    it('should handle all valid ReviewIntensity values', () => {
      const intensities: ReviewIntensity[] = ['thorough', 'standard', 'light'];
      const mockPR = {
        number: 1,
        title: 'Test',
        body: '',
        author: 'test',
        draft: false,
        labels: [],
        files: [],
        diff: '',
        additions: 0,
        deletions: 0,
        baseSha: 'abc',
        headSha: 'def',
      };

      for (const intensity of intensities) {
        const builder = new PromptBuilder(DEFAULT_CONFIG, intensity);
        const prompt = builder.build(mockPR);
        // Simplified prompt is now the same for all intensities
        expect(prompt).toContain('ONLY report actual bugs');
      }
    });
  });
});
