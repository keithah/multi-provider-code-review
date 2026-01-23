import { PricingService } from './pricing';
import { CostSummary, TokenUsage } from '../types';

export class CostTracker {
  private totalCost = 0;
  private totalTokens = 0;
  private breakdown: Record<string, number> = {};

  constructor(private readonly pricing: PricingService) {}

  async record(provider: string, usage?: TokenUsage): Promise<void> {
    if (!usage) return;
    const pricing = await this.pricing.getPricing(provider.replace('openrouter/', ''));
    const cost =
      (pricing.promptPrice / 1_000_000) * usage.promptTokens +
      (pricing.completionPrice / 1_000_000) * usage.completionTokens;

    this.totalCost += cost;
    this.totalTokens += usage.totalTokens;
    this.breakdown[provider] = (this.breakdown[provider] || 0) + cost;
  }

  summary(): CostSummary {
    return {
      totalCost: this.totalCost,
      totalTokens: this.totalTokens,
      breakdown: this.breakdown,
    };
  }
}
