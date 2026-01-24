import { OpenRouterProvider } from '../../src/providers/openrouter';
import { RateLimiter } from '../../src/providers/rate-limiter';
import { RateLimitError } from '../../src/providers/base';

describe('OpenRouterProvider Integration', () => {
  const apiKey = 'test-api-key';
  let limiter: RateLimiter;
  const originalFetch = global.fetch;

  beforeEach(async () => {
    limiter = new RateLimiter();
    await limiter.clear('openrouter/test-model');
  });

  afterEach(() => {
    jest.restoreAllMocks();
    global.fetch = originalFetch;
  });

  describe('Successful Reviews', () => {
    it('should parse findings from JSON object format', async () => {
      const provider = new OpenRouterProvider('test-model', apiKey, limiter);

      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        status: 200,
        statusText: 'OK',
        json: async () => ({
          choices: [{
            message: {
              content: JSON.stringify({
                findings: [
                  { file: 'src/app.ts', line: 10, severity: 'critical', title: 'Security Issue', message: 'SQL injection risk' },
                  { file: 'src/app.ts', line: 20, severity: 'major', title: 'Performance', message: 'Inefficient loop' }
                ]
              })
            }
          }],
          usage: { prompt_tokens: 100, completion_tokens: 50, total_tokens: 150 }
        }),
        headers: new Map()
      } as any);

      const result = await provider.review('test prompt', 5000);

      expect(result.findings).toHaveLength(2);
      expect(result.findings![0].file).toBe('src/app.ts');
      expect(result.findings![0].severity).toBe('critical');
      expect(result.usage?.totalTokens).toBe(150);
      expect(result.usage?.promptTokens).toBe(100);
      expect(result.usage?.completionTokens).toBe(50);
    });

    it('should parse findings from direct array format', async () => {
      const provider = new OpenRouterProvider('test-model', apiKey, limiter);

      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({
          choices: [{
            message: {
              content: JSON.stringify([
                { file: 'test.ts', line: 5, severity: 'minor', title: 'Style', message: 'Use const' }
              ])
            }
          }],
          usage: { total_tokens: 75 }
        }),
        headers: new Map()
      } as any);

      const result = await provider.review('test', 5000);

      expect(result.findings).toHaveLength(1);
      expect(result.findings![0].file).toBe('test.ts');
    });

    it('should parse findings from markdown code block', async () => {
      const provider = new OpenRouterProvider('test-model', apiKey, limiter);

      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({
          choices: [{
            message: {
              content: '```json\n{"findings": [{"file": "a.ts", "line": 1, "severity": "major", "title": "Test", "message": "Fix this"}]}\n```'
            }
          }],
          usage: { total_tokens: 50 }
        }),
        headers: new Map()
      } as any);

      const result = await provider.review('test', 5000);

      expect(result.findings).toHaveLength(1);
    });

    it('should extract AI likelihood and reasoning', async () => {
      const provider = new OpenRouterProvider('test-model', apiKey, limiter);

      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({
          choices: [{
            message: {
              content: JSON.stringify({
                findings: [],
                ai_likelihood: 0.85,
                ai_reasoning: 'Code appears to be AI-generated based on patterns'
              })
            }
          }],
          usage: { total_tokens: 100 }
        }),
        headers: new Map()
      } as any);

      const result = await provider.review('test', 5000);

      expect(result.aiLikelihood).toBe(0.85);
      expect(result.aiReasoning).toBe('Code appears to be AI-generated based on patterns');
    });

    it('should track duration correctly', async () => {
      const provider = new OpenRouterProvider('test-model', apiKey, limiter);

      global.fetch = jest.fn().mockImplementation(() => {
        return new Promise(resolve => {
          setTimeout(() => {
            resolve({
              ok: true,
              status: 200,
              json: async () => ({
                choices: [{ message: { content: '[]' } }],
                usage: { total_tokens: 10 }
              }),
              headers: new Map()
            });
          }, 100);
        });
      });

      const result = await provider.review('test', 5000);

      expect(result.durationSeconds).toBeGreaterThan(0.05);
      expect(result.durationSeconds).toBeLessThan(1);
    });
  });

  describe('Rate Limiting', () => {
    it('should throw RateLimitError when rate limited', async () => {
      const provider = new OpenRouterProvider('test-model', apiKey, limiter);

      global.fetch = jest.fn().mockResolvedValue({
        ok: false,
        status: 429,
        statusText: 'Too Many Requests',
        headers: {
          get: (name: string) => name === 'retry-after' ? '120' : null
        }
      } as any);

      await expect(provider.review('test', 5000)).rejects.toThrow(RateLimitError);
    });

    it('should respect rate limit before making request', async () => {
      const provider = new OpenRouterProvider('test-model', apiKey, limiter);
      const fetchSpy = jest.fn();
      global.fetch = fetchSpy;

      // Mark as rate limited
      await limiter.markRateLimited('openrouter/test-model', 1, 'Test');

      // Should throw immediately without calling fetch
      await expect(provider.review('test', 5000)).rejects.toThrow(RateLimitError);
      expect(fetchSpy).not.toHaveBeenCalled();
    });

    it('should handle retry-after header correctly', async () => {
      const provider = new OpenRouterProvider('test-model', apiKey, limiter);

      global.fetch = jest.fn().mockResolvedValue({
        ok: false,
        status: 429,
        headers: {
          get: (name: string) => name === 'retry-after' ? '300' : null
        }
      } as any);

      try {
        await provider.review('test', 5000);
        fail('Should have thrown');
      } catch (error) {
        expect(error).toBeInstanceOf(RateLimitError);
        // retry-after header is in seconds, converted to minutes for rate limiter
        // Error retryAfterSeconds is minutes * 60 = seconds * 60 (converted back)
        expect((error as RateLimitError).retryAfterSeconds).toBe(300);
      }
    });

    it('should use default retry-after when header is missing', async () => {
      const provider = new OpenRouterProvider('test-model', apiKey, limiter);

      global.fetch = jest.fn().mockResolvedValue({
        ok: false,
        status: 429,
        headers: {
          get: () => null
        }
      } as any);

      try {
        await provider.review('test', 5000);
        fail('Should have thrown');
      } catch (error) {
        expect(error).toBeInstanceOf(RateLimitError);
        expect((error as RateLimitError).retryAfterSeconds).toBe(60 * 60); // 60 minutes default
      }
    });
  });

  describe('Error Handling', () => {
    it('should handle non-200 HTTP errors', async () => {
      const provider = new OpenRouterProvider('test-model', apiKey, limiter);

      global.fetch = jest.fn().mockResolvedValue({
        ok: false,
        status: 500,
        statusText: 'Internal Server Error',
        headers: new Map()
      } as any);

      await expect(provider.review('test', 5000)).rejects.toThrow('OpenRouter API error: 500');
    });

    it('should handle invalid JSON response', async () => {
      const provider = new OpenRouterProvider('test-model', apiKey, limiter);

      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({ choices: [{ message: { content: 'not valid json' } }] }),
        headers: new Map()
      } as any);

      const result = await provider.review('test', 5000);

      // Should return empty findings array on parse error
      expect(result.findings).toEqual([]);
    });

    it('should handle missing choices in response', async () => {
      const provider = new OpenRouterProvider('test-model', apiKey, limiter);

      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({}),
        headers: new Map()
      } as any);

      const result = await provider.review('test', 5000);

      expect(result.content).toBe('');
      expect(result.findings).toEqual([]);
    });

    it('should handle timeout with AbortController', async () => {
      const provider = new OpenRouterProvider('test-model', apiKey, limiter);

      global.fetch = jest.fn().mockImplementation((url, options) => {
        return new Promise((resolve, reject) => {
          // Simulate very slow response (longer than the test timeout)
          const timeout = setTimeout(() => {
            if (options.signal?.aborted) {
              const error = new Error('The operation was aborted');
              error.name = 'AbortError';
              reject(error);
            } else {
              resolve({
                ok: true,
                json: async () => ({ choices: [{ message: { content: '[]' } }] }),
                headers: new Map()
              });
            }
          }, 5000); // 5 seconds - much longer than 2s timeout

          // Listen for abort
          if (options.signal) {
            options.signal.addEventListener('abort', () => {
              clearTimeout(timeout);
              const error = new Error('The operation was aborted');
              error.name = 'AbortError';
              reject(error);
            });
          }
        });
      });

      // Set timeout (2s) - should abort before 5s mock response
      // Using longer timeout to avoid flakiness in slow CI environments
      await expect(provider.review('test', 2000)).rejects.toThrow();
    });

    it('should handle network errors', async () => {
      const provider = new OpenRouterProvider('test-model', apiKey, limiter);

      global.fetch = jest.fn().mockRejectedValue(new Error('Network error'));

      await expect(provider.review('test', 5000)).rejects.toThrow('Network error');
    });
  });

  describe('Request Construction', () => {
    it('should send correct headers and model', async () => {
      const provider = new OpenRouterProvider('test-model', apiKey, limiter);
      let capturedRequest: any;

      global.fetch = jest.fn().mockImplementation((url, options) => {
        capturedRequest = options;
        return Promise.resolve({
          ok: true,
          status: 200,
          json: async () => ({
            choices: [{ message: { content: '[]' } }],
            usage: { total_tokens: 10 }
          }),
          headers: new Map()
        });
      });

      await provider.review('test prompt', 5000);

      expect(capturedRequest.method).toBe('POST');
      expect(capturedRequest.headers['Authorization']).toBe('Bearer test-api-key');
      expect(capturedRequest.headers['Content-Type']).toBe('application/json');
      expect(capturedRequest.headers['HTTP-Referer']).toContain('multi-provider-code-review');

      const body = JSON.parse(capturedRequest.body);
      expect(body.model).toBe('test-model');
      expect(body.messages[0].content).toBe('test prompt');
      expect(body.temperature).toBe(0.1);
      expect(body.max_tokens).toBe(2000);
    });
  });

  describe('Retry Logic', () => {
    it('should retry on transient errors', async () => {
      const provider = new OpenRouterProvider('test-model', apiKey, limiter);
      let callCount = 0;

      global.fetch = jest.fn().mockImplementation(() => {
        callCount++;
        if (callCount === 1) {
          return Promise.reject(new Error('Transient error'));
        }
        return Promise.resolve({
          ok: true,
          status: 200,
          json: async () => ({
            choices: [{ message: { content: '[]' } }],
            usage: { total_tokens: 10 }
          }),
          headers: new Map()
        });
      });

      const result = await provider.review('test', 5000);

      expect(callCount).toBe(2);
      expect(result.findings).toEqual([]);
    });

    it('should not retry on rate limit errors', async () => {
      const provider = new OpenRouterProvider('test-model', apiKey, limiter);
      let callCount = 0;

      global.fetch = jest.fn().mockImplementation(() => {
        callCount++;
        return Promise.resolve({
          ok: false,
          status: 429,
          headers: { get: () => '60' }
        });
      });

      await expect(provider.review('test', 5000)).rejects.toThrow(RateLimitError);

      // Should only call once (no retry on rate limit)
      expect(callCount).toBe(1);
    });

    it('should not retry on abort errors', async () => {
      const provider = new OpenRouterProvider('test-model', apiKey, limiter);
      let callCount = 0;

      global.fetch = jest.fn().mockImplementation(() => {
        callCount++;
        const error = new Error('Request aborted');
        error.name = 'AbortError';
        return Promise.reject(error);
      });

      await expect(provider.review('test', 100)).rejects.toThrow();

      // Should only call once (no retry on abort)
      expect(callCount).toBe(1);
    });
  });
});
