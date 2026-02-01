import { ReviewResult } from '../types';

export abstract class Provider {
  constructor(public readonly name: string) {}

  abstract review(prompt: string, timeoutMs: number): Promise<ReviewResult>;

  /**
   * Health check to verify provider responsiveness before running full review
   * Uses a realistic mini code review task to better predict actual performance
   * @param timeoutMs - Maximum time to wait for response (default 30s)
   * @returns true if provider is responsive, false otherwise
   */
  async healthCheck(timeoutMs: number = 30000): Promise<boolean> {
    try {
      // Use a realistic code review task that exercises the same code paths
      // as the full review but with minimal input
      const testPrompt = `Review this code change and respond with a brief finding in JSON format:
\`\`\`typescript
function add(a, b) {
  return a + b;  // Missing type annotations
}
\`\`\`

Respond with: {"findings": [{"file": "test.ts", "line": 1, "severity": "minor", "title": "title", "message": "msg"}]}`;

      await this.review(testPrompt, timeoutMs);
      return true;
    } catch (error) {
      return false;
    }
  }

  static validate(name: string): boolean {
    const pattern = /^(opencode\/[\w.:~-]+|openrouter\/[\w.:~-]+(?:\/[\w.:~-]+)*|claude\/[\w.:~-]+|codex\/[\w.:~-]+|gemini\/[\w.:~-]+)$/i;
    return pattern.test(name);
  }
}

export class RateLimitError extends Error {
  constructor(message: string, public readonly retryAfterSeconds?: number) {
    super(message);
    this.name = 'RateLimitError';
  }
}
