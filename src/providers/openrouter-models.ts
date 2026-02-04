/**
 * OpenRouter free model configuration
 * Uses OpenRouter's special "free" meta-model that automatically routes to available free models
 */

import { logger } from '../utils/logger';

/**
 * Get OpenRouter free models
 * Returns the special "openrouter/free" model which automatically routes to available free models
 */
export async function getBestFreeModels(
  count = 4,
  _timeoutMs = 5000
): Promise<string[]> {
  logger.debug('Using OpenRouter free meta-model for automatic routing');

  // OpenRouter's special "free" model automatically routes to the best available free model
  // This eliminates the need for discovery and ranking
  return Array(count).fill('openrouter/free');
}

/**
 * Fallback models if the free model is unavailable
 * These are known specific free models as of January 2026
 */
export function getFallbackModels(count = 4): string[] {
  const fallbacks = [
    'openrouter/free',  // Primary: Use OpenRouter's automatic routing
    'openrouter/google/gemini-2.0-flash-exp:free',
    'openrouter/mistralai/devstral-2512:free',
    'openrouter/microsoft/phi-4:free',
  ];

  return fallbacks.slice(0, count);
}

/**
 * Cache for model list (valid for 1 hour)
 * With openrouter/free, caching is simpler since we don't fetch dynamic lists
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

  // Get models
  const models = await getBestFreeModels(count, timeoutMs);

  // Update cache
  modelCache = {
    models,
    timestamp: now,
  };

  return models;
}
