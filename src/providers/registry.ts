import { Provider } from './base';
import { OpenRouterProvider } from './openrouter';
import { OpenCodeProvider } from './opencode';
import { ReviewConfig } from '../types';
import { RateLimiter } from './rate-limiter';
import { logger } from '../utils/logger';

export class ProviderRegistry {
  private readonly rateLimiter = new RateLimiter();
  private rotationIndex = 0;

  async createProviders(config: ReviewConfig): Promise<Provider[]> {
    let providers = this.instantiate(config.providers);
    providers = this.applyAllowBlock(providers, config);
    providers = await this.filterRateLimited(providers);

    if (config.providerLimit > 0 && providers.length > config.providerLimit) {
      providers = this.applyRotation(providers, config.providerLimit);
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
}
