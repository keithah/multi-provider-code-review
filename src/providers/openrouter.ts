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
              model: this.modelId,
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
        const seconds = retryAfter ? parseInt(retryAfter, 10) : NaN;
        const minutes = !isNaN(seconds) && seconds > 0 ? Math.ceil(seconds / 60) : 60;

        if (response.status === 429) {
          await this.rateLimiter.markRateLimited(this.name, minutes, 'HTTP 429 from OpenRouter');
          throw new RateLimitError(`Rate limited: ${this.name}`, minutes * 60);
        }

        // Treat payment-required models as unavailable for a full day to avoid reselecting them
        if (response.status === 402) {
          const blockMinutes = Math.max(minutes || 0, 60 * 24);
          await this.rateLimiter.markRateLimited(this.name, blockMinutes, 'HTTP 402 Payment Required from OpenRouter');
          throw new RateLimitError(`Payment required: ${this.name}`, blockMinutes * 60);
        }

        throw new Error(`OpenRouter API error: ${response.status} ${response.statusText}`);
      }

      const data = (await response.json()) as {
        choices?: Array<{ message?: { content?: string } }>;
        usage?: { prompt_tokens?: number; completion_tokens?: number; total_tokens?: number };
      };
      const durationSeconds = (Date.now() - started) / 1000;
      const content: string = data.choices?.[0]?.message?.content || '';
      const usage = data.usage;
      const findings = this.extractFindings(content);
      const aiAnalysis = this.extractAIAnalysis(content);

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
