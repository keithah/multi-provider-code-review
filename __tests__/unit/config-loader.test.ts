import { ConfigLoader } from '../../src/config/loader';
import { DEFAULT_CONFIG } from '../../src/config/defaults';

describe('ConfigLoader', () => {
  const originalEnv = { ...process.env };

  afterEach(() => {
    process.env = { ...originalEnv };
  });

  it('merges environment overrides into defaults', () => {
    process.env.REVIEW_PROVIDERS = 'openrouter/a,opencode/b';
    process.env.INLINE_MAX_COMMENTS = '7';
    process.env.BUDGET_MAX_USD = '1.5';
    process.env.ENABLE_AST_ANALYSIS = 'false';

    const config = ConfigLoader.load();

    expect(config.providers).toEqual(['openrouter/a', 'opencode/b']);
    expect(config.inlineMaxComments).toBe(7);
    expect(config.budgetMaxUsd).toBe(1.5);
    expect(config.enableAstAnalysis).toBe(false);
    expect(config.inlineMinSeverity).toBe(DEFAULT_CONFIG.inlineMinSeverity);
  });
});
