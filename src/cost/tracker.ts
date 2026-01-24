import { PricingService } from './pricing';
import { CostSummary, TokenUsage } from '../types';

export class CostTracker {
  private totalCost = 0;
  private totalTokens = 0;
  private breakdown: Record<string, number> = {};

  constructor(private readonly pricing: PricingService) {}

  async record(provider: string, usage?: TokenUsage, budgetMaxUsd?: number): Promise<void> {
    if (!usage) return;
    const pricing = await this.pricing.getPricing(provider.replace('openrouter/', ''));
    const cost =
      (pricing.promptPrice / 1_000_000) * usage.promptTokens +
      (pricing.completionPrice / 1_000_000) * usage.completionTokens;

    const projectedTotal = this.totalCost + cost;
    if (budgetMaxUsd && budgetMaxUsd > 0 && projectedTotal > budgetMaxUsd) {
      throw new Error(
        `Budget exceeded: projected $${projectedTotal.toFixed(4)} would exceed cap $${budgetMaxUsd.toFixed(2)} (current $${this.totalCost.toFixed(4)})`
      );
    }

    this.totalCost = projectedTotal;
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

  /**
   * Reset accumulated cost data
   */
  reset(): void {
    this.totalCost = 0;
    this.totalTokens = 0;
    this.breakdown = {};
  }
}
