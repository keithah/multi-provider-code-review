import { FileChange } from '../types';
import { logger } from '../utils/logger';

export interface BatchOrchestratorOptions {
  defaultBatchSize: number;
  providerOverrides?: Record<string, number>;
  maxBatchSize?: number;
}

/**
 * Splits file lists into batches to keep prompts small and avoid provider timeouts.
 * Supports provider-specific batch size overrides (e.g., slower models) and
 * parallel-friendly batching.
 */
export class BatchOrchestrator {
  constructor(private readonly options: BatchOrchestratorOptions) {}

  /**
   * Determine the effective batch size for the current provider set.
   * Uses the smallest override to ensure no provider receives more than it can handle.
   */
  getBatchSize(providerNames: string[]): number {
    let size = this.options.defaultBatchSize;

    for (const name of providerNames) {
      const override = this.getOverrideForProvider(name);
      if (override) {
        size = Math.min(size, override);
      }
    }

    const capped = this.options.maxBatchSize
      ? Math.min(size, this.options.maxBatchSize)
      : size;

    const finalSize = Math.max(1, capped);
    logger.debug(`Batch size resolved: ${finalSize} (providers: ${providerNames.join(',') || 'none'})`);
    return finalSize;
  }

  /**
   * Split files into batches of at most batchSize items.
   */
  createBatches(files: FileChange[], batchSize: number): FileChange[][] {
    if (files.length === 0) return [];
    const batches: FileChange[][] = [];

    for (let i = 0; i < files.length; i += batchSize) {
      batches.push(files.slice(i, i + batchSize));
    }

    return batches;
  }

  private getOverrideForProvider(providerName: string): number | undefined {
    const overrides = this.options.providerOverrides || {};
    if (overrides[providerName] !== undefined) return overrides[providerName];

    // Allow prefix-based override, e.g., "openrouter/" to cover multiple models
    const prefix = providerName.split('/')[0];
    return overrides[prefix];
  }
}
