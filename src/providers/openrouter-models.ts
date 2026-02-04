/**
 * OpenRouter free model configuration
 * Uses OpenRouter's special "free" meta-model that automatically routes to available free models
 */

import { logger } from '../utils/logger';

/**
 * Get OpenRouter free models
 * Returns the special "openrouter/free" model which automatically routes to available free models
 *
 * Note: Returns single model since OpenRouter's free meta-model is a routing endpoint,
 * not multiple distinct models. Downstream deduplication will handle any duplicates.
 */
export async function getBestFreeModels(
  _count = 4,
  _timeoutMs = 5000
): Promise<string[]> {
  logger.debug('Using OpenRouter free meta-model for automatic routing');

  // OpenRouter's special "free" model automatically routes to the best available free model
  // Return single model since it's a routing endpoint, not multiple distinct models
  return ['openrouter/free'];
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

  // Check cache - only use if it has enough models for the requested count
  if (modelCache && now - modelCache.timestamp < CACHE_TTL_MS && modelCache.models.length >= count) {
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
