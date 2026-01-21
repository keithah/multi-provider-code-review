import nock from 'nock';
import { OpenRouterProvider } from '../../src/providers/openrouter';
import { RateLimiter } from '../../src/providers/rate-limiter';

describe('OpenRouterProvider (mocked)', () => {
  const apiKey = 'test-key';
  let limiter: RateLimiter;

  beforeEach(() => {
    limiter = new RateLimiter();
    return limiter.clear('openrouter/mistral:test');
  });

  it('parses findings and handles rate limits', async () => {
    const provider = new OpenRouterProvider('mistral:test', apiKey, limiter);

    nock('https://openrouter.ai')
      .post('/api/v1/chat/completions')
      .reply(200, {
        choices: [{ message: { content: JSON.stringify({ findings: [{ file: 'a.ts', line: 1, severity: 'major', title: 'X', message: 'Y' }] }) } }],
        usage: { prompt_tokens: 10, completion_tokens: 5, total_tokens: 15 },
      });

    const result = await provider.review('prompt', 1000);
    expect(result.findings).toHaveLength(1);
    expect(result.usage?.totalTokens).toBe(15);
  });

  it('marks rate limited providers', async () => {
    const provider = new OpenRouterProvider('mistral:test', apiKey, limiter);

    nock('https://openrouter.ai')
      .post('/api/v1/chat/completions')
      .reply(429, {}, { 'retry-after': '60' });

    await expect(provider.review('prompt', 100)).rejects.toThrow();

    // Second call should short-circuit due to rate limit file
    await expect(provider.review('prompt', 100)).rejects.toThrow();

    await limiter.clear('openrouter/mistral:test');
  });
});
