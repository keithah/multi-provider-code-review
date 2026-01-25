import { CacheStorage } from '../cache/storage';
import { logger } from '../utils/logger';

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

  constructor(
    private readonly storage = new CacheStorage(),
    options: CircuitBreakerOptions = {}
  ) {
    this.failureThreshold = options.failureThreshold ?? 3;
    this.openDurationMs = options.openDurationMs ?? 5 * 60 * 1000; // 5 minutes
  }

  async isOpen(providerId: string): Promise<boolean> {
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
  }

  async recordSuccess(providerId: string): Promise<void> {
    await this.setState(providerId, { state: 'closed', failures: 0 });
  }

  async recordFailure(providerId: string): Promise<void> {
    const state = await this.load(providerId);
    const failures = state.failures + 1;

    // If we're in half-open, a single failure should reopen immediately.
    if (state.state === 'half_open') {
      await this.setState(providerId, { state: 'open', failures: this.failureThreshold, openedAt: Date.now() });
      logger.warn(`Circuit re-opened for ${providerId} after half-open failure`);
      return;
    }

    if (failures >= this.failureThreshold) {
      await this.setState(providerId, { state: 'open', failures, openedAt: Date.now() });
      logger.warn(`Circuit opened for ${providerId} after ${failures} failures`);
    } else {
      await this.setState(providerId, { state: 'closed', failures });
    }
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
    return `circuit-breaker-${providerId}`;
  }
}
