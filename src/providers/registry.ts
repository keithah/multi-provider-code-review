import { Provider } from './base';
import { OpenRouterProvider } from './openrouter';
import { OpenCodeProvider } from './opencode';
import { ReviewConfig } from '../types';
import { RateLimiter } from './rate-limiter';
import { ReliabilityTracker } from './reliability-tracker';
import { logger } from '../utils/logger';
import { PricingService } from '../cost/pricing';
import { DEFAULT_CONFIG, FALLBACK_STATIC_PROVIDERS } from '../config/defaults';
import { PluginLoader } from '../plugins';
import { getBestFreeModelsCached as getBestFreeOpenRouterModels } from './openrouter-models';
import { getBestFreeOpenCodeModelsCached as getBestFreeOpenCodeModels } from './opencode-models';

export class ProviderRegistry {
  private readonly rateLimiter = new RateLimiter();
  private rotationIndex = 0;
  private openRouterPricing = new PricingService(process.env.OPENROUTER_API_KEY);

  constructor(
    private readonly pluginLoader?: PluginLoader,
    private readonly reliabilityTracker?: ReliabilityTracker
  ) {}

  async createProviders(config: ReviewConfig): Promise<Provider[]> {
    let providers = this.instantiate(config.providers, config);

    const userProvidedList = Boolean(process.env.REVIEW_PROVIDERS);
    const usingDefaults = this.usesDefaultProviders(config.providers);

    // Dynamically fetch best free models when defaults are in use and no explicit env override
    if (providers.length === 0 && usingDefaults && !userProvidedList) {
      logger.info('🔍 No providers specified, starting dynamic model discovery...');

      const discoveredModels: string[] = [];

      // Fetch best free OpenRouter models (if API key available)
      if (process.env.OPENROUTER_API_KEY) {
        logger.info('Discovering OpenRouter models...');
        const openRouterModels = await getBestFreeOpenRouterModels(8, 5000);
        if (openRouterModels.length > 0) {
          logger.info(`✅ Discovered ${openRouterModels.length} OpenRouter models`);
          discoveredModels.push(...openRouterModels);
        } else {
          logger.warn('⚠️  No OpenRouter models discovered (API may be unavailable)');
        }
      } else {
        logger.info('Skipping OpenRouter discovery (no API key)');
      }

      // Fetch best free OpenCode models (if CLI available)
      logger.info('Discovering OpenCode models...');
      const openCodeModels = await getBestFreeOpenCodeModels(8, 10000);
      if (openCodeModels.length > 0) {
        logger.info(`✅ Discovered ${openCodeModels.length} OpenCode models`);
        discoveredModels.push(...openCodeModels);
      } else {
        logger.info('ℹ️  No OpenCode models discovered (CLI may not be installed)');
      }

      if (discoveredModels.length > 0) {
        logger.info(`🎯 Total discovered: ${discoveredModels.length} free models`);
        logger.info(`   Models: ${discoveredModels.join(', ')}`);
        providers.push(...this.instantiate(discoveredModels, config));
      } else {
        logger.warn('⚠️  Dynamic discovery found no models, using static fallbacks');
      }
    }

    // Ensure we have at least some providers; if discovery failed, use static fallbacks
    if (providers.length === 0) {
      logger.warn('Using static fallback providers as last resort');
      providers = this.instantiate(FALLBACK_STATIC_PROVIDERS, config);
    }

    // De-dup providers
    providers = this.dedupeProviders(providers);

    providers = this.applyAllowBlock(providers, config);
    logger.info(`After allowBlock: ${providers.length} providers`);
    providers = await this.filterRateLimited(providers);
    logger.info(`After filterRateLimited: ${providers.length} providers`);

    // Sort by reliability if using reliability-based selection
    const strategy = config.providerSelectionStrategy ?? 'reliability';
    if (strategy === 'reliability') {
      providers = await this.sortByReliability(providers);
    } else if (strategy === 'random') {
      providers = this.shuffle(providers);
    }
    // round-robin uses applyRotation later

    // Use providerDiscoveryLimit for initial selection (health checking)
    // Take min of discoveryLimit and providerLimit to respect both constraints
    // If discovery limit not set, use providerLimit; if both unset, default to 8
    let discoveryLimit = (config.providerDiscoveryLimit ?? 0) > 0
      ? config.providerDiscoveryLimit!
      : (config.providerLimit > 0 ? config.providerLimit : 8);

    // Respect providerLimit as an upper bound even during discovery
    if (config.providerLimit > 0) {
      discoveryLimit = Math.min(discoveryLimit, config.providerLimit);
    }

    const minSelection = Math.min(4, discoveryLimit);
    logger.info(`Discovery limit: ${discoveryLimit} (for health checks), execution limit: ${config.providerLimit} (for actual review), min: ${minSelection}, fallback count: ${config.fallbackProviders.length}`);

    // Ensure minimum diversity: aim for at least 4 OpenRouter and 2 OpenCode providers when available
    const MIN_OPENROUTER = 4;
    const MIN_OPENCODE = 2;
    const openrouterProviders = this.filterUniqueFamilies(
      providers.filter(p => p.name.startsWith('openrouter/'))
    );
    const opencodeProviders = this.filterUniqueFamilies(
      providers.filter(p => p.name.startsWith('opencode/'))
    );
    const otherProviders = providers.filter(
      p => !p.name.startsWith('openrouter/') && !p.name.startsWith('opencode/')
    );

    // Use reliability-based selection with diversity constraints
    const explorationRate = config.providerExplorationRate ?? 0.3;

    // Concatenate provider groups
    const concatenated = [...openrouterProviders, ...opencodeProviders, ...otherProviders];

    // For reliability strategy, re-establish global sort order after concatenation
    // (filtering into groups preserves local order, but concatenation breaks global order)
    let allProviders: Provider[];
    if (strategy === 'reliability') {
      // Re-sort to maintain global reliability order after group concatenation
      allProviders = await this.sortByReliability(concatenated);
    } else {
      // For other strategies, concatenation order is fine
      allProviders = concatenated;
    }

    let selected: Provider[];
    if (strategy === 'reliability') {
      selected = this.selectWithDiversity(allProviders, discoveryLimit, minSelection, explorationRate);
    } else if (strategy === 'random') {
      // Random selection with diversity requirements
      selected = [];
      selected.push(...this.shuffle(openrouterProviders).slice(0, MIN_OPENROUTER));
      selected.push(...this.shuffle(opencodeProviders).slice(0, MIN_OPENCODE));

      const selectedNames = new Set(selected.map(s => s.name));
      const remainingPool = this.shuffle(allProviders).filter(p => !selectedNames.has(p.name));

      while (selected.length < discoveryLimit && remainingPool.length > 0) {
        const next = remainingPool.shift()!;
        selected.push(next);
      }
    } else {
      // round-robin
      // Guard against empty provider list to prevent division by zero in applyRotation
      if (allProviders.length > 0 && discoveryLimit > 0) {
        selected = this.applyRotation(allProviders, discoveryLimit);
      } else {
        logger.warn(`Cannot apply rotation: allProviders.length=${allProviders.length}, discoveryLimit=${discoveryLimit}`);
        selected = [];
      }
    }

    providers = selected.length > 0 ? selected : providers;

    // Add fallback providers if we haven't reached the selection limit
    // Only add as many fallbacks as needed to avoid evicting primary providers
    if (providers.length < discoveryLimit && config.fallbackProviders.length > 0) {
      const remainingSlots = discoveryLimit - providers.length;
      logger.info(`Adding fallback providers to fill ${remainingSlots} remaining slots (target: ${discoveryLimit})`);

      // Instantiate and filter fallbacks
      const fallbacks = this.instantiate(config.fallbackProviders, config);
      const filteredFallbacks = await this.filterRateLimited(fallbacks);

      // Dedupe against existing providers
      const dedupedFallbacks = this.dedupeProviders([...providers, ...filteredFallbacks])
        .filter(p => !providers.some(existing => existing.name === p.name));

      // Only add up to remainingSlots fallbacks
      const fallbacksToAdd = dedupedFallbacks.slice(0, remainingSlots);
      providers = [...providers, ...fallbacksToAdd];

      logger.info(`Added ${fallbacksToAdd.length} fallback providers (filtered ${dedupedFallbacks.length} candidates, total now: ${providers.length})`);
    } else {
      logger.info(`Skipping fallback providers: providers.length=${providers.length}, discoveryLimit=${discoveryLimit}, fallbackProviders.length=${config.fallbackProviders.length}`);
    }

    // Final check: if still over limit, trim (shouldn't happen with proper remainingSlots logic)
    if (providers.length > discoveryLimit) {
      logger.warn(`Provider count ${providers.length} exceeds discovery limit ${discoveryLimit}, trimming`);
      providers = this.randomSelect(providers, discoveryLimit, minSelection);
    }

    if (providers.length === 0 && config.fallbackProviders.length > 0) {
      logger.warn('Primary providers unavailable, using fallbacks');
      providers = this.instantiate(config.fallbackProviders, config);
      providers = await this.filterRateLimited(providers);
    }

    if (providers.length === 0) {
      logger.warn('No providers available; falling back to opencode/minimax-m2.1-free');
      providers = this.instantiate(['opencode/minimax-m2.1-free'], config);
    }

    return providers;
  }

