// Placeholder test for learning module exports
describe('Learning Module', () => {
  it('should export required components', () => {
    const learning = require('../../../src/learning');
    expect(learning).toBeDefined();
  });
});
