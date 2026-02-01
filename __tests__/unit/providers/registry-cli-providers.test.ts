import { ProviderRegistry } from '../../../src/providers/registry';
import { ClaudeCodeProvider } from '../../../src/providers/claude-code';
import { CodexProvider } from '../../../src/providers/codex';
import { GeminiProvider } from '../../../src/providers/gemini';
import { ReviewConfig } from '../../../src/types';
import { DEFAULT_CONFIG } from '../../../src/config/defaults';

describe('ProviderRegistry - New CLI Providers', () => {
  let registry: ProviderRegistry;

  beforeEach(() => {
    registry = new ProviderRegistry();
  });

  describe('Provider Instantiation', () => {
    it('should instantiate Claude Code providers', async () => {
      const config: ReviewConfig = {
        ...DEFAULT_CONFIG,
        providers: ['claude/sonnet', 'claude/opus'],
      };

      // Use the private instantiate method via reflection
      const providers = (registry as any).instantiate(config.providers, config);

      expect(providers).toHaveLength(2);
      expect(providers[0]).toBeInstanceOf(ClaudeCodeProvider);
      expect(providers[0].name).toBe('claude/sonnet');
      expect(providers[1]).toBeInstanceOf(ClaudeCodeProvider);
      expect(providers[1].name).toBe('claude/opus');
    });

    it('should instantiate Codex providers', async () => {
      const config: ReviewConfig = {
        ...DEFAULT_CONFIG,
        providers: ['codex/gpt-5.1-codex-max'],
      };

      const providers = (registry as any).instantiate(config.providers, config);

      expect(providers).toHaveLength(1);
      expect(providers[0]).toBeInstanceOf(CodexProvider);
      expect(providers[0].name).toBe('codex/gpt-5.1-codex-max');
    });

    it('should instantiate Gemini providers', async () => {
      const config: ReviewConfig = {
        ...DEFAULT_CONFIG,
        providers: ['gemini/gemini-2.0-flash', 'gemini/gemini-1.5-pro'],
      };

      const providers = (registry as any).instantiate(config.providers, config);

      expect(providers).toHaveLength(2);
      expect(providers[0]).toBeInstanceOf(GeminiProvider);
      expect(providers[0].name).toBe('gemini/gemini-2.0-flash');
      expect(providers[1]).toBeInstanceOf(GeminiProvider);
      expect(providers[1].name).toBe('gemini/gemini-1.5-pro');
    });

    it('should instantiate mixed provider types', async () => {
      const config: ReviewConfig = {
        ...DEFAULT_CONFIG,
        providers: [
          'claude/sonnet',
          'codex/gpt-5.1-codex-max',
          'gemini/gemini-2.0-flash',
        ],
      };

      const providers = (registry as any).instantiate(config.providers, config);

      expect(providers).toHaveLength(3);
      expect(providers[0]).toBeInstanceOf(ClaudeCodeProvider);
      expect(providers[1]).toBeInstanceOf(CodexProvider);
      expect(providers[2]).toBeInstanceOf(GeminiProvider);
    });

    it('should skip invalid provider names', async () => {
      const config: ReviewConfig = {
        ...DEFAULT_CONFIG,
        providers: [
          'claude/sonnet',
          'invalid/provider',
          'gemini/gemini-2.0-flash',
        ],
      };

      const providers = (registry as any).instantiate(config.providers, config);

      // Only valid providers should be instantiated
      expect(providers).toHaveLength(2);
      expect(providers[0].name).toBe('claude/sonnet');
      expect(providers[1].name).toBe('gemini/gemini-2.0-flash');
    });
  });
});
