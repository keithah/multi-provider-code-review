import { GitHubRateLimitTracker } from '../../../src/github/rate-limit';

describe('GitHubRateLimitTracker', () => {
  let tracker: GitHubRateLimitTracker;

  beforeEach(() => {
    tracker = new GitHubRateLimitTracker();
  });

  describe('updateFromHeaders', () => {
    it('should update status from valid headers', () => {
      const headers = {
        'x-ratelimit-limit': '5000',
        'x-ratelimit-remaining': '4500',
        'x-ratelimit-reset': '1234567890',
        'x-ratelimit-used': '500',
      };

      tracker.updateFromHeaders(headers);

      const status = tracker.getStatus();
      expect(status).not.toBeNull();
      expect(status?.limit).toBe(5000);
      expect(status?.remaining).toBe(4500);
      expect(status?.reset).toBe(1234567890);
      expect(status?.used).toBe(500);
    });

    it('should handle missing used header', () => {
      const headers = {
        'x-ratelimit-limit': '5000',
        'x-ratelimit-remaining': '4500',
        'x-ratelimit-reset': '1234567890',
      };

      tracker.updateFromHeaders(headers);

      const status = tracker.getStatus();
      expect(status?.used).toBe(0);
    });

    it('should not update with incomplete headers', () => {
      const headers = {
        'x-ratelimit-limit': '5000',
        // Missing remaining and reset
      };

      tracker.updateFromHeaders(headers);

      expect(tracker.getStatus()).toBeNull();
    });
  });

  describe('isApproachingLimit', () => {
    it('should return true when below 10% remaining', () => {
      tracker.updateFromHeaders({
        'x-ratelimit-limit': '5000',
        'x-ratelimit-remaining': '400', // 8%
        'x-ratelimit-reset': '1234567890',
      });

      expect(tracker.isApproachingLimit()).toBe(true);
    });

    it('should return false when above 10% remaining', () => {
      tracker.updateFromHeaders({
        'x-ratelimit-limit': '5000',
        'x-ratelimit-remaining': '1000', // 20%
        'x-ratelimit-reset': '1234567890',
      });

      expect(tracker.isApproachingLimit()).toBe(false);
    });

    it('should return false when no status available', () => {
      expect(tracker.isApproachingLimit()).toBe(false);
    });
  });

  describe('isExceeded', () => {
    it('should return true when remaining is 0', () => {
      tracker.updateFromHeaders({
        'x-ratelimit-limit': '5000',
        'x-ratelimit-remaining': '0',
        'x-ratelimit-reset': '1234567890',
      });

      expect(tracker.isExceeded()).toBe(true);
    });

    it('should return false when remaining > 0', () => {
      tracker.updateFromHeaders({
        'x-ratelimit-limit': '5000',
        'x-ratelimit-remaining': '100',
        'x-ratelimit-reset': '1234567890',
      });

      expect(tracker.isExceeded()).toBe(false);
    });

    it('should return false when no status available', () => {
      expect(tracker.isExceeded()).toBe(false);
    });
  });

  describe('getWaitTimeMs', () => {
    it('should calculate wait time correctly', () => {
      const futureReset = Math.floor(Date.now() / 1000) + 3600; // 1 hour from now

      tracker.updateFromHeaders({
        'x-ratelimit-limit': '5000',
        'x-ratelimit-remaining': '0',
        'x-ratelimit-reset': futureReset.toString(),
      });

      const waitTime = tracker.getWaitTimeMs();
      expect(waitTime).toBeGreaterThan(3500000); // ~58 minutes (allowing for test execution time)
      expect(waitTime).toBeLessThan(3700000); // ~62 minutes
    });

    it('should return 0 when reset time has passed', () => {
      const pastReset = Math.floor(Date.now() / 1000) - 3600; // 1 hour ago

      tracker.updateFromHeaders({
        'x-ratelimit-limit': '5000',
        'x-ratelimit-remaining': '0',
        'x-ratelimit-reset': pastReset.toString(),
      });

      expect(tracker.getWaitTimeMs()).toBe(0);
    });

    it('should return 0 when no status available', () => {
      expect(tracker.getWaitTimeMs()).toBe(0);
    });
  });

  describe('waitForReset', () => {
    it('should not wait when limit not exceeded', async () => {
      tracker.updateFromHeaders({
        'x-ratelimit-limit': '5000',
        'x-ratelimit-remaining': '100',
        'x-ratelimit-reset': '1234567890',
      });

      const start = Date.now();
      await tracker.waitForReset();
      const elapsed = Date.now() - start;

      expect(elapsed).toBeLessThan(100); // Should return immediately
    });

    it('should not wait when no status available', async () => {
      const start = Date.now();
      await tracker.waitForReset();
      const elapsed = Date.now() - start;

      expect(elapsed).toBeLessThan(100); // Should return immediately
    });

    // Note: Testing actual waiting would make tests slow
    // We rely on getWaitTimeMs being tested separately
  });

  describe('getStatus', () => {
    it('should return null initially', () => {
      expect(tracker.getStatus()).toBeNull();
    });

    it('should return status after update', () => {
      const headers = {
        'x-ratelimit-limit': '5000',
        'x-ratelimit-remaining': '4500',
        'x-ratelimit-reset': '1234567890',
      };

      tracker.updateFromHeaders(headers);

      const status = tracker.getStatus();
      expect(status).not.toBeNull();
      expect(status?.limit).toBe(5000);
    });
  });
});