  /**
   * Discover additional free providers, excluding ones we've already tried.
   * Used when initial health checks fail to yield enough healthy providers.
   */
  async discoverAdditionalFreeProviders(
    existing: string[],
    max: number = 6,
    config: ReviewConfig = DEFAULT_CONFIG
  ): Promise<Provider[]> {
    const existingSet = new Set(existing);
    const discovered: string[] = [];

    if (process.env.OPENROUTER_API_KEY) {
      // Pull a larger candidate pool to increase diversity when earlier picks fail
      const moreOpenRouter = await getBestFreeOpenRouterModels(20, 5000);
      discovered.push(...moreOpenRouter.filter(m => !existingSet.has(m)));
    }

    const moreOpenCode = await getBestFreeOpenCodeModels(12, 10000);
    discovered.push(...moreOpenCode.filter(m => !existingSet.has(m)));

    if (discovered.length === 0) {
      // last resort: static fallbacks not already present
      discovered.push(...FALLBACK_STATIC_PROVIDERS.filter(m => !existingSet.has(m)));
    }

    // Shuffle early to avoid always picking the same heads of the list
    let providers = this.instantiate(this.shuffle(discovered), config);
    providers = this.dedupeProviders(providers);
    providers = this.applyAllowBlock(providers, config);
    providers = await this.filterRateLimited(providers);

    if (providers.length > max) {
      providers = this.randomSelect(providers, max, Math.min(2, max));
    }

    return providers;
  }

