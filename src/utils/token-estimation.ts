/**
 * Token estimation utilities for LLM context window validation
 *
 * Uses Claude's recommended estimation: ~4 characters per token for English text
 * More accurate estimation would require model-specific tokenizers
 */

import { FileChange } from '../types';

export interface TokenEstimate {
  tokens: number;
  bytes: number;
  characters: number;
  method: 'simple' | 'accurate';
}

/**
 * Simple token estimation (fast, ~90% accurate)
 * Based on character count heuristic: 1 token ≈ 4 characters
 */
export function estimateTokensSimple(text: string): TokenEstimate {
  const characters = text.length;
  const bytes = Buffer.byteLength(text, 'utf8');

  // Base estimate: 4 chars per token
  let tokens = Math.ceil(characters / 4);

  // Adjust for code (typically denser, more symbols)
  const codeIndicators = (text.match(/[{}()\[\];]/g) || []).length;
  const isCodeHeavy = codeIndicators > characters * 0.05; // >5% code symbols

  if (isCodeHeavy) {
    tokens = Math.ceil(characters / 3); // Code is denser: ~3 chars per token
  }

  return {
    tokens,
    bytes,
    characters,
    method: 'simple',
  };
}

/**
 * Conservative token estimation (always overestimates by ~10%)
 * Use this for context window validation to be safe
 */
export function estimateTokensConservative(text: string): TokenEstimate {
  const simple = estimateTokensSimple(text);

  return {
    ...simple,
    tokens: Math.ceil(simple.tokens * 1.1), // Add 10% safety margin
  };
}

/**
 * Estimate tokens for a diff (special handling for unified diff format)
 */
export function estimateTokensForDiff(diff: string): TokenEstimate {
  // Diff has lots of +/- symbols and repeated context lines
  // Slightly more efficient than raw text
  const estimate = estimateTokensSimple(diff);

  return {
    ...estimate,
    tokens: Math.ceil(estimate.tokens * 0.9), // Diff is ~10% more efficient
  };
}

/**
 * Get context window size for a model
 * Returns default size if unknown
 */
export function getContextWindowSize(modelId: string): number {
  // Known context windows (update as models evolve)
  const CONTEXT_WINDOWS: Record<string, number> = {
    // OpenRouter models (common ones)
    'openrouter/google/gemini-2.0-flash-exp:free': 1000000,  // 1M tokens
    'openrouter/mistralai/devstral-2512:free': 256000,       // 256k tokens
    'openrouter/xiaomi/mimo-v2-flash:free': 128000,          // 128k tokens
    'openrouter/microsoft/phi-4:free': 16000,                // 16k tokens

    // Generic patterns
    'gemini-2.0': 1000000,
    'gemini-1.5-pro': 1000000,
    'gemini-1.5-flash': 1000000,
    'claude-3-opus': 200000,
    'claude-3-sonnet': 200000,
    'claude-3-haiku': 200000,
    'claude-3.5-sonnet': 200000,
    'claude-3.5-haiku': 200000,
    'gpt-4': 8000,
    'gpt-4-turbo': 128000,
    'gpt-4o': 128000,
    'gpt-3.5-turbo': 4000,
    'o1': 200000,
    'o1-mini': 128000,
  };

  // Exact match
  if (CONTEXT_WINDOWS[modelId]) {
    return CONTEXT_WINDOWS[modelId];
  }

  // Pattern matching (e.g., "openrouter/google/gemini-2.0-flash" matches "gemini-2.0")
  for (const [pattern, size] of Object.entries(CONTEXT_WINDOWS)) {
    if (modelId.includes(pattern)) {
      return size;
    }
  }

  // Unknown model - return conservative default
  return 4000; // Assume smallest common window (GPT-3.5 level)
}

/**
 * Check if a prompt fits within a model's context window
 */
export interface ContextFitCheck {
  fits: boolean;
  promptTokens: number;
  contextWindow: number;
  availableTokens: number;
  utilizationPercent: number;
  recommendation: string;
}

