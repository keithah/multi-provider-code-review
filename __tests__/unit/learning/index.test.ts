import * as learning from '../../../src/learning';

describe('Learning Module', () => {
  it('should export required components', () => {
    expect(learning).toBeDefined();
    expect(learning.FeedbackTracker).toBeDefined();
    expect(learning.QuietModeFilter).toBeDefined();
  });
});