  private instantiate(names: string[], config: ReviewConfig = DEFAULT_CONFIG): Provider[] {
    const list: Provider[] = [];

    for (const name of names) {
      // Check if provider is provided by a plugin first (before validation)
      if (this.pluginLoader?.hasProvider(name)) {
        // Extract plugin name from provider name (e.g., "custom/my-provider" -> "custom")
        const pluginName = name.split('/')[0];
        // Support per-plugin API keys: PLUGIN_CUSTOM_API_KEY, fallback to shared PLUGIN_API_KEY
        const pluginEnvVar = `PLUGIN_${pluginName.toUpperCase().replace(/-/g, '_')}_API_KEY`;
        const apiKey = process.env[pluginEnvVar] || process.env.PLUGIN_API_KEY || '';
        const provider = this.pluginLoader.createProvider(name, apiKey);
        if (provider) {
          list.push(provider);
          continue;
        } else {
          logger.warn(`Failed to create provider ${name} from plugin`);
          continue;
        }
      }

      // Validate built-in providers (opencode/, openrouter/)
      if (!Provider.validate(name)) {
        logger.warn(`Skipping invalid provider name: ${name}`);
        continue;
      }

      if (name.startsWith('openrouter/')) {
        const model = name.replace('openrouter/', '');
        const apiKey = process.env.OPENROUTER_API_KEY;
        if (!apiKey) {
          logger.warn(`OPENROUTER_API_KEY not set; skipping OpenRouter provider ${name}`);
          continue;
        }
        if (!config.openrouterAllowPaid && !model.endsWith(':free')) {
          logger.warn(`Skipping paid OpenRouter model ${name} (set openrouterAllowPaid=true to enable)`);
          continue;
        }
        list.push(new OpenRouterProvider(model, apiKey, this.rateLimiter));
        continue;
      }

      if (name.startsWith('opencode/')) {
        const model = name.replace('opencode/', '');
        list.push(new OpenCodeProvider(model));
        continue;
      }
    }

    return list;
  }

