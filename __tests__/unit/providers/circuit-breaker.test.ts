import { CircuitBreaker } from '../../../src/providers/circuit-breaker';

class MemoryStorage {
  private store = new Map<string, string>();
  async read(key: string): Promise<string | null> {
    return this.store.get(key) ?? null;
  }
  async write(key: string, value: string): Promise<void> {
    this.store.set(key, value);
  }
}

describe('CircuitBreaker', () => {
  jest.useFakeTimers();

  it('opens after threshold failures and resets after cooldown', async () => {
    const storage = new MemoryStorage();
    const breaker = new CircuitBreaker(storage as any, { failureThreshold: 2, openDurationMs: 1000 });
    const id = 'openrouter/test';

    await breaker.recordFailure(id);
    expect(await breaker.isOpen(id)).toBe(false);

    await breaker.recordFailure(id);
    expect(await breaker.isOpen(id)).toBe(true);

    // advance time to allow half-open
    jest.advanceTimersByTime(1001);
    expect(await breaker.isOpen(id)).toBe(false);

    await breaker.recordSuccess(id);
    expect(await breaker.isOpen(id)).toBe(false);
  });

  it('resets failures on success', async () => {
    const storage = new MemoryStorage();
    const breaker = new CircuitBreaker(storage as any, { failureThreshold: 3, openDurationMs: 1000 });
    const id = 'opencode/model';

    await breaker.recordFailure(id);
    await breaker.recordSuccess(id);
    expect(await breaker.isOpen(id)).toBe(false);

    await breaker.recordFailure(id);
    await breaker.recordFailure(id);
    expect(await breaker.isOpen(id)).toBe(false); // threshold not reached yet
  });
});
