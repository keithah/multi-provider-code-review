import { Provider } from '../../providers/base';
import { RateLimitError } from '../../providers/base';
import { ReviewConfig, ProviderResult } from '../../types';
import { createQueue } from '../../utils/parallel';
import { withRetry } from '../../utils/retry';
import { logger } from '../../utils/logger';

export class LLMExecutor {
  constructor(private readonly config: ReviewConfig) {}

  async execute(providers: Provider[], prompt: string): Promise<ProviderResult[]> {
    const queue = createQueue(this.config.providerMaxParallel);
    const results: ProviderResult[] = [];

    for (const provider of providers) {
      queue.add(async () => {
        const started = Date.now();
        const timeoutMs = this.config.runTimeoutSeconds * 1000;

        const runner = async () => provider.review(prompt, timeoutMs);

        try {
          const result = await withRetry(runner, {
            retries: Math.max(0, this.config.providerRetries - 1),
            retryOn: error => {
              if (error instanceof RateLimitError) return false;
              if (error.message.includes('timed out after')) return false;
              return true;
            },
          });
          results.push({
            name: provider.name,
            status: 'success',
            result,
            durationSeconds: (Date.now() - started) / 1000,
          });
        } catch (error) {
          const err = error as Error;
          const status: ProviderResult['status'] = err instanceof RateLimitError ? 'rate-limited' : 'error';
          logger.warn(`Provider ${provider.name} failed: ${err.message}`);
          results.push({
            name: provider.name,
            status,
            error: err,
            durationSeconds: (Date.now() - started) / 1000,
          });
        }
      });
    }

    await queue.onIdle();
    return results;
  }
}
