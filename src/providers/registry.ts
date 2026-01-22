import { Provider } from './base';
import { OpenRouterProvider } from './openrouter';
import { OpenCodeProvider } from './opencode';
import { ReviewConfig } from '../types';
import { RateLimiter } from './rate-limiter';
import { logger } from '../utils/logger';
import { PricingService } from '../cost/pricing';
import { DEFAULT_CONFIG } from '../config/defaults';

export class ProviderRegistry {
  private readonly rateLimiter = new RateLimiter();
  private rotationIndex = 0;
  private openRouterPricing = new PricingService(process.env.OPENROUTER_API_KEY);

  async createProviders(config: ReviewConfig): Promise<Provider[]> {
    let providers = this.instantiate(config.providers);

    const userProvidedList = Boolean(process.env.REVIEW_PROVIDERS);
    const usingDefaults = this.usesDefaultProviders(config.providers);

    // Only fetch OpenRouter models when defaults are in use and no explicit env override.
    if (process.env.OPENROUTER_API_KEY && providers.length === 0 && usingDefaults && !userProvidedList) {
      providers.push(...this.instantiate(DEFAULT_CONFIG.providers));
      const freeModels = await this.fetchFreeOpenRouterModels();
      providers.push(...this.instantiate(freeModels));
    }

    // Ensure we have at least some providers; if user list is empty, fall back to defaults.
    if (providers.length === 0) {
      providers = this.instantiate(DEFAULT_CONFIG.providers);
    }

    // De-dup providers
    providers = this.dedupeProviders(providers);

    providers = this.applyAllowBlock(providers, config);
    providers = await this.filterRateLimited(providers);

    const selectionLimit = config.providerLimit > 0 ? config.providerLimit : Math.min(6, providers.length || 6);
    const minSelection = Math.min(5, selectionLimit);

    // Add fallback providers if we haven't reached the selection limit
    if (providers.length < selectionLimit && config.fallbackProviders.length > 0) {
      logger.info(`Adding ${config.fallbackProviders.length} fallback providers to reach target of ${selectionLimit}`);
      const fallbacks = this.instantiate(config.fallbackProviders);
      const filteredFallbacks = await this.filterRateLimited(fallbacks);
      providers = this.dedupeProviders([...providers, ...filteredFallbacks]);
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

  private async fetchFreeOpenRouterModels(): Promise<string[]> {
    try {
      const response = await fetch('https://openrouter.ai/api/v1/models', {
        headers: { Authorization: `Bearer ${process.env.OPENROUTER_API_KEY}` },
      });
      if (!response.ok) {
        logger.warn(`Failed to fetch OpenRouter models: HTTP ${response.status}`);
        return [];
      }
      const data = (await response.json()) as { data?: Array<{ id: string; pricing?: { prompt?: string; completion?: string } }> };
      const free = (data.data || [])
        .filter(model => model.id.includes(':free') || (model.pricing?.prompt === '0' && model.pricing?.completion === '0'))
        .map(model => `openrouter/${model.id}`);
      // ensure uniqueness and at least 8 if available
      const unique = Array.from(new Set(free));
      const target = Math.max(8, Math.min(unique.length, 12));
      return unique.slice(0, target);
    } catch (error) {
      logger.warn('Error fetching OpenRouter models', error as Error);
      return [];
    }
  }

  private usesDefaultProviders(list: string[]): boolean {
    if (!Array.isArray(list) || list.length !== DEFAULT_CONFIG.providers.length) return false;
    return list.every(p => DEFAULT_CONFIG.providers.includes(p));
  }
}
