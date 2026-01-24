import * as analytics from '../../../src/analytics';

describe('Analytics Module', () => {
  it('should export required components', () => {
    expect(analytics).toBeDefined();
    expect(analytics.MetricsCollector).toBeDefined();
    expect(analytics.DashboardGenerator).toBeDefined();
  });

  it('should export types', () => {
    // Types are compile-time only, verify exports exist
    expect(typeof analytics.MetricsCollector).toBe('function');
    expect(typeof analytics.DashboardGenerator).toBe('function');
  });
});
