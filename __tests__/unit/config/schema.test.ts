import { validateConfig } from '../../../src/utils/validation';
import { DEFAULT_CONFIG } from '../../../src/config/defaults';

describe('Config Schema', () => {
  it('should validate default config', () => {
    expect(() => validateConfig(DEFAULT_CONFIG as unknown as Record<string, unknown>)).not.toThrow();
  });

  it('should reject invalid provider format', () => {
    const invalid = { ...DEFAULT_CONFIG, providers: 'not-an-array' as any };
    expect(() => validateConfig(invalid as unknown as Record<string, unknown>)).toThrow();
  });

  it('should reject negative budget', () => {
    const invalid = { ...DEFAULT_CONFIG, budgetMaxUsd: -1 };
    expect(() => validateConfig(invalid as unknown as Record<string, unknown>)).toThrow();
  });

  it('should accept valid provider list', () => {
    const valid = { ...DEFAULT_CONFIG, providers: ['openrouter/test:free'] };
    expect(() => validateConfig(valid as unknown as Record<string, unknown>)).not.toThrow();
  });
});
