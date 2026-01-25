import { CacheStorage } from '../cache/storage';
import { logger } from '../utils/logger';
import { encodeURIComponentSafe } from '../utils/sanitize';

type CircuitState = 'closed' | 'open' | 'half_open';

interface CircuitData {
  state: CircuitState;
  failures: number;
  openedAt?: number;
}

export interface CircuitBreakerOptions {
  failureThreshold?: number;
  openDurationMs?: number;
}

/**
 * Simple circuit breaker to stop hammering unreliable providers.
 * - After N consecutive failures -> open for a cooldown window
 * - After cooldown -> half-open (allow one attempt)
 * - On success -> close and reset counters
 */
export class CircuitBreaker {
  private readonly failureThreshold: number;
  private readonly openDurationMs: number;
  private readonly locks = new Map<string, Promise<void>>();

  constructor(
    private readonly storage = new CacheStorage(),
    options: CircuitBreakerOptions = {}
  ) {
    this.failureThreshold = options.failureThreshold ?? 3;
    this.openDurationMs = options.openDurationMs ?? 5 * 60 * 1000; // 5 minutes
  }

  async isOpen(providerId: string): Promise<boolean> {
    return this.withLock(providerId, async () => {
      const state = await this.load(providerId);

      if (state.state === 'open') {
        const expired = state.openedAt && Date.now() - state.openedAt > this.openDurationMs;
        if (expired) {
          await this.setState(providerId, { state: 'half_open', failures: 0 });
          return false;
        }
        return true;
      }

      return false;
    });
  }

  async recordSuccess(providerId: string): Promise<void> {
    await this.withLock(providerId, () => this.setState(providerId, { state: 'closed', failures: 0 }));
  }

  async recordFailure(providerId: string): Promise<void> {
    await this.withLock(providerId, async () => {
      const state = await this.load(providerId);
      const failures = state.failures + 1;

      if (state.state === 'half_open') {
        await this.setState(providerId, { state: 'open', failures, openedAt: Date.now() });
        logger.warn(`Circuit re-opened for ${providerId} after half-open failure`);
        return;
      }

      if (failures >= this.failureThreshold) {
        await this.setState(providerId, { state: 'open', failures, openedAt: Date.now() });
        logger.warn(`Circuit opened for ${providerId} after ${failures} failures`);
      } else {
        await this.setState(providerId, { state: 'closed', failures });
      }
    });
  }

  private async load(providerId: string): Promise<CircuitData> {
    const raw = await this.storage.read(this.key(providerId));
    if (!raw) {
      return { state: 'closed', failures: 0 };
    }

    try {
      return JSON.parse(raw) as CircuitData;
    } catch (error) {
      logger.warn(`Failed to parse circuit state for ${providerId}`, error as Error);
      return { state: 'closed', failures: 0 };
    }
  }

  private async setState(providerId: string, state: CircuitData): Promise<void> {
    await this.storage.write(this.key(providerId), JSON.stringify(state));
  }

  private key(providerId: string): string {
    const sanitized = encodeURIComponentSafe(providerId).replace(/\./g, '_');
    return `circuit-breaker-${sanitized}`;
  }

  private async withLock<T>(providerId: string, fn: () => Promise<T>): Promise<T> {
    const prev = this.locks.get(providerId) ?? Promise.resolve();
    let release!: () => void;
    const current = new Promise<void>(resolve => (release = resolve));
    this.locks.set(providerId, prev.then(() => current));

    await prev;
    try {
      return await fn();
    } finally {
      release();
      if (this.locks.get(providerId) === current) {
        this.locks.delete(providerId);
      }
    }
  }
}
