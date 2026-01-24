import * as autofix from '../../../src/autofix';

describe('Autofix Module', () => {
  it('should export required components', () => {
    expect(autofix).toBeDefined();
    expect(autofix.PromptGenerator).toBeDefined();
  });

  it('should export PromptGenerator class', () => {
    expect(typeof autofix.PromptGenerator).toBe('function');
    const generator = new autofix.PromptGenerator();
    expect(generator).toBeDefined();
  });
});
