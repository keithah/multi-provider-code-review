import { ReviewResult } from '../types';

export abstract class Provider {
  constructor(public readonly name: string) {}

  abstract review(prompt: string, timeoutMs: number): Promise<ReviewResult>;

  /**
   * Health check to verify provider responsiveness before running full review
   * @param timeoutMs - Maximum time to wait for response (default 30s)
   * @returns true if provider is responsive, false otherwise
   */
  async healthCheck(timeoutMs: number = 30000): Promise<boolean> {
    try {
      const testPrompt = 'Respond with "OK" if you can process this message.';
      await this.review(testPrompt, timeoutMs);
      return true;
    } catch (error) {
      return false;
    }
  }

  static validate(name: string): boolean {
    const pattern = /^(opencode\/[\w.:~-]+|openrouter\/[\w.:~-]+(?:\/[\w.:~-]+)*)$/i;
    return pattern.test(name);
  }
}

export class RateLimitError extends Error {
  constructor(message: string, public readonly retryAfterSeconds?: number) {
    super(message);
    this.name = 'RateLimitError';
  }
}
