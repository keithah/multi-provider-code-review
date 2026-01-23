import { ReviewResult } from '../types';

export abstract class Provider {
  constructor(public readonly name: string) {}

  abstract review(prompt: string, timeoutMs: number): Promise<ReviewResult>;

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
