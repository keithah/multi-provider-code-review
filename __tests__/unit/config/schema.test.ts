import { validateConfig } from '../../../src/config/schema';
import { DEFAULT_CONFIG } from '../../../src/config/defaults';

describe('Config Schema', () => {
  it('should validate default config', () => {
    expect(() => validateConfig(DEFAULT_CONFIG)).not.toThrow();
  });

  it('should reject invalid provider format', () => {
    const invalid = { ...DEFAULT_CONFIG, providers: 'not-an-array' as any };
    expect(() => validateConfig(invalid)).toThrow();
  });

  it('should reject negative budget', () => {
    const invalid = { ...DEFAULT_CONFIG, budgetMaxUsd: -1 };
    expect(() => validateConfig(invalid)).toThrow();
  });

  it('should accept valid provider list', () => {
    const valid = { ...DEFAULT_CONFIG, providers: ['openrouter/test:free'] };
    expect(() => validateConfig(valid)).not.toThrow();
  });
});
