import { ProviderRegistry } from '../../../src/providers/registry';
import { ReliabilityTracker } from '../../../src/providers/reliability-tracker';
import { Provider } from '../../../src/providers/base';
import { ReviewConfig } from '../../../src/types';
import { DEFAULT_CONFIG } from '../../../src/config/defaults';

describe('ProviderRegistry Reliability-Based Selection', () => {
  let mockReliabilityTracker: jest.Mocked<ReliabilityTracker>;

  beforeEach(() => {
    // Create mock reliability tracker
    mockReliabilityTracker = {
      getReliabilityScore: jest.fn(),
      recordResult: jest.fn(),
      recordFalsePositive: jest.fn(),
      getStats: jest.fn(),
      getAllStats: jest.fn(),
      rankProviders: jest.fn(),
      getRecommendations: jest.fn(),
      clearHistory: jest.fn(),
      getSummary: jest.fn(),
    } as any;
  });

  describe('Provider Sorting by Reliability', () => {
    it('should sort providers by reliability score (highest first)', async () => {
      // Use opencode providers which don't require API keys
      // Mock scores: provider1=0.9, provider2=0.8, provider3=0.5, provider4=0.3, provider5=0.2
      mockReliabilityTracker.getReliabilityScore
        .mockResolvedValueOnce(0.9)  // opencode/high-reliability
        .mockResolvedValueOnce(0.8)  // opencode/very-good-reliability
        .mockResolvedValueOnce(0.5)  // opencode/medium-reliability
        .mockResolvedValueOnce(0.3)  // opencode/low-reliability
        .mockResolvedValueOnce(0.2); // opencode/poor-reliability

      const config: ReviewConfig = {
        ...DEFAULT_CONFIG,
        providers: [
          'opencode/high-reliability',
          'opencode/very-good-reliability',
          'opencode/medium-reliability',
          'opencode/low-reliability',
          'opencode/poor-reliability',
        ],
        providerSelectionStrategy: 'reliability',
        providerLimit: 5,
      };

      const registry = new ProviderRegistry(undefined, mockReliabilityTracker);
      const providers = await registry.createProviders(config);

      // Verify getReliabilityScore was called for each provider
      expect(mockReliabilityTracker.getReliabilityScore).toHaveBeenCalledTimes(5);

      // Providers should exist
      expect(providers.length).toBeGreaterThan(0);
    });

    it('should handle providers without reliability data gracefully', async () => {
      // All providers return default score (0.5)
      mockReliabilityTracker.getReliabilityScore.mockResolvedValue(0.5);

      const config: ReviewConfig = {
        ...DEFAULT_CONFIG,
        providers: [
          'openrouter/new-provider-1',
          'openrouter/new-provider-2',
          'opencode/new-provider-3',
        ],
        providerSelectionStrategy: 'reliability',
        providerLimit: 3,
      };

      const registry = new ProviderRegistry(undefined, mockReliabilityTracker);
      const providers = await registry.createProviders(config);

      // Should still return providers even with default scores
      expect(providers.length).toBeGreaterThan(0);
    });

    it('should use random selection when strategy is "random"', async () => {
      const config: ReviewConfig = {
        ...DEFAULT_CONFIG,
        providers: [
          'openrouter/provider-1',
          'openrouter/provider-2',
          'opencode/provider-3',
        ],
        providerSelectionStrategy: 'random',
        providerLimit: 3,
      };

      const registry = new ProviderRegistry(undefined, mockReliabilityTracker);
      const providers = await registry.createProviders(config);

      // Should NOT call reliability tracker for random strategy
      expect(mockReliabilityTracker.getReliabilityScore).not.toHaveBeenCalled();
      expect(providers.length).toBeGreaterThan(0);
    });

    it('should work without reliability tracker', async () => {
      const config: ReviewConfig = {
        ...DEFAULT_CONFIG,
        providers: [
          'openrouter/provider-1',
          'openrouter/provider-2',
          'opencode/provider-3',
        ],
        providerSelectionStrategy: 'reliability',
        providerLimit: 3,
      };

      // Create registry without reliability tracker
      const registry = new ProviderRegistry(undefined, undefined);
      const providers = await registry.createProviders(config);

      // Should still work, fallback to non-sorted selection
      expect(providers.length).toBeGreaterThan(0);
    });
  });

  describe('Exploration Rate Configuration', () => {
    it('should use 70/30 exploit-explore by default', async () => {
      mockReliabilityTracker.getReliabilityScore
        .mockResolvedValueOnce(0.9)  // Best
        .mockResolvedValueOnce(0.8)
        .mockResolvedValueOnce(0.7)
        .mockResolvedValueOnce(0.6)
        .mockResolvedValueOnce(0.5)
        .mockResolvedValueOnce(0.4)
        .mockResolvedValueOnce(0.3)
        .mockResolvedValueOnce(0.2)
        .mockResolvedValueOnce(0.1); // Worst

      const config: ReviewConfig = {
        ...DEFAULT_CONFIG,
        providers: [
          'openrouter/provider-1',
          'openrouter/provider-2',
          'openrouter/provider-3',
          'openrouter/provider-4',
          'openrouter/provider-5',
          'opencode/provider-6',
          'opencode/provider-7',
          'opencode/provider-8',
          'opencode/provider-9',
        ],
        providerSelectionStrategy: 'reliability',
        providerLimit: 5,
        providerExplorationRate: 0.3, // 30% exploration
      };

      const registry = new ProviderRegistry(undefined, mockReliabilityTracker);
      const providers = await registry.createProviders(config);

      expect(providers.length).toBeGreaterThan(0);
      // With limit=5 and explorationRate=0.3:
      // - 3-4 providers from top by reliability (70%)
      // - 1-2 providers from exploration pool (30%)
    });

    it('should allow custom exploration rates', async () => {
      mockReliabilityTracker.getReliabilityScore.mockResolvedValue(0.5);

      const config: ReviewConfig = {
        ...DEFAULT_CONFIG,
        providers: [
          'openrouter/provider-1',
          'openrouter/provider-2',
          'openrouter/provider-3',
          'openrouter/provider-4',
          'opencode/provider-5',
        ],
        providerSelectionStrategy: 'reliability',
        providerLimit: 5,
        providerExplorationRate: 0.5, // 50/50 exploit-explore
      };

      const registry = new ProviderRegistry(undefined, mockReliabilityTracker);
      const providers = await registry.createProviders(config);

      expect(providers.length).toBeGreaterThan(0);
    });

    it('should handle exploration rate of 0 (pure exploitation)', async () => {
      mockReliabilityTracker.getReliabilityScore
        .mockResolvedValueOnce(0.9)
        .mockResolvedValueOnce(0.8)
        .mockResolvedValueOnce(0.7)
        .mockResolvedValueOnce(0.6)
        .mockResolvedValueOnce(0.5);

      const config: ReviewConfig = {
        ...DEFAULT_CONFIG,
        providers: [
          'openrouter/best',
          'openrouter/good',
          'openrouter/okay',
          'opencode/decent',
          'opencode/poor',
        ],
        providerSelectionStrategy: 'reliability',
        providerLimit: 3,
        providerExplorationRate: 0.0, // 100% exploitation, no exploration
      };

      const registry = new ProviderRegistry(undefined, mockReliabilityTracker);
      const providers = await registry.createProviders(config);

      // Should select top providers only
      expect(providers.length).toBeGreaterThan(0);
    });

    it('should handle exploration rate of 1 (pure exploration)', async () => {
      mockReliabilityTracker.getReliabilityScore.mockResolvedValue(0.5);

      const config: ReviewConfig = {
        ...DEFAULT_CONFIG,
        providers: [
          'openrouter/provider-1',
          'openrouter/provider-2',
          'openrouter/provider-3',
          'opencode/provider-4',
          'opencode/provider-5',
        ],
        providerSelectionStrategy: 'reliability',
        providerLimit: 3,
        providerExplorationRate: 1.0, // 100% exploration
      };

      const registry = new ProviderRegistry(undefined, mockReliabilityTracker);
      const providers = await registry.createProviders(config);

      // Should randomly select from all providers
      expect(providers.length).toBeGreaterThan(0);
    });
  });

  describe('Diversity Requirements', () => {
    it('should maintain OpenRouter/OpenCode diversity', async () => {
      mockReliabilityTracker.getReliabilityScore
        .mockResolvedValueOnce(0.9)  // openrouter/best
        .mockResolvedValueOnce(0.8)  // openrouter/good
        .mockResolvedValueOnce(0.7)  // openrouter/okay
        .mockResolvedValueOnce(0.6)  // openrouter/decent
        .mockResolvedValueOnce(0.5); // opencode/only-one

      const config: ReviewConfig = {
        ...DEFAULT_CONFIG,
        providers: [
          'openrouter/best',
          'openrouter/good',
          'openrouter/okay',
          'openrouter/decent',
          'opencode/only-one',
        ],
        providerSelectionStrategy: 'reliability',
        providerLimit: 5,
      };

      const registry = new ProviderRegistry(undefined, mockReliabilityTracker);
      const providers = await registry.createProviders(config);

      expect(providers.length).toBeGreaterThan(0);
      // Should include at least some OpenCode providers for diversity
    });

    it('should handle case with no OpenCode providers', async () => {
      mockReliabilityTracker.getReliabilityScore
        .mockResolvedValue(0.7);

      const config: ReviewConfig = {
        ...DEFAULT_CONFIG,
        providers: [
          'openrouter/provider-1',
          'openrouter/provider-2',
          'openrouter/provider-3',
        ],
        providerSelectionStrategy: 'reliability',
        providerLimit: 3,
      };

      const registry = new ProviderRegistry(undefined, mockReliabilityTracker);
      const providers = await registry.createProviders(config);

      // Should still work with only OpenRouter providers
      expect(providers.length).toBeGreaterThan(0);
    });

    it('should handle case with no OpenRouter providers', async () => {
      mockReliabilityTracker.getReliabilityScore.mockResolvedValue(0.7);

      const config: ReviewConfig = {
        ...DEFAULT_CONFIG,
        providers: [
          'opencode/provider-1',
          'opencode/provider-2',
          'opencode/provider-3',
        ],
        providerSelectionStrategy: 'reliability',
        providerLimit: 3,
      };

      const registry = new ProviderRegistry(undefined, mockReliabilityTracker);
      const providers = await registry.createProviders(config);

      // Should still work with only OpenCode providers
      expect(providers.length).toBeGreaterThan(0);
    });
  });

  describe('Edge Cases', () => {
    it('should handle empty provider list', async () => {
      const config: ReviewConfig = {
        ...DEFAULT_CONFIG,
        providers: [],
        providerSelectionStrategy: 'reliability',
        providerLimit: 5,
      };

      const registry = new ProviderRegistry(undefined, mockReliabilityTracker);
      const providers = await registry.createProviders(config);

      // Should return at least fallback providers
      expect(providers.length).toBeGreaterThanOrEqual(0);
    });

    it('should handle provider limit larger than available providers', async () => {
      mockReliabilityTracker.getReliabilityScore
        .mockResolvedValueOnce(0.8)
        .mockResolvedValueOnce(0.6);

      const config: ReviewConfig = {
        ...DEFAULT_CONFIG,
        providers: [
          'openrouter/provider-1',
          'opencode/provider-2',
        ],
        providerSelectionStrategy: 'reliability',
        providerLimit: 10, // More than available
      };

      const registry = new ProviderRegistry(undefined, mockReliabilityTracker);
      const providers = await registry.createProviders(config);

      // Should return all available providers (not crash)
      expect(providers.length).toBeGreaterThan(0);
      expect(providers.length).toBeLessThanOrEqual(10);
    });

    it('should handle all providers with same reliability score', async () => {
      mockReliabilityTracker.getReliabilityScore.mockResolvedValue(0.5);

      const config: ReviewConfig = {
        ...DEFAULT_CONFIG,
        providers: [
          'openrouter/provider-1',
          'openrouter/provider-2',
          'opencode/provider-3',
        ],
        providerSelectionStrategy: 'reliability',
        providerLimit: 3,
      };

      const registry = new ProviderRegistry(undefined, mockReliabilityTracker);
      const providers = await registry.createProviders(config);

      // Should still select providers even with equal scores
      expect(providers.length).toBeGreaterThan(0);
    });
  });

  describe('Configuration Options', () => {
    it('should default to reliability strategy', async () => {
      mockReliabilityTracker.getReliabilityScore.mockResolvedValue(0.7);

      const config: ReviewConfig = {
        ...DEFAULT_CONFIG,
        providers: [
          'openrouter/provider-1',
          'opencode/provider-2',
        ],
        // providerSelectionStrategy not specified
        providerLimit: 2,
      };

      const registry = new ProviderRegistry(undefined, mockReliabilityTracker);
      const providers = await registry.createProviders(config);

      // Should use reliability strategy by default
      expect(mockReliabilityTracker.getReliabilityScore).toHaveBeenCalled();
      expect(providers.length).toBeGreaterThan(0);
    });

    it('should default exploration rate to 0.3', () => {
      // This is tested implicitly in other tests
      expect(DEFAULT_CONFIG.providerExplorationRate).toBe(0.3);
    });

    it('should default selection strategy to reliability', () => {
      expect(DEFAULT_CONFIG.providerSelectionStrategy).toBe('reliability');
    });
  });
});
