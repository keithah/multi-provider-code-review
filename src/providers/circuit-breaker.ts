import { CacheStorage } from '../cache/storage';
import { logger } from '../utils/logger';
import { encodeURIComponentSafe } from '../utils/sanitize';

type CircuitState = 'closed' | 'open' | 'half_open';

interface CircuitData {
  state: CircuitState;
  failures: number;
  openedAt?: number;
  /**
   * When in half_open, reserve exactly one probe. Prevents concurrent probes
   * that could immediately re-open the circuit or double-count failures.
   */
  probeInFlight?: boolean;
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
 *
 * Circuit breaker states:
 * - CLOSED: Normal operation, requests pass through
 * - OPEN: Provider is failing, requests are blocked
 * - HALF_OPEN: Testing if provider has recovered, allows one request
 */
export class CircuitBreaker {
  // Default configuration constants
  private static readonly DEFAULT_FAILURE_THRESHOLD = 3;
  private static readonly DEFAULT_OPEN_DURATION_MS = 5 * 60 * 1000; // 5 minutes
  private static readonly LOCK_CLEANUP_MS = 30_000; // 30 seconds

  private readonly failureThreshold: number;
  private readonly openDurationMs: number;
  private readonly locks = new Map<string, Promise<void>>();

  constructor(
    private readonly storage = new CacheStorage(),
    options: CircuitBreakerOptions = {}
  ) {
    this.failureThreshold = options.failureThreshold ?? CircuitBreaker.DEFAULT_FAILURE_THRESHOLD;
    this.openDurationMs = options.openDurationMs ?? CircuitBreaker.DEFAULT_OPEN_DURATION_MS;
  }

  async isOpen(providerId: string): Promise<boolean> {
    return this.withLock(providerId, async () => {
      let state = await this.load(providerId);

      if (state.state === 'open') {
        const expired = state.openedAt && Date.now() - state.openedAt > this.openDurationMs;
        if (expired) {
          state = { state: 'half_open', failures: 0, probeInFlight: false };
          await this.setState(providerId, state);
          // fall through to half_open handling below to reserve the probe
        }
        if (state.state === 'open') {
          return true;
        }
      }

      if (state.state === 'half_open') {
        // Allow exactly one probe during half-open; block concurrent callers
        if (state.probeInFlight) return true;

        await this.setState(providerId, { ...state, probeInFlight: true });
        return false;
      }

      return false;
    });
  }

  async recordSuccess(providerId: string): Promise<void> {
    await this.withLock(providerId, async () => {
      const state = await this.load(providerId);
      await this.setState(providerId, {
        state: 'closed',
        failures: 0,
        openedAt: undefined,
        probeInFlight: false,
      });

      if (state.state !== 'closed') {
        logger.debug(`Circuit closed for ${providerId} after recovery`);
      }
    });
  }

  async recordFailure(providerId: string): Promise<void> {
    await this.withLock(providerId, async () => {
      const state = await this.load(providerId);
      const failures = state.failures + 1;

      if (state.state === 'half_open') {
        await this.setState(providerId, {
          state: 'open',
          failures,
          openedAt: Date.now(),
          probeInFlight: false,
        });
        logger.warn(`Circuit re-opened for ${providerId} after half-open failure`);
        return;
      }

      if (failures >= this.failureThreshold) {
        await this.setState(providerId, { state: 'open', failures, openedAt: Date.now(), probeInFlight: false });
        logger.warn(`Circuit opened for ${providerId} after ${failures} failures`);
      } else {
        await this.setState(providerId, { state: 'closed', failures });
      }
    });
  }

  private async load(providerId: string): Promise<CircuitData> {
    const raw = await this.storage.read(this.key(providerId));
    if (!raw) {
      return { state: 'closed', failures: 0, probeInFlight: false };
    }

    try {
      const parsed = JSON.parse(raw) as CircuitData;
      return {
        probeInFlight: false,
        ...parsed,
      };
    } catch (error) {
      logger.warn(`Failed to parse circuit state for ${providerId}`, error as Error);
      return { state: 'closed', failures: 0, probeInFlight: false };
    }
  }

  private async setState(providerId: string, state: CircuitData): Promise<void> {
    await this.storage.write(this.key(providerId), JSON.stringify(state));
  }

  private key(providerId: string): string {
    return `circuit-breaker-${encodeURIComponentSafe(providerId)}`;
  }

  /**
   * Serialize concurrent access to circuit breaker state using a promise chain lock.
   * This prevents race conditions when multiple operations try to update the same provider's state.
   *
   * The lock implementation uses a promise chain where each operation waits for the previous
   * operation to complete before executing. The finally block ensures the lock is always
   * released and cleaned up, even if the operation throws an error.
   */
  private withLock<T>(providerId: string, fn: () => Promise<T>): Promise<T> {
    const lockKey = this.key(providerId);
    const previous = this.locks.get(lockKey)?.catch(() => undefined) ?? Promise.resolve();

    let release!: () => void;
    const current = new Promise<void>(resolve => (release = resolve));
    const tail = previous.then(() => current);
    this.locks.set(lockKey, tail);

    const run = (async () => {
      await previous;
      try {
        return await fn();
      } finally {
        release();
        // Clean up the lock immediately after execution
        // Only delete if this is still the current tail (not if a new lock was added)
        if (this.locks.get(lockKey) === tail) {
          this.locks.delete(lockKey);
        }
      }
    })();

    return run;
  }
}
