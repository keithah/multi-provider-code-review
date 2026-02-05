import { Provider, RateLimitError } from './base';
import { ReviewResult } from '../types';
import { RateLimiter } from './rate-limiter';
import { logger } from '../utils/logger';
import { withRetry } from '../utils/retry';
// Node 18+ provides global fetch; if unavailable, we throw a clear error.

export class OpenRouterProvider extends Provider {
  private static readonly BASE_URL = 'https://openrouter.ai/api/v1';

  constructor(
    private readonly modelId: string,
    private readonly apiKey: string,
    private readonly rateLimiter: RateLimiter
  ) {
    super(`openrouter/${modelId}`);
    if (typeof fetch === 'undefined') {
      throw new Error('fetch is not available. Please use Node.js 18+ or polyfill fetch.');
    }
  }

  async review(prompt: string, timeoutMs: number): Promise<ReviewResult> {
    if (await this.rateLimiter.isRateLimited(this.name)) {
      throw new RateLimitError(`${this.name} is currently rate-limited`);
    }

    if (typeof fetch !== 'function') {
      throw new Error('Global fetch is not available; please use Node 18+ or provide a fetch polyfill.');
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);
    const started = Date.now();

    // Strip instance suffix (e.g., "free#1" -> "free") for API routing
    // Multiple instances can route to the same endpoint for diversity
    const apiModelId = this.modelId.replace(/#\d+$/, '');

    try {
      const response = await withRetry(
        () =>
          fetch(`${OpenRouterProvider.BASE_URL}/chat/completions`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${this.apiKey}`,
              'HTTP-Referer': 'https://github.com/keithah/multi-provider-code-review',
              'X-Title': 'Multi-Provider Code Review',
            },
            body: JSON.stringify({
              model: apiModelId,
              messages: [{ role: 'user', content: prompt }],
              temperature: 0.1,
              max_tokens: 2000,
            }),
            signal: controller.signal,
          }),
        {
          retries: 1,
          retryOn: error => {
            const err = error as Error;
            if (err instanceof RateLimitError) return false;
            if (err.name === 'AbortError') return false;
            return true;
          },
        }
      );

      if (!response || !('ok' in response)) {
        throw new Error('OpenRouter API returned invalid response');
      }

      if (!response.ok) {
        const retryAfter = response.headers.get('retry-after');
        let seconds: number = NaN;

        if (retryAfter) {
          // Try parsing as integer (delay-seconds format)
          const parsedSeconds = parseInt(retryAfter, 10);

          // Validate parsed integer: must be a valid non-negative number
          if (!isNaN(parsedSeconds) && parsedSeconds >= 0) {
            seconds = parsedSeconds;
          } else {
            // If not a valid integer, try parsing as HTTP-date
            const parsedDate = Date.parse(retryAfter);
            if (!isNaN(parsedDate) && parsedDate > Date.now()) {
              seconds = Math.ceil((parsedDate - Date.now()) / 1000);
            }
          }
        }

        const minutes = !isNaN(seconds) && seconds > 0 ? Math.ceil(seconds / 60) : 60;

        if (response.status === 429) {
          await this.rateLimiter.markRateLimited(this.name, minutes, 'HTTP 429 from OpenRouter');
          throw new RateLimitError(`Rate limited: ${this.name}`, minutes * 60);
        }

        // HTTP 402 Payment Required: Model requires payment/credits
        // Strategy: Block for 24 hours (or retry-after if longer) to prevent:
        // 1. Repeated selection attempts that always fail (wastes API quota)
        // 2. Unnecessary error logging and circuit breaker trips
        // 3. User confusion from recurring payment errors
        //
        // Rationale for 24-hour minimum:
        // - Payment status rarely changes within a day
        // - Gives time for users to add credits/upgrade plan
        // - Prevents rapid retry cycles that could trigger rate limits
        //
        // Note: This is a soft block via rate limiter, not permanent.
        // Manually clearing rate limit cache will allow retry if needed.
        if (response.status === 402) {
          const blockMinutes = Math.max(minutes || 0, 60 * 24);
          logger.warn(
            `Model ${this.name} returned 402 Payment Required. ` +
            `Blocking for ${blockMinutes} minutes to avoid repeated failures. ` +
            `This usually means the model requires credits or a paid plan.`
          );
          await this.rateLimiter.markRateLimited(this.name, blockMinutes, 'HTTP 402 Payment Required from OpenRouter');
          throw new RateLimitError(`Payment required: ${this.name}`, blockMinutes * 60);
        }

        throw new Error(`OpenRouter API error: ${response.status} ${response.statusText}`);
      }

      const data = (await response.json()) as {
        choices?: Array<{ message?: { content?: string } }>;
        usage?: { prompt_tokens?: number; completion_tokens?: number; total_tokens?: number };
        model?: string;  // OpenRouter returns the actual model that handled the request
      };
      const durationSeconds = (Date.now() - started) / 1000;
      const content: string = data.choices?.[0]?.message?.content || '';
      const usage = data.usage;
      const actualModel = data.model;  // Capture which model OpenRouter actually routed to
      const findings = this.extractFindings(content);
      const aiAnalysis = this.extractAIAnalysis(content);

      // Log which model was actually used for dynamic routing transparency
      if (actualModel && actualModel !== apiModelId) {
        logger.info(`OpenRouter routed ${this.name} -> ${actualModel}`);
      }

      return {
        content,
        usage: usage
          ? {
              promptTokens: usage.prompt_tokens ?? 0,
              completionTokens: usage.completion_tokens ?? 0,
              totalTokens: usage.total_tokens ?? 0,
            }
          : undefined,
        durationSeconds,
        findings,
        aiLikelihood: aiAnalysis?.likelihood,
        aiReasoning: aiAnalysis?.reasoning,
        actualModel: actualModel,  // Include actual model in result for analytics
      };
    } finally {
      clearTimeout(timeout);
    }
  }

  private extractFindings(content: string): any[] {
    try {
      const jsonMatch = content.match(/```json\s*([\s\S]*?)```/i);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[1]);
        if (Array.isArray(parsed)) return parsed;
        return parsed.findings || [];
      }

      const parsed = JSON.parse(content);
      if (Array.isArray(parsed)) return parsed;
      return parsed.findings || [];
    } catch (error) {
      logger.debug('Failed to parse findings from content', error);
      return [];
    }
  }

  private extractAIAnalysis(
    content: string
  ): { likelihood: number; reasoning?: string } | undefined {
    try {
      const jsonMatch = content.match(/```json\s*([\s\S]*?)```/i);
      const raw = jsonMatch ? jsonMatch[1] : content;
      const parsed = JSON.parse(raw);
      if (parsed.ai_likelihood !== undefined) {
        return { likelihood: parsed.ai_likelihood, reasoning: parsed.ai_reasoning };
      }
    } catch (error) {
      logger.debug('Failed to parse AI analysis from OpenRouter response', error as Error);
    }
    return undefined;
  }
}
