import { Provider } from '../../../src/providers/base';
import { ClaudeCodeProvider } from '../../../src/providers/claude-code';
import { CodexProvider } from '../../../src/providers/codex';
import { GeminiProvider } from '../../../src/providers/gemini';

describe('New CLI Providers', () => {
  describe('Provider Name Validation', () => {
    it('should validate claude/ provider names', () => {
      expect(Provider.validate('claude/sonnet')).toBe(true);
      expect(Provider.validate('claude/opus')).toBe(true);
      expect(Provider.validate('claude/haiku')).toBe(true);
      expect(Provider.validate('claude/')).toBe(false);
    });

    it('should validate codex/ provider names', () => {
      expect(Provider.validate('codex/gpt-5.1-codex-max')).toBe(true);
      expect(Provider.validate('codex/gpt-5.1-codex')).toBe(true);
      expect(Provider.validate('codex/')).toBe(false);
    });

    it('should validate gemini/ provider names', () => {
      expect(Provider.validate('gemini/gemini-2.0-flash')).toBe(true);
      expect(Provider.validate('gemini/gemini-1.5-pro')).toBe(true);
      expect(Provider.validate('gemini/')).toBe(false);
    });

    it('should still validate existing provider patterns', () => {
      expect(Provider.validate('openrouter/google/gemini-2.0-flash-exp:free')).toBe(true);
      expect(Provider.validate('opencode/minimax-m2.1-free')).toBe(true);
    });

    it('should reject invalid provider patterns', () => {
      expect(Provider.validate('invalid/provider')).toBe(false);
      expect(Provider.validate('/claude')).toBe(false);
      expect(Provider.validate('unknown/test')).toBe(false);
    });
  });

  describe('ClaudeCodeProvider', () => {
    it('should create provider with correct name format', () => {
      const provider = new ClaudeCodeProvider('sonnet');
      expect(provider.name).toBe('claude/sonnet');
    });

    it('should create provider for different models', () => {
      const sonnet = new ClaudeCodeProvider('sonnet');
      const opus = new ClaudeCodeProvider('opus');
      const haiku = new ClaudeCodeProvider('haiku');

      expect(sonnet.name).toBe('claude/sonnet');
      expect(opus.name).toBe('claude/opus');
      expect(haiku.name).toBe('claude/haiku');
    });
  });

  describe('CodexProvider', () => {
    it('should create provider with correct name format', () => {
      const provider = new CodexProvider('gpt-5.1-codex-max');
      expect(provider.name).toBe('codex/gpt-5.1-codex-max');
    });

    it('should create provider for different models', () => {
      const maxModel = new CodexProvider('gpt-5.1-codex-max');
      const standardModel = new CodexProvider('gpt-5.1-codex');

      expect(maxModel.name).toBe('codex/gpt-5.1-codex-max');
      expect(standardModel.name).toBe('codex/gpt-5.1-codex');
    });
  });

  describe('GeminiProvider', () => {
    it('should create provider with correct name format', () => {
      const provider = new GeminiProvider('gemini-2.0-flash');
      expect(provider.name).toBe('gemini/gemini-2.0-flash');
    });

    it('should create provider for different models', () => {
      const flash = new GeminiProvider('gemini-2.0-flash');
      const pro = new GeminiProvider('gemini-1.5-pro');

      expect(flash.name).toBe('gemini/gemini-2.0-flash');
      expect(pro.name).toBe('gemini/gemini-1.5-pro');
    });
  });
});
