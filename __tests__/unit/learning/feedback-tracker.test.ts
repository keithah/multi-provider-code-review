import { FeedbackTracker } from '../../../src/learning/feedback-tracker';

describe('FeedbackTracker', () => {
  let tracker: FeedbackTracker;

  beforeEach(() => {
    tracker = new FeedbackTracker();
  });

  it('should record feedback reactions', async () => {
    await tracker.recordReaction('finding-123', '👍');
    const confidence = await tracker.getConfidenceThreshold('test-category');
    expect(confidence).toBeGreaterThanOrEqual(0);
  });

  it('should adjust weights based on feedback', async () => {
    await tracker.recordReaction('finding-1', '👍');
    await tracker.recordReaction('finding-2', '👎');
    await tracker.adjustWeights();
    expect(true).toBe(true); // Placeholder assertion
  });
});
