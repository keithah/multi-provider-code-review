import { validateProvider, validateProviders } from '../../../scripts/validate-providers';

describe('validateProvider', () => {
  describe('valid providers', () => {
    const validProviders = [
      'openrouter/google/gemini-2.0-flash-exp:free',
      'openrouter/mistralai/devstral-2512:free',
      'opencode/gpt-4:free',
      'openai/gpt-4',
      'anthropic/claude-3-5-sonnet',
      'cohere/command',
      'mistral/mistral-large',
      'groq/llama-3.1-70b',
      'openrouter/vendor/model',
      'openrouter/vendor/model:tag',
      'openrouter/a/b/c/d:e',
    ];

    test.each(validProviders)('should validate %s', (provider) => {
      const result = validateProvider(provider);
      expect(result.valid).toBe(true);
      expect(result.error).toBeUndefined();
    });
  });

  describe('invalid providers', () => {
    const invalidProviders = [
      '',
      '   ',
      'invalid',
      'openrouter/',
      '/model',
      'openrouter//model',
      'unknown-provider/model',
      'openrouter/model with spaces',
      'openrouter/model\nwith\nnewlines',
    ];

    test.each(invalidProviders)('should reject %s', (provider) => {
      const result = validateProvider(provider);
      expect(result.valid).toBe(false);
      expect(result.error).toBeDefined();
    });
  });
});

describe('validateProviders', () => {
  // Mock console methods
  let consoleLogSpy: jest.SpyInstance;
  let consoleErrorSpy: jest.SpyInstance;

  beforeEach(() => {
    consoleLogSpy = jest.spyOn(console, 'log').mockImplementation();
    consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();
  });

  afterEach(() => {
    consoleLogSpy.mockRestore();
    consoleErrorSpy.mockRestore();
  });

  test('should validate empty string', () => {
    const result = validateProviders('');
    expect(result).toBe(true);
    expect(consoleLogSpy).toHaveBeenCalledWith(expect.stringContaining('No providers specified'));
  });

  test('should validate single valid provider', () => {
    const result = validateProviders('openai/gpt-4');
    expect(result).toBe(true);
    expect(consoleLogSpy).toHaveBeenCalledWith(expect.stringContaining('✅'));
  });

  test('should validate multiple valid providers', () => {
    const result = validateProviders('openai/gpt-4,anthropic/claude-3-5-sonnet');
    expect(result).toBe(true);
    expect(consoleLogSpy).toHaveBeenCalledWith(expect.stringContaining('2 providers validated'));
  });

  test('should reject invalid provider in list', () => {
    const result = validateProviders('openai/gpt-4,invalid-provider');
    expect(result).toBe(false);
    expect(consoleErrorSpy).toHaveBeenCalled();
  });

  test('should handle providers with whitespace', () => {
    const result = validateProviders(' openai/gpt-4 , anthropic/claude-3-5-sonnet ');
    expect(result).toBe(true);
  });
});