  private applyAllowBlock(providers: Provider[], config: ReviewConfig): Provider[] {
    let filtered = providers;

    if (config.providerAllowlist.length > 0) {
      filtered = filtered.filter(provider =>
        config.providerAllowlist.some(pattern => provider.name.includes(pattern))
      );
    }

    if (config.providerBlocklist.length > 0) {
      filtered = filtered.filter(provider =>
        !config.providerBlocklist.some(pattern => provider.name.includes(pattern))
      );
    }

    return filtered;
  }

  private async filterRateLimited(providers: Provider[]): Promise<Provider[]> {
    const available: Provider[] = [];
    for (const provider of providers) {
      const limited = await this.rateLimiter.isRateLimited(provider.name);
      if (!limited) available.push(provider);
    }
    return available;
  }

  private applyRotation(providers: Provider[], limit: number): Provider[] {
    const selected: Provider[] = [];
    for (let i = 0; i < limit; i++) {
      const index = (this.rotationIndex + i) % providers.length;
      selected.push(providers[index]);
    }
    this.rotationIndex = (this.rotationIndex + limit) % providers.length;
    return selected;
  }

  private randomSelect(providers: Provider[], max: number, min: number): Provider[] {
    const shuffled = this.shuffle(providers);
    const count = Math.max(min, Math.min(max, shuffled.length));
    return shuffled.slice(0, count);
  }

  private shuffle<T>(list: T[]): T[] {
    const copy = [...list];
    for (let i = copy.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [copy[i], copy[j]] = [copy[j], copy[i]];
    }
    return copy;
  }

  private dedupeProviders(providers: Provider[]): Provider[] {
    const seen = new Set<string>();
    const result: Provider[] = [];
    for (const p of providers) {
      if (seen.has(p.name)) continue;
      seen.add(p.name);
      result.push(p);
    }
    return result;
  }

  /**
   * Avoid selecting multiple variants of the same underlying model family.
   * e.g., openrouter/nvidia/nemotron-nano-12b... and ...-9b... count as one family.
   */
  private filterUniqueFamilies(providers: Provider[]): Provider[] {
    const seenFamilies = new Set<string>();
    const unique: Provider[] = [];

    for (const p of providers) {
      const family = this.getModelFamily(p.name);
      if (seenFamilies.has(family)) continue;
      seenFamilies.add(family);
      unique.push(p);
    }

    return unique;
  }

  private getModelFamily(name: string): string {
    // expected: openrouter/vendor/model[:variant]
    const parts = name.split('/');
    if (parts.length < 3) return name;
    const vendor = parts[1];
    const modelWithVariant = parts[2].split(':')[0];
    // Strip only size tokens (-9b, -12b, -30b) and version markers (-v2, -v10)
    // Preserve numeric model versions like "phi-4", "gemini-2.0", "devstral-2512"
    const base = modelWithVariant
      .replace(/-\d+b$/i, '')      // Remove size tokens like -9b, -12b
      .replace(/-v\d+[a-z]*$/i, ''); // Remove version markers like -v2, -v10
    return `${vendor}/${base}`;
  }

