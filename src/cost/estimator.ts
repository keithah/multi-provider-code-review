import { CostEstimate } from '../types';
import { PricingService } from './pricing';

export class CostEstimator {
  constructor(private readonly pricing: PricingService) {}

  async estimate(
    providerModel: string,
    promptTokens: number,
    completionTokens = 1000
  ): Promise<CostEstimate> {
    const pricing = await this.pricing.getPricing(providerModel);
    const totalTokens = promptTokens + completionTokens;

    const promptCost = (pricing.promptPrice / 1_000_000) * promptTokens;
    const completionCost = (pricing.completionPrice / 1_000_000) * completionTokens;
    const totalCost = promptCost + completionCost;

    return {
      totalCost,
      breakdown: { [providerModel]: totalCost },
      estimatedTokens: totalTokens,
    };
  }
}
