import { Provider } from './base';
import { OpenRouterProvider } from './openrouter';
import { OpenCodeProvider } from './opencode';
import { ReviewConfig } from '../types';
import { RateLimiter } from './rate-limiter';
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

  constructor(private readonly pluginLoader?: PluginLoader) {}

  async createProviders(config: ReviewConfig): Promise<Provider[]> {
    let providers = this.instantiate(config.providers);

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
        providers.push(...this.instantiate(discoveredModels));
      } else {
        logger.warn('⚠️  Dynamic discovery found no models, using static fallbacks');
      }
    }

    // Ensure we have at least some providers; if discovery failed, use static fallbacks
    if (providers.length === 0) {
      logger.warn('Using static fallback providers as last resort');
      providers = this.instantiate(FALLBACK_STATIC_PROVIDERS);
    }

    // De-dup providers and randomize order slightly to avoid sticky first picks
    providers = this.shuffle(this.dedupeProviders(providers));

    providers = this.applyAllowBlock(providers, config);
    logger.info(`After allowBlock: ${providers.length} providers`);
    providers = await this.filterRateLimited(providers);
    logger.info(`After filterRateLimited: ${providers.length} providers`);

    // If providerLimit is 0 or unset, default to 8. Otherwise use the configured limit.
    const selectionLimit = config.providerLimit > 0 ? config.providerLimit : 8;
    const minSelection = Math.min(4, selectionLimit);
    logger.info(`Selection limit: ${selectionLimit} (configured: ${config.providerLimit}), min: ${minSelection}, fallback count: ${config.fallbackProviders.length}`);

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

    const selected: Provider[] = [];
    selected.push(...this.shuffle(openrouterProviders).slice(0, MIN_OPENROUTER));
    selected.push(...this.shuffle(opencodeProviders).slice(0, MIN_OPENCODE));

    // Build remaining pool from all providers excluding already selected
    const selectedNames = new Set(selected.map(s => s.name));
    const remainingPool = this.shuffle([
      ...openrouterProviders,
      ...opencodeProviders,
      ...otherProviders,
    ]).filter(p => !selectedNames.has(p.name));

    while (selected.length < selectionLimit && remainingPool.length > 0) {
      const next = remainingPool.shift()!;
      selected.push(next);
    }

    providers = selected.length > 0 ? selected : providers;

    // Add fallback providers if we haven't reached the selection limit
    if (providers.length < selectionLimit && config.fallbackProviders.length > 0) {
      logger.info(`Adding ${config.fallbackProviders.length} fallback providers to reach target of ${selectionLimit}`);
      const fallbacks = this.instantiate(config.fallbackProviders);
      const filteredFallbacks = await this.filterRateLimited(fallbacks);
      providers = this.dedupeProviders([...providers, ...filteredFallbacks]);
      logger.info(`After adding fallbacks: ${providers.length} providers`);
    } else {
      logger.info(`Skipping fallback providers: providers.length=${providers.length}, selectionLimit=${selectionLimit}, fallbackProviders.length=${config.fallbackProviders.length}`);
    }

    if (providers.length > selectionLimit) {
      providers = this.randomSelect(providers, selectionLimit, minSelection);
    }

    if (providers.length === 0 && config.fallbackProviders.length > 0) {
      logger.warn('Primary providers unavailable, using fallbacks');
      providers = this.instantiate(config.fallbackProviders);
      providers = await this.filterRateLimited(providers);
    }

    if (providers.length === 0) {
      logger.warn('No providers available; falling back to opencode/minimax-m2.1-free');
      providers = this.instantiate(['opencode/minimax-m2.1-free']);
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
    let providers = this.instantiate(this.shuffle(discovered));
    providers = this.dedupeProviders(providers);
    providers = this.applyAllowBlock(providers, config);
    providers = await this.filterRateLimited(providers);

    if (providers.length > max) {
      providers = this.randomSelect(providers, max, Math.min(2, max));
    }

    return providers;
  }

  private instantiate(names: string[]): Provider[] {
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
    // Strip trailing size/version tokens (-9b, -12b, -30b, -v2, etc.)
    const base = modelWithVariant.replace(/-[0-9]+[a-z]*.*$/i, '');
    return `${vendor}/${base}`;
  }

  private usesDefaultProviders(list: string[]): boolean {
    if (!Array.isArray(list) || list.length !== DEFAULT_CONFIG.providers.length) return false;
    return list.every(p => DEFAULT_CONFIG.providers.includes(p));
  }
}
