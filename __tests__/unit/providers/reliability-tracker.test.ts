import { ReliabilityTracker } from '../../../src/providers/reliability-tracker';
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

describe('ReliabilityTracker with CircuitBreaker', () => {
  it('opens circuit after consecutive failures', async () => {
    const storage = new MemoryStorage();
    const circuit = new CircuitBreaker(storage as any, { failureThreshold: 2, openDurationMs: 1000 });
    const tracker = new ReliabilityTracker(storage as any, 1, circuit);
    const id = 'openrouter/model';

    await tracker.recordResult(id, false, 100, 'timeout');
    await tracker.recordResult(id, false, 120, 'timeout');

    expect(await circuit.isOpen(id)).toBe(true);
  });

  it('closes circuit after a subsequent success', async () => {
    const storage = new MemoryStorage();
    const circuit = new CircuitBreaker(storage as any, { failureThreshold: 2, openDurationMs: 1000 });
    const tracker = new ReliabilityTracker(storage as any, 1, circuit);
    const id = 'opencode/fast';

    await tracker.recordResult(id, false);
    await tracker.recordResult(id, false);
    expect(await circuit.isOpen(id)).toBe(true);

    await tracker.recordResult(id, true);
    expect(await circuit.isOpen(id)).toBe(false);
  });
});
