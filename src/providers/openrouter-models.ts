/**
 * OpenRouter free model configuration
 * Uses OpenRouter's special "free" meta-model that automatically routes to available free models
 */

import { logger } from '../utils/logger';

/**
 * Get OpenRouter free models
 * Returns multiple instances of openrouter/free for diversity via dynamic routing
 *
 * Each instance gets a unique identifier to avoid deduplication, but all
 * route to the same OpenRouter free endpoint. OpenRouter handles the actual
 * model selection dynamically at request time.
 */
export async function getBestFreeModels(
  count = 4,
  _timeoutMs = 5000
): Promise<string[]> {
  logger.debug(`Creating ${count} OpenRouter free routing instances`);

  // Return multiple instances with unique IDs for deduplication
  // All route to same 'free' endpoint, but OpenRouter may route each to different models
  return Array.from({ length: count }, (_, i) => `openrouter/free#${i + 1}`);
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

  // Check cache - getBestFreeModels always returns the same single model,
  // so we don't need to check if cache has "enough" models
  if (modelCache && now - modelCache.timestamp < CACHE_TTL_MS) {
    logger.debug('Using cached OpenRouter model list');
    return modelCache.models;
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
