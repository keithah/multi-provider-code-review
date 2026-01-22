import { OpenRouterProvider } from '../../src/providers/openrouter';
import { RateLimiter } from '../../src/providers/rate-limiter';

describe('OpenRouterProvider (mocked)', () => {
  const apiKey = 'test-key';
  let limiter: RateLimiter;
  const originalFetch = global.fetch;

  beforeEach(() => {
    limiter = new RateLimiter();
    return limiter.clear('openrouter/mistral:test');
  });

  afterEach(() => {
    jest.restoreAllMocks();
    global.fetch = originalFetch;
  });

  it('parses findings and handles rate limits', async () => {
    const provider = new OpenRouterProvider('mistral:test', apiKey, limiter);

    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      status: 200,
      statusText: 'OK',
      json: async () => ({
        choices: [{ message: { content: JSON.stringify({ findings: [{ file: 'a.ts', line: 1, severity: 'major', title: 'X', message: 'Y' }] }) } }],
        usage: { prompt_tokens: 10, completion_tokens: 5, total_tokens: 15 },
      }),
      headers: new Map(),
    } as any);

    const result = await provider.review('prompt', 1000);
    expect(result.findings).toHaveLength(1);
    expect(result.usage?.totalTokens).toBe(15);
  });

  it('marks rate limited providers', async () => {
    const provider = new OpenRouterProvider('mistral:test', apiKey, limiter);

    global.fetch = jest.fn().mockResolvedValue({
      ok: false,
      status: 429,
      statusText: 'Too Many Requests',
      headers: { get: () => '60' },
      json: async () => ({}),
    } as any);

    await expect(provider.review('prompt', 100)).rejects.toThrow();

    // Second call should short-circuit due to rate limit file
    await expect(provider.review('prompt', 100)).rejects.toThrow();

    await limiter.clear('openrouter/mistral:test');
  });
});
