/**
 * Dynamic OpenRouter model discovery and ranking
 * Fetches available free models and selects the best ones
 */

import { logger } from '../utils/logger';

export interface OpenRouterModel {
  id: string;
  name: string;
  pricing: {
    prompt: string;
    completion: string;
  };
  context_length: number;
  top_provider?: {
    context_length?: number;
    max_completion_tokens?: number;
  };
  architecture?: {
    modality?: string;
    tokenizer?: string;
    instruct_type?: string;
  };
}

export interface ModelRanking {
  modelId: string;
  score: number;
  contextLength: number;
  isFree: boolean;
}

/**
 * Fetch available models from OpenRouter API
 */
export async function fetchOpenRouterModels(timeoutMs = 5000, query = 'max_price=0&order=top-weekly'): Promise<OpenRouterModel[]> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(`https://openrouter.ai/api/v1/models?${query}`, {
      signal: controller.signal,
      headers: {
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      throw new Error(`OpenRouter API error: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();
    return data.data || [];
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') {
      logger.warn('OpenRouter model fetch timed out');
    } else {
      logger.warn('Failed to fetch OpenRouter models', error as Error);
    }
    return [];
  } finally {
    clearTimeout(timeout);
  }
}

/**
 * Check if a model is free (pricing = "0")
 */
export function isFreeModel(model: OpenRouterModel): boolean {
  return (
    model.pricing.prompt === '0' &&
    model.pricing.completion === '0'
  );
}

/**
 * Rank models by quality metrics
 * Higher score = better model
 */
export function rankModel(model: OpenRouterModel): number {
  let score = 0;

  // Context length (normalized to 0-100 scale, 128k = 100)
  const contextLength = model.context_length || model.top_provider?.context_length || 0;
  score += Math.min(100, (contextLength / 128000) * 100);

  // Prefer instruction-tuned models
  if (model.architecture?.instruct_type) {
    score += 20;
  }

  // Prefer models with "code" in the name (better for code review)
  if (model.id.toLowerCase().includes('code') || model.name.toLowerCase().includes('code')) {
    score += 30;
  }

  // Prefer newer/larger models based on name patterns
  if (model.id.includes('2.5') || model.id.includes('3.') || model.id.includes('4.')) {
    score += 10;
  }

  // Penalize very small context windows
  if (contextLength < 4000) {
    score -= 50;
  }

  return score;
}

/**
 * Get the best free models from OpenRouter
 */
export async function getBestFreeModels(
  count = 4,
  timeoutMs = 5000
): Promise<string[]> {
  logger.info('Fetching OpenRouter model list from API...');
  const models = await fetchOpenRouterModels(timeoutMs);

  if (models.length === 0) {
    logger.warn('No models fetched from OpenRouter API, using fallback');
    return getFallbackModels(count);
  }

  logger.info(`Fetched ${models.length} total models from OpenRouter`);

  // Filter for free models
  const freeModels = models.filter(isFreeModel);

  if (freeModels.length === 0) {
    logger.warn('No free models available from OpenRouter, using fallback');
    return getFallbackModels(count);
  }

  logger.info(`Found ${freeModels.length} free OpenRouter models`);

  // Rank and sort models
  // Note: Popularity boost is added even though API returns models ordered by top-weekly
  // This ensures popular models are strongly preferred in the final ranking, combining
  // API ordering with our quality metrics (context length, code-focus, instruction tuning)
  const rankedModels: ModelRanking[] = freeModels.map((model, idx) => {
    const popularityBoost = (freeModels.length - idx); // Boost decreases with position
    return {
      modelId: `openrouter/${model.id}`,
      score: rankModel(model) + popularityBoost,
      contextLength: model.context_length || 0,
      isFree: true,
    };
  });

  rankedModels.sort((a, b) => b.score - a.score);

  // Take a slightly oversized pool to encourage diversity, then shuffle
  const poolSize = Math.min(rankedModels.length, Math.max(count * 2, count + 2));
  const pool = rankedModels.slice(0, poolSize).map(m => m.modelId);
  const selectedModels = shuffle(pool).slice(0, count);

  logger.info(
    `Selected ${selectedModels.length}/${count} best free OpenRouter models: ${selectedModels.join(', ')}`
  );

  return selectedModels;
}

/**
 * Fallback models if API fetch fails
 * These are known to work as of January 2026
 */
export function getFallbackModels(count = 4): string[] {
  const fallbacks = [
    'openrouter/mistralai/devstral-2512:free',
    'openrouter/xiaomi/mimo-v2-flash:free',
    'openrouter/microsoft/phi-4:free',
    'openrouter/google/gemini-2.0-flash-exp:free',
  ];

  return fallbacks.slice(0, count);
}

function shuffle<T>(arr: T[]): T[] {
  const copy = [...arr];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

/**
 * Cache for model discovery (valid for 1 hour)
 */
let modelCache: { models: string[]; timestamp: number } | null = null;
const CACHE_TTL_MS = 60 * 60 * 1000; // 1 hour

/**
 * Get best free models with caching
 */
export async function getBestFreeModelsCached(
  count = 4,
  timeoutMs = 5000
): Promise<string[]> {
  const now = Date.now();

  // Check cache
  if (modelCache && now - modelCache.timestamp < CACHE_TTL_MS) {
    logger.debug('Using cached OpenRouter model list');
    return modelCache.models.slice(0, count);
  }

  // Fetch fresh models
  const models = await getBestFreeModels(count, timeoutMs);

  // Update cache
  modelCache = {
    models,
    timestamp: now,
  };

  return models;
}
