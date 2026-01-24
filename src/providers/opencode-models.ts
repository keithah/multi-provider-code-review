/**
 * Dynamic OpenCode model discovery
 * Executes `opencode models` to fetch available models
 */

import { exec } from 'child_process';
import { promisify } from 'util';
import { logger } from '../utils/logger';

const execAsync = promisify(exec);

export interface OpenCodeModel {
  id: string;
  provider: string;
  isFree: boolean;
  contextWindow?: number;
}

/**
 * Parse OpenCode models output
 * Expected format: lines like "provider/model-name" or "provider/model-name (free)"
 */
function parseOpenCodeModels(output: string): OpenCodeModel[] {
  const models: OpenCodeModel[] = [];
  const lines = output.split('\n').filter(line => line.trim());

  for (const line of lines) {
    // Skip header lines
    if (line.includes('Available models') || line.includes('===') || line.includes('---')) {
      continue;
    }

    const trimmed = line.trim();
    if (!trimmed) continue;

    // Check if it's a free model (contains "free" or "$0")
    const isFree =
      trimmed.toLowerCase().includes('free') ||
      trimmed.includes('$0.00') ||
      trimmed.includes('$0/');

    // Extract model ID (before any pricing or description)
    let modelId = trimmed.split(/\s+/)[0];

    // Remove any parentheses or extra info
    modelId = modelId.replace(/[()]/g, '').trim();

    if (modelId && modelId.includes('/')) {
      const [provider] = modelId.split('/');

      models.push({
        id: `opencode/${modelId}`,
        provider,
        isFree,
      });
    }
  }

  return models;
}

/**
 * Fetch available models from OpenCode CLI
 */
export async function fetchOpenCodeModels(timeoutMs = 10000): Promise<OpenCodeModel[]> {
  logger.info('Attempting to fetch OpenCode models via CLI...');

  try {
    const { stdout, stderr } = await execAsync('opencode models', {
      timeout: timeoutMs,
      maxBuffer: 1024 * 1024, // 1MB buffer
    });

    if (stderr) {
      logger.debug(`OpenCode CLI stderr: ${stderr}`);
    }

    const models = parseOpenCodeModels(stdout);
    logger.info(`Discovered ${models.length} OpenCode models from CLI`);

    if (models.length > 0) {
      logger.debug(`OpenCode models: ${models.map(m => m.id).join(', ')}`);
    }

    return models;
  } catch (error) {
    if (error instanceof Error) {
      if (error.message.includes('ENOENT') || error.message.includes('command not found')) {
        logger.info('OpenCode CLI not installed, skipping OpenCode model discovery');
      } else if (error.message.includes('timeout')) {
        logger.warn(`OpenCode CLI timeout after ${timeoutMs}ms`);
      } else {
        logger.warn('Failed to fetch OpenCode models', error);
      }
    }
    return [];
  }
}

/**
 * Rank OpenCode models by quality
 */
function rankOpenCodeModel(model: OpenCodeModel): number {
  let score = 0;

  // Prefer free models
  if (model.isFree) {
    score += 100;
  }

  // Prefer certain providers (known for code capabilities)
  const modelLower = model.id.toLowerCase();

  if (modelLower.includes('claude')) {
    score += 50;
  } else if (modelLower.includes('gpt-4')) {
    score += 40;
  } else if (modelLower.includes('gemini')) {
    score += 35;
  } else if (modelLower.includes('deepseek')) {
    score += 30;
  } else if (modelLower.includes('qwen')) {
    score += 25;
  }

  // Prefer models with "code" in the name
  if (modelLower.includes('code')) {
    score += 20;
  }

  return score;
}

/**
 * Get the best free OpenCode models
 */
export async function getBestFreeOpenCodeModels(
  count = 4,
  timeoutMs = 10000
): Promise<string[]> {
  const models = await fetchOpenCodeModels(timeoutMs);

  if (models.length === 0) {
    logger.info('No OpenCode models available - CLI may not be installed or accessible');
    return [];
  }

  logger.info(`Found ${models.length} total OpenCode models`);

  // Filter for free models
  const freeModels = models.filter(m => m.isFree);

  if (freeModels.length === 0) {
    logger.warn(`Found ${models.length} OpenCode models but none are free`);
    return [];
  }

  logger.info(`Found ${freeModels.length} free OpenCode models`);

  // Rank and sort
  const ranked = freeModels.map(model => ({
    modelId: model.id,
    score: rankOpenCodeModel(model),
  }));

  ranked.sort((a, b) => b.score - a.score);

  const selected = ranked.slice(0, count).map(r => r.modelId);

  logger.info(
    `Selected ${selected.length}/${count} best free OpenCode models: ${selected.join(', ')}`
  );

  return selected;
}

/**
 * Cache for OpenCode model discovery (valid for 1 hour)
 */
let modelCache: { models: string[]; timestamp: number } | null = null;
const CACHE_TTL_MS = 60 * 60 * 1000; // 1 hour

/**
 * Get best free OpenCode models with caching
 */
export async function getBestFreeOpenCodeModelsCached(
  count = 4,
  timeoutMs = 10000
): Promise<string[]> {
  const now = Date.now();

  // Check cache
  if (modelCache && now - modelCache.timestamp < CACHE_TTL_MS) {
    logger.debug('Using cached OpenCode model list');
    return modelCache.models.slice(0, count);
  }

  // Fetch fresh models
  const models = await getBestFreeOpenCodeModels(count, timeoutMs);

  // Update cache
  modelCache = {
    models,
    timestamp: now,
  };

  return models;
}