  private usesDefaultProviders(list: string[]): boolean {
    if (!Array.isArray(list) || list.length !== DEFAULT_CONFIG.providers.length) return false;
    return list.every(p => DEFAULT_CONFIG.providers.includes(p));
  }

  /**
   * Sort providers by reliability score (highest first)
   * Providers without reliability data get default score (0.5)
   */
  private async sortByReliability(providers: Provider[]): Promise<Provider[]> {
    if (!this.reliabilityTracker) {
      // No tracker available, return as-is
      return providers;
    }

    const scored: Array<{ provider: Provider; score: number }> = [];

    for (const provider of providers) {
      const score = await this.reliabilityTracker.getReliabilityScore(provider.name);
      scored.push({ provider, score });
    }

    // Sort by score descending (highest reliability first)
    scored.sort((a, b) => b.score - a.score);

    const sorted = scored.map(s => s.provider);

    if (scored.length > 0) {
      logger.debug(
        `Provider reliability ranking: ${scored.map(s => `${s.provider.name}=${(s.score ?? 0.5).toFixed(2)}`).join(', ')}`
      );
    }

    return sorted;
  }

  /**
   * Select providers with diversity constraints and controlled randomization
   *
   * Strategy:
   * 1. Take top N% by reliability (deterministic exploit)
   * 2. Randomly select remaining slots from pool (exploration)
   * 3. Ensure minimum diversity (OpenRouter/OpenCode mix)
   */
  private selectWithDiversity(
    providers: Provider[],
    discoveryLimit: number,
    minSelection: number,
    explorationRate: number = 0.3
  ): Provider[] {
    if (providers.length <= discoveryLimit) {
      return providers; // Use all available
    }

    const selected: Provider[] = [];

    // Take top (1-explorationRate)% slots deterministically (exploit best performers)
    const deterministicCount = Math.floor(discoveryLimit * (1 - explorationRate));
    selected.push(...providers.slice(0, deterministicCount));

    // Randomly select remaining slots (exploration)
    const explorationCount = discoveryLimit - deterministicCount;
    const explorationPool = providers.slice(deterministicCount);
    const shuffled = this.shuffle(explorationPool);
    selected.push(...shuffled.slice(0, explorationCount));

    // Ensure diversity: check OpenRouter/OpenCode mix
    const openrouterCount = selected.filter(p => p.name.startsWith('openrouter/')).length;
    const opencodeCount = selected.filter(p => p.name.startsWith('opencode/')).length;

    const MIN_OPENROUTER = Math.min(2, discoveryLimit);
    const MIN_OPENCODE = Math.min(1, discoveryLimit);

    // If diversity requirements not met, adjust selection
    if (openrouterCount < MIN_OPENROUTER || opencodeCount < MIN_OPENCODE) {
      return this.adjustForDiversity(providers, discoveryLimit, MIN_OPENROUTER, MIN_OPENCODE);
    }

    logger.info(
      `Selected ${selected.length} providers: ${deterministicCount} by reliability + ${explorationCount} exploration`
    );

    return selected;
  }

  /**
   * Adjust selection to meet diversity requirements
   */
  private adjustForDiversity(
    providers: Provider[],
    limit: number,
    minOpenRouter: number,
    minOpenCode: number
  ): Provider[] {
    const openrouter = providers.filter(p => p.name.startsWith('openrouter/'));
    const opencode = providers.filter(p => p.name.startsWith('opencode/'));
    const others = providers.filter(
      p => !p.name.startsWith('openrouter/') && !p.name.startsWith('opencode/')
    );

    const selected: Provider[] = [];

    // Ensure minimums
    selected.push(...openrouter.slice(0, minOpenRouter));
    selected.push(...opencode.slice(0, minOpenCode));

    // Fill remaining slots from all pools (already sorted by reliability)
    const remaining = limit - selected.length;
    const pool = [
      ...openrouter.slice(minOpenRouter),
      ...opencode.slice(minOpenCode),
      ...others,
    ].filter(p => !selected.includes(p));

    selected.push(...pool.slice(0, remaining));

    return selected.slice(0, limit);
  }
}
