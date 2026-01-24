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
 * Parse OpenCode models --verbose output
 * Format: model ID line followed by JSON object with cost data
 */
function parseOpenCodeModels(output: string): OpenCodeModel[] {
  const models: OpenCodeModel[] = [];
  const lines = output.split('\n');

  let currentModel: string | null = null;
  let jsonLines: string[] = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    // Model ID line (format: provider/model-name)
    if (line.match(/^[a-z][a-z0-9-]+\//)) {
      // Parse previous model's JSON if we have it
      if (jsonLines.length > 0 && currentModel) {
        try {
          const jsonStr = jsonLines.join('\n');
          const parsed = JSON.parse(jsonStr);
          // Only include models from opencode provider with cost.input === 0
          const provider = currentModel.split('/')[0];
          if (provider === 'opencode' && parsed.cost && parsed.cost.input === 0) {
            models.push({
              id: currentModel,
              provider,
              isFree: true,
              contextWindow: parsed.limit?.context,
            });
          }
        } catch (e) {
          // Ignore parse errors
        }
      }

      currentModel = line.trim();
      jsonLines = [];
    } else if (currentModel && line.trim()) {
      // Collect lines that belong to the JSON object
      jsonLines.push(line);
    }
  }

  // Parse the last model
  if (jsonLines.length > 0 && currentModel) {
    try {
      const jsonStr = jsonLines.join('\n');
      const parsed = JSON.parse(jsonStr);
      const provider = currentModel.split('/')[0];
      if (provider === 'opencode' && parsed.cost && parsed.cost.input === 0) {
        models.push({
          id: currentModel,
          provider,
          isFree: true,
          contextWindow: parsed.limit?.context,
        });
      }
    } catch (e) {
      // Ignore parse errors
    }
  }

  return models;
}

/**
 * Fetch available models from OpenCode CLI
 */
export async function fetchOpenCodeModels(timeoutMs = 10000): Promise<OpenCodeModel[]> {
  logger.info('Attempting to fetch OpenCode models via CLI with --verbose...');

  try {
    const { stdout, stderr } = await execAsync('opencode models --verbose', {
      timeout: timeoutMs,
      maxBuffer: 5 * 1024 * 1024, // 5MB buffer for verbose output
    });

    if (stderr) {
      logger.debug(`OpenCode CLI stderr: ${stderr}`);
    }

    const models = parseOpenCodeModels(stdout);
    logger.info(`Discovered ${models.length} free OpenCode models from CLI (cost.input === 0)`);

    if (models.length > 0) {
      logger.debug(`OpenCode free models: ${models.map(m => m.id).join(', ')}`);
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
    logger.info('No free OpenCode models available - CLI may not be installed or accessible');
    return [];
  }

  // All models from fetchOpenCodeModels are already free (cost.input === 0)
  logger.info(`Found ${models.length} free OpenCode models (cost.input === 0)`);

  // Rank and sort
  const ranked = models.map(model => ({
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
