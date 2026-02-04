/**
 * OpenRouter free model configuration
 * Uses OpenRouter's special "free" meta-model that automatically routes to available free models
 */

import { logger } from '../utils/logger';

/**
 * Get OpenRouter free models
 * Returns a mix of the openrouter/free meta-model and specific free models for diversity
 *
 * Strategy: Lead with openrouter/free for automatic routing, then add specific
 * free models as fallbacks to ensure we have multiple distinct reviewers
 */
export async function getBestFreeModels(
  count = 4,
  _timeoutMs = 5000
): Promise<string[]> {
  logger.debug('Using OpenRouter free models for diversity');

  // Mix of automatic routing and specific models for redundancy
  const models = [
    'openrouter/free',  // Primary: OpenRouter's automatic routing
    'openrouter/google/gemini-2.0-flash-exp:free',
    'openrouter/mistralai/devstral-2512:free',
    'openrouter/microsoft/phi-4:free',
    'openrouter/xiaomi/mimo-v2-flash:free',
  ];

  return models.slice(0, count);
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
