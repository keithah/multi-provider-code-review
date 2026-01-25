// Mock p-queue (ESM) with a simple synchronous queue for Jest environment
jest.mock('p-queue', () => {
  return {
    __esModule: true,
    default: class {
      constructor(public opts: any = {}) {}
      add<T>(fn: () => Promise<T>): Promise<T> { return fn(); }
      onIdle(): Promise<void> { return Promise.resolve(); }
    },
  };
});

// Mock p-retry to run the function once without retrying
jest.mock('p-retry', () => {
  class FailedAttemptError extends Error {
    attemptNumber = 1;
  }
  return {
    __esModule: true,
    default: async (fn: any) => fn(),
    FailedAttemptError,
  };
});

// Some code paths (e.g., @actions/core.setFailed) set process.exitCode to 1.
// Reset it after the test suite so Jest exits cleanly when all tests pass.
afterAll(() => {
  process.exitCode = 0;
});
