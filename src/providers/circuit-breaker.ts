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
 * Circuit breaker to prevent cascading failures from unreliable providers.
 *
 * STATE MACHINE:
 * - CLOSED: Normal operation, requests pass through
 *   → After N consecutive failures → OPEN
 *
 * - OPEN: Provider is failing, all requests are blocked
 *   → After cooldown period → HALF_OPEN
 *
 * - HALF_OPEN: Testing if provider has recovered, allows exactly ONE probe request
 *   → On success → CLOSED (reset counters)
 *   → On failure → OPEN (restart cooldown)
 *
 * CONCURRENCY SAFETY:
 * - Uses promise-chain locks (withLock) to serialize state updates per provider
 * - probeInFlight flag ensures only one probe during half-open state
 * - Lock cleanup timer prevents permanent deadlocks if operations hang
 *
 * PERSISTENCE:
 * - State is persisted to CacheStorage (filesystem-based)
 * - Survives process restarts and allows coordination across multiple instances
 * - Corrupted state gracefully defaults to CLOSED
 *
 * CONFIGURATION:
 * - failureThreshold: Number of consecutive failures before opening (default: 3)
 * - openDurationMs: Cooldown period before attempting recovery (default: 5 minutes)
 *
 * USAGE:
 *   if (await breaker.isOpen('provider-id')) {
 *     return; // Skip this provider
 *   }
 *   try {
 *     const result = await provider.healthCheck();
 *     await breaker.recordSuccess('provider-id');
 *   } catch (error) {
 *     await breaker.recordFailure('provider-id');
 *   }
 */
export class CircuitBreaker {
  // Default configuration constants
  private static readonly DEFAULT_FAILURE_THRESHOLD = 3;
  private static readonly DEFAULT_OPEN_DURATION_MS = 5 * 60 * 1000; // 5 minutes
  private static readonly LOCK_CLEANUP_MS = 10_000; // 10 seconds (reduced for faster recovery)

  private readonly failureThreshold: number;
  private readonly openDurationMs: number;
  // Lock map for concurrency control - automatically cleaned up via timer + finally block
  // Memory leak prevention: locks are removed after LOCK_CLEANUP_MS or immediately after completion
  private readonly locks = new Map<string, Promise<void>>();

  constructor(
    private readonly storage = new CacheStorage(),
    options: CircuitBreakerOptions = {}
  ) {
    this.failureThreshold = options.failureThreshold ?? CircuitBreaker.DEFAULT_FAILURE_THRESHOLD;
    this.openDurationMs = options.openDurationMs ?? CircuitBreaker.DEFAULT_OPEN_DURATION_MS;
  }

  /**
   * Get the current number of active locks (for monitoring/debugging)
   * Used to detect potential lock accumulation issues
   */
  getActiveLockCount(): number {
    return this.locks.size;
  }

  /**
   * Check if circuit is open (provider should be skipped)
   * Also handles state transitions: OPEN → HALF_OPEN after cooldown
   *
   * Returns:
   * - true: Circuit is OPEN or HALF_OPEN with probe in flight (block request)
   * - false: Circuit is CLOSED or HALF_OPEN without probe (allow request)
   *
   * Side effects:
   * - Transitions OPEN → HALF_OPEN if cooldown expired
   * - Sets probeInFlight flag when allowing half-open probe
   */
  async isOpen(providerId: string): Promise<boolean> {
    return this.withLock(providerId, async () => {
      let state = await this.load(providerId);

      if (state.state === 'open') {
        const expired = state.openedAt && Date.now() - state.openedAt > this.openDurationMs;
        if (expired) {
          // Cooldown expired: transition to half-open for testing
          state = { state: 'half_open', failures: 0, probeInFlight: false };
          await this.setState(providerId, state);
          logger.debug(`Circuit transitioned to half-open for ${providerId} after cooldown`);
          // fall through to half_open handling below to reserve the probe
        }
        if (state.state === 'open') {
          return true; // Still in cooldown, block request
        }
      }

      if (state.state === 'half_open') {
        // Allow exactly one probe during half-open; block concurrent callers
        // This prevents multiple simultaneous health checks that could:
        // 1. Double-count failures and immediately re-open the circuit
        // 2. Overwhelm a recovering provider with concurrent requests
        if (state.probeInFlight) {
          return true; // Another probe is in flight, block this request
        }

        // Reserve this request as the probe
        await this.setState(providerId, { ...state, probeInFlight: true });
        return false; // Allow this single probe request
      }

      return false; // Circuit is closed, allow request
    });
  }

  /**
   * Record a successful operation
   * Transitions any state → CLOSED and resets failure counter
   *
   * Call this after:
   * - Successful health check
   * - Successful API request
   * - Any operation indicating the provider is healthy
   */
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
        logger.info(`Circuit closed for ${providerId} after successful recovery (was ${state.state})`);
      }
    });
  }

  /**
   * Record a failed operation
   * Increments failure counter and opens circuit if threshold reached
   *
   * State transitions:
   * - CLOSED: failures++ → if >= threshold → OPEN
   * - HALF_OPEN: failures++ → OPEN (probe failed, provider still unhealthy)
   *
   * Call this after:
   * - Failed health check
   * - API timeout or error
   * - Any operation indicating the provider is unhealthy
   */
  async recordFailure(providerId: string): Promise<void> {
    await this.withLock(providerId, async () => {
      const state = await this.load(providerId);
      const failures = state.failures + 1;

      if (state.state === 'half_open') {
        // Probe failed: provider is still unhealthy, re-open circuit
        await this.setState(providerId, {
          state: 'open',
          failures,
          openedAt: Date.now(),
          probeInFlight: false,
        });
        logger.warn(`Circuit re-opened for ${providerId} after half-open probe failed (${failures} total failures)`);
        return;
      }

      if (failures >= this.failureThreshold) {
        // Threshold reached: open circuit to start cooldown
        await this.setState(providerId, { state: 'open', failures, openedAt: Date.now(), probeInFlight: false });
        logger.warn(
          `Circuit opened for ${providerId} after ${failures} consecutive failures ` +
          `(threshold: ${this.failureThreshold}, cooldown: ${this.openDurationMs}ms)`
        );
      } else {
        // Still under threshold: stay closed but increment counter
        await this.setState(providerId, { state: 'closed', failures });
        logger.debug(`Circuit failure recorded for ${providerId}: ${failures}/${this.failureThreshold}`);
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
      // Return parsed state as-is during normal operation
      // Note: probeInFlight flag is reset by recordSuccess/recordFailure
      return parsed;
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

    // Failsafe cleanup: if something wedges the tail promise, clear the lock after a timeout.
    // This is a safety net - normal cleanup happens in the finally block below.
    // The timer is always cleared in the finally block, so it won't fire in normal operation.
    const cleanupTimer = setTimeout(() => {
      if (this.locks.get(lockKey) === tail) {
        logger.warn(`Lock cleanup triggered for ${lockKey}`);
        this.locks.delete(lockKey);
      }
    }, CircuitBreaker.LOCK_CLEANUP_MS);

    const run = (async () => {
      try {
        await previous;
        return await fn();
      } finally {
        // Always release the lock and clear the timeout
        // This runs even if fn() throws or previous rejects
        release();
        clearTimeout(cleanupTimer); // Prevents timer from firing in normal case

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
