import { DEFAULT_CONFIG } from '../../../src/config/defaults';

describe('DEFAULT_CONFIG', () => {
  it('should have valid default providers', () => {
    expect(Array.isArray(DEFAULT_CONFIG.providers)).toBe(true);
  });

  it('should have valid default thresholds', () => {
    expect(DEFAULT_CONFIG.inlineMinSeverity).toBe('major');
    expect(DEFAULT_CONFIG.inlineMinAgreement).toBeGreaterThan(0);
  });

  it('should enable core features by default', () => {
    expect(DEFAULT_CONFIG.enableAstAnalysis).toBe(true);
    expect(DEFAULT_CONFIG.enableSecurity).toBe(true);
  });

  it('should have reasonable timeout and budget limits', () => {
    expect(DEFAULT_CONFIG.runTimeoutSeconds).toBeGreaterThan(0);
    expect(DEFAULT_CONFIG.budgetMaxUsd).toBeGreaterThanOrEqual(0);
  });
});
