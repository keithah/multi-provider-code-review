export interface ModelPricing {
  modelId: string;
  promptPrice: number; // per million tokens USD
  completionPrice: number; // per million tokens USD
  isFree: boolean;
}

export class PricingService {
  private cache = new Map<string, ModelPricing>();
  private cacheExpiry = 0;
  private static readonly CACHE_TTL = 60 * 60 * 1000;

  constructor(private readonly apiKey?: string) {}

  async getPricing(modelId: string): Promise<ModelPricing> {
    if (modelId.includes(':free')) {
      return { modelId, promptPrice: 0, completionPrice: 0, isFree: true };
    }

    if (Date.now() > this.cacheExpiry) {
      await this.refresh();
    }

    return (
      this.cache.get(modelId) || {
        modelId,
        promptPrice: 0,
        completionPrice: 0,
        isFree: false,
      }
    );
  }

  private async refresh(): Promise<void> {
    if (!this.apiKey) return;

    try {
      const response = await fetch('https://openrouter.ai/api/v1/models', {
        headers: { Authorization: `Bearer ${this.apiKey}` },
      });

      if (!response.ok) return;

      const data = (await response.json()) as { data?: Array<{ id: string; pricing?: { prompt?: string; completion?: string } }> };
      for (const model of data.data || []) {
        const pricing = model.pricing || {};
        this.cache.set(model.id, {
          modelId: model.id,
          promptPrice: parseFloat(pricing.prompt || '0') * 1_000_000,
          completionPrice: parseFloat(pricing.completion || '0') * 1_000_000,
          isFree: model.id.includes(':free'),
        });
      }

      this.cacheExpiry = Date.now() + PricingService.CACHE_TTL;
    } catch {
      // Silently ignore pricing failures; downstream cost estimates will be zeroed.
    }
  }
}
