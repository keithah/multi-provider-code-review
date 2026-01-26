import { CircuitBreaker } from '../../../src/providers/circuit-breaker';
import { encodeURIComponentSafe } from '../../../src/utils/sanitize';
import { MemoryStorage } from '../../helpers/memory-storage';

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

  it('re-opens immediately on failure while half-open', async () => {
    const storage = new MemoryStorage();
    const breaker = new CircuitBreaker(storage as any, { failureThreshold: 2, openDurationMs: 1000 });
    const id = 'openrouter/test';

    await breaker.recordFailure(id);
    await breaker.recordFailure(id);
    expect(await breaker.isOpen(id)).toBe(true);

    jest.advanceTimersByTime(1001); // move to half-open
    expect(await breaker.isOpen(id)).toBe(false);

    await breaker.recordFailure(id); // first attempt in half-open
    expect(await breaker.isOpen(id)).toBe(true); // should re-open immediately
  });

  it('allows only a single probe in half-open state', async () => {
    const storage = new MemoryStorage();
    const breaker = new CircuitBreaker(storage as any, { failureThreshold: 1, openDurationMs: 1 });
    const id = 'probe/provider';

    // Trip the circuit immediately
    await breaker.recordFailure(id);
    expect(await breaker.isOpen(id)).toBe(true);

    // Move to half-open
    jest.advanceTimersByTime(2);

    // First caller reserves the probe (returns false => allow)
    const first = await breaker.isOpen(id);
    // Second caller should see probeInFlight and be blocked
    const second = await breaker.isOpen(id);

    expect(first).toBe(false);
    expect(second).toBe(true);
  });

  it('serializes concurrent updates without losing failures', async () => {
    const storage = new MemoryStorage();
    const breaker = new CircuitBreaker(storage as any, { failureThreshold: 10 });
    const id = 'race/provider';
    const key = `circuit-breaker-${encodeURIComponentSafe(id)}`;

    await Promise.all(Array.from({ length: 5 }).map(() => breaker.recordFailure(id)));
    const state = JSON.parse((await storage.read(key)) as string);
    expect(state.failures).toBe(5);
  });

  it('sanitizes provider ids when writing state', async () => {
    const storage = new MemoryStorage();
    const breaker = new CircuitBreaker(storage as any);
    const id = '../openrouter/foo.bar';

    await breaker.recordFailure(id);

    const keys = storage.keys();
    expect(keys).toHaveLength(1);
    expect(keys[0]).toMatch(/^circuit-breaker-/);
    expect(keys[0]).not.toMatch(/[\\/]{2,}/);
  });

  it('clears internal locks after operations to avoid leaks', async () => {
    const storage = new MemoryStorage();
    const breaker = new CircuitBreaker(storage as any, { failureThreshold: 5 });
    const id = 'locks/provider';

    await Promise.all([
      breaker.recordFailure(id),
      breaker.recordFailure(id),
      breaker.recordSuccess(id),
    ]);

    expect((breaker as any).locks.size).toBe(0);
  });
});
