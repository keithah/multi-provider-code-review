import { Provider } from '../../providers/base';
import { RateLimitError } from '../../providers/base';
import { ReviewConfig, ProviderResult } from '../../types';
import { createQueue } from '../../utils/parallel';
import { withRetry } from '../../utils/retry';
import { logger } from '../../utils/logger';

export class LLMExecutor {
  constructor(private readonly config: ReviewConfig) {}

  /**
   * Filter providers by running health checks to identify responsive providers
   * Providers that don't respond within healthCheckTimeoutMs are filtered out
   * @param providers - Array of providers to check
   * @param healthCheckTimeoutMs - Timeout for health check (default 30s)
   * @returns Object with healthy providers and health check results for all providers
   */
  async filterHealthyProviders(
    providers: Provider[],
    healthCheckTimeoutMs: number = 30000
  ): Promise<{ healthy: Provider[]; healthCheckResults: ProviderResult[] }> {
    if (providers.length === 0) return { healthy: [], healthCheckResults: [] };

    logger.info(`Running health checks on ${providers.length} provider(s) with ${healthCheckTimeoutMs}ms timeout...`);

    const queue = createQueue(this.config.providerMaxParallel);
    const healthyProviders: Provider[] = [];
    const healthCheckResults: ProviderResult[] = [];

    for (const provider of providers) {
      queue.add(async () => {
        const started = Date.now();
        try {
          const isHealthy = await provider.healthCheck(healthCheckTimeoutMs);
          const duration = Date.now() - started;

          if (isHealthy) {
            healthyProviders.push(provider);
            healthCheckResults.push({
              name: provider.name,
              status: 'success',
              durationSeconds: duration / 1000,
            });
            logger.info(`✓ Provider ${provider.name} health check passed (${duration}ms)`);
          } else {
            // Health check returned false - likely timed out
            const result: ProviderResult = {
              name: provider.name,
              status: 'timeout',
              error: new Error(`Health check timed out after ${duration}ms - provider did not respond within timeout`),
              durationSeconds: duration / 1000,
            };
            healthCheckResults.push(result);
            logger.warn(`✗ Provider ${provider.name} health check timed out (${duration}ms)`);
          }
        } catch (error) {
          const duration = Date.now() - started;
          const err = error as Error;

          // Determine if this is a timeout error
          let status: ProviderResult['status'] = 'error';
          if (err.message.toLowerCase().includes('timed out') ||
              err.message.toLowerCase().includes('timeout') ||
              (err as any).code === 'ETIMEDOUT') {
            status = 'timeout';
          }

          const result: ProviderResult = {
            name: provider.name,
            status,
            error: err,
            durationSeconds: duration / 1000,
          };
          healthCheckResults.push(result);
          logger.warn(`✗ Provider ${provider.name} health check error (${duration}ms): ${err.message}`);
        }
      });
    }

    await queue.onIdle();

    logger.info(`Health checks complete: ${healthyProviders.length}/${providers.length} provider(s) are responsive`);

    return { healthy: healthyProviders, healthCheckResults };
  }

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
          let status: ProviderResult['status'] = 'error';
          if (err instanceof RateLimitError) {
            status = 'rate-limited';
          } else if (err.name === 'TimeoutError' || err.message.toLowerCase().includes('timed out') || (err as any).code === 'ETIMEDOUT') {
            status = 'timeout';
          }
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
