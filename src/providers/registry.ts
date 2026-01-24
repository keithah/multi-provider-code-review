import { Provider } from './base';
import { OpenRouterProvider } from './openrouter';
import { OpenCodeProvider } from './opencode';
import { ReviewConfig } from '../types';
import { RateLimiter } from './rate-limiter';
import { logger } from '../utils/logger';
import { PricingService } from '../cost/pricing';
import { DEFAULT_CONFIG } from '../config/defaults';
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
      logger.info('No providers specified, dynamically discovering best free models...');

      const discoveredModels: string[] = [];

      // Fetch best free OpenRouter models (if API key available)
      if (process.env.OPENROUTER_API_KEY) {
        const openRouterModels = await getBestFreeOpenRouterModels(4, 5000);
        discoveredModels.push(...openRouterModels);
      }

      // Fetch best free OpenCode models (if CLI available)
      const openCodeModels = await getBestFreeOpenCodeModels(3, 10000);
      discoveredModels.push(...openCodeModels);

      if (discoveredModels.length > 0) {
        logger.info(`Discovered ${discoveredModels.length} free models: ${discoveredModels.join(', ')}`);
        providers.push(...this.instantiate(discoveredModels));
      }
    }

    // Ensure we have at least some providers; if discovery failed, fall back to defaults.
    if (providers.length === 0) {
      logger.warn('No providers discovered, falling back to default config');
      providers = this.instantiate(DEFAULT_CONFIG.providers);
    }

    // De-dup providers
    providers = this.dedupeProviders(providers);

    providers = this.applyAllowBlock(providers, config);
    logger.info(`After allowBlock: ${providers.length} providers`);
    providers = await this.filterRateLimited(providers);
    logger.info(`After filterRateLimited: ${providers.length} providers`);

    // If providerLimit is 0 or unset, default to 6. Otherwise use the configured limit.
    const selectionLimit = config.providerLimit > 0 ? config.providerLimit : 6;
    const minSelection = Math.min(5, selectionLimit);
    logger.info(`Selection limit: ${selectionLimit} (configured: ${config.providerLimit}), min: ${minSelection}, fallback count: ${config.fallbackProviders.length}`);

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
    const shuffled = [...providers].sort(() => Math.random() - 0.5);
    const count = Math.max(min, Math.min(max, shuffled.length));
    return shuffled.slice(0, count);
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

  private usesDefaultProviders(list: string[]): boolean {
    if (!Array.isArray(list) || list.length !== DEFAULT_CONFIG.providers.length) return false;
    return list.every(p => DEFAULT_CONFIG.providers.includes(p));
  }
}