export function checkContextWindowFit(
  prompt: string,
  modelId: string,
  reservedTokensForResponse: number = 2000
): ContextFitCheck {
  const estimate = estimateTokensConservative(prompt);
  const contextWindow = getContextWindowSize(modelId);
  const availableTokens = contextWindow - reservedTokensForResponse;
  const fits = estimate.tokens <= availableTokens;
  const utilization = (estimate.tokens / contextWindow) * 100;

  let recommendation = '';

  if (!fits) {
    const overage = estimate.tokens - availableTokens;
    recommendation = `Prompt exceeds context window by ${overage} tokens. ` +
      `Reduce batch size or trim diff content.`;
  } else if (utilization > 90) {
    recommendation = `High utilization (${utilization.toFixed(0)}%). ` +
      `Consider reducing batch size for better response quality.`;
  } else if (utilization > 75) {
    recommendation = `Moderate utilization (${utilization.toFixed(0)}%). ` +
      `Acceptable but monitor response quality.`;
  } else {
    recommendation = `Good utilization (${utilization.toFixed(0)}%). ` +
      `Context window has sufficient headroom.`;
  }

  return {
    fits,
    promptTokens: estimate.tokens,
    contextWindow,
    availableTokens,
    utilizationPercent: utilization,
    recommendation,
  };
}

/**
 * Estimate tokens for a file change
 */
export function estimateTokensForFile(file: FileChange): number {
  // Use patch content if available
  if (file.patch) {
    const estimate = estimateTokensForDiff(file.patch);
    return estimate.tokens;
  }

  // Fallback: estimate from additions/deletions
  // Assume average 80 chars per line, 4 chars per token = 20 tokens/line
  const linesChanged = file.additions + file.deletions;
  return linesChanged * 20;
}

/**
 * Estimate total tokens for a list of files
 */
export function estimateTokensForFiles(files: FileChange[]): number {
  return files.reduce((total, file) => total + estimateTokensForFile(file), 0);
}

/**
 * Calculate optimal batch size based on token budget
 */
export interface BatchSizeRecommendation {
  batchSize: number;
  reason: string;
  estimatedTokensPerBatch: number;
  batches: FileChange[][];
}

export function calculateOptimalBatchSize(
  files: FileChange[],
  targetTokensPerBatch: number = 50000,  // ~50k tokens per batch (fits most models well)
  maxFilesPerBatch: number = 200
): BatchSizeRecommendation {
  if (files.length === 0) {
    return {
      batchSize: 0,
      reason: 'No files to batch',
      estimatedTokensPerBatch: 0,
      batches: [],
    };
  }

  // Estimate token size for each file
  const filesWithSizes = files.map(file => ({
    file,
    tokens: estimateTokensForFile(file),
  }));

  // Sort files by size (largest first) for better bin packing
  filesWithSizes.sort((a, b) => b.tokens - a.tokens);

  // Greedy bin packing: fill batches to target size
  const batches: FileChange[][] = [];
  let currentBatch: FileChange[] = [];
  let currentBatchTokens = 0;

  for (const { file, tokens } of filesWithSizes) {
    // If adding this file would exceed target and we already have files,
    // start a new batch
    if (currentBatchTokens + tokens > targetTokensPerBatch && currentBatch.length > 0) {
      batches.push(currentBatch);
      currentBatch = [];
      currentBatchTokens = 0;
    }

    // Add file to current batch
    currentBatch.push(file);
    currentBatchTokens += tokens;

    // If batch reaches max files, start new batch
    if (currentBatch.length >= maxFilesPerBatch) {
      batches.push(currentBatch);
      currentBatch = [];
      currentBatchTokens = 0;
    }
  }

  // Add remaining files as final batch
  if (currentBatch.length > 0) {
    batches.push(currentBatch);
  }

  // Calculate average batch size
  const avgBatchSize = batches.length > 0 ? Math.ceil(files.length / batches.length) : 0;

  // Calculate average tokens per batch
  const avgTokensPerBatch = batches.length > 0
    ? batches.reduce((sum, batch) => sum + estimateTokensForFiles(batch), 0) / batches.length
    : 0;

  let reason: string;
  if (batches.length === 1) {
    reason = `All ${files.length} files fit in single batch (~${avgTokensPerBatch.toFixed(0)} tokens)`;
  } else if (avgBatchSize < 10) {
    reason = `Large files require small batches (avg ${avgBatchSize} files, ~${avgTokensPerBatch.toFixed(0)} tokens each)`;
  } else if (avgBatchSize > 100) {
    reason = `Small files allow large batches (avg ${avgBatchSize} files, ~${avgTokensPerBatch.toFixed(0)} tokens each)`;
  } else {
    reason = `Mixed file sizes, ${batches.length} batches (avg ${avgBatchSize} files, ~${avgTokensPerBatch.toFixed(0)} tokens each)`;
  }

  return {
    batchSize: avgBatchSize,
    reason,
    estimatedTokensPerBatch: avgTokensPerBatch,
    batches,
  };
}
