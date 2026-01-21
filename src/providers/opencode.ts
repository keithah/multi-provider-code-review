import { Provider } from './base';
import { ReviewResult } from '../types';
import { logger } from '../utils/logger';

export class OpenCodeProvider extends Provider {
  private static readonly DEFAULT_ENDPOINT = 'https://opencode.local/v1/chat/completions';

  constructor(private readonly modelId: string) {
    super(`opencode/${modelId}`);
  }

  async review(prompt: string, timeoutMs: number): Promise<ReviewResult> {
    const endpoint = process.env.OPENCODE_ENDPOINT || OpenCodeProvider.DEFAULT_ENDPOINT;
    const apiKey = process.env.OPENCODE_API_KEY;

    if (!apiKey) {
      throw new Error('OPENCODE_API_KEY not set');
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);
    const started = Date.now();

    try {
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model: this.modelId,
          messages: [{ role: 'user', content: prompt }],
          temperature: 0.2,
          max_tokens: 1500,
        }),
        signal: controller.signal,
      });

      if (!response.ok) {
        throw new Error(`OpenCode API error: ${response.status} ${response.statusText}`);
      }

      const data = (await response.json()) as {
        choices?: Array<{ message?: { content?: string } }>;
      };
      const content: string = data.choices?.[0]?.message?.content || '';
      const durationSeconds = (Date.now() - started) / 1000;
      return {
        content,
        durationSeconds,
        findings: this.extractFindings(content),
      };
    } catch (error) {
      logger.error(`OpenCode provider failed: ${this.name}`, error as Error);
      throw error;
    } finally {
      clearTimeout(timeout);
    }
  }

  private extractFindings(content: string): any[] {
    try {
      const match = content.match(/```json\s*([\s\S]*?)```/i);
      if (match) {
        const parsed = JSON.parse(match[1]);
        return parsed.findings || [];
      }
    } catch (error) {
      logger.debug('Failed to parse findings from OpenCode response', error as Error);
    }
    return [];
  }
}
