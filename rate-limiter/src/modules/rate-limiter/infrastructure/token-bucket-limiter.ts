import { RateLimiter, RateLimitStatus } from '../domain/rate-limiter.interface';
import { Logger, NoOpLogger } from './logger';

export class TokenBucketLimiter implements RateLimiter {
  private readonly buckets: Map<string, BucketState>;
  private readonly capacity: number;
  private readonly refillRate: number; // tokens per millisecond
  private readonly logger: Logger;

  constructor(capacity: number, refillRatePerSecond: number, logger: Logger = new NoOpLogger()) {
    if (capacity <= 0) throw new Error('Capacity must be greater than 0');
    if (refillRatePerSecond <= 0) throw new Error('Refill rate must be greater than 0');

    this.buckets = new Map();
    this.capacity = capacity;
    this.refillRate = refillRatePerSecond / 1000;
    this.logger = logger;
  }

  public async allow(key: string): Promise<boolean> {
    const now = Date.now();
    const state = this.getOrInitializeBucket(key, now);

    this.refill(state, now);

    if (state.tokens >= 1) {
      state.tokens -= 1;
      this.logger.info('rate limit allowed', {
        key,
        tokensRemaining: Math.floor(state.tokens),
      });
      return true;
    }

    this.logger.warn('rate limit exceeded', { key });
    return false;
  }

  /**
   * Waits until a token is available and then consumes it.
   */
  public async wait(key: string): Promise<void> {
    const now = Date.now();
    const state = this.getOrInitializeBucket(key, now);

    this.refill(state, now);

    if (state.tokens >= 1) {
      state.tokens -= 1;
      return;
    }

    // Calculate when the next token will be available
    // We also need to account for other requests waiting in line
    // To do this, we "reserve" a token by allowing state.tokens to go negative
    state.tokens -= 1;
    const waitTime = Math.abs(state.tokens) / this.refillRate;

    this.logger.info('rate limit wait', {
      key,
      waitMs: Math.round(waitTime),
    });

    return new Promise((resolve) => {
      setTimeout(resolve, waitTime);
    });
  }

  public async getLimitStatus(key: string): Promise<RateLimitStatus> {
    const now = Date.now();
    const state = this.getOrInitializeBucket(key, now);
    
    const elapsedTime = now - state.lastRefillTime;
    const tokensToAdd = elapsedTime * this.refillRate;
    const currentTokens = Math.min(this.capacity, state.tokens + tokensToAdd);
    
    let resetTime = now;
    if (currentTokens < this.capacity) {
        const missingTokens = this.capacity - currentTokens;
        resetTime = now + (missingTokens / this.refillRate);
    }

    const retryAfterMs = currentTokens >= 1
      ? 0
      : Math.ceil((1 - currentTokens) / this.refillRate);

    return {
      allowed: currentTokens >= 1,
      remaining: Math.max(0, Math.floor(currentTokens)),
      limit: this.capacity,
      resetTime: Math.ceil(resetTime),
      retryAfterMs,
    };
  }

  private getOrInitializeBucket(key: string, now: number): BucketState {
    let state = this.buckets.get(key);
    if (!state) {
      state = {
        tokens: this.capacity,
        lastRefillTime: now,
      };
      this.buckets.set(key, state);
    }
    return state;
  }

  private refill(state: BucketState, now: number): void {
    const elapsedTime = now - state.lastRefillTime;
    const tokensToAdd = elapsedTime * this.refillRate;
    
    // We allow tokens to be negative if they are "reserved" by wait()
    // but when refilling, we cap it at capacity
    state.tokens = Math.min(this.capacity, state.tokens + tokensToAdd);
    state.lastRefillTime = now;
  }
}

interface BucketState {
  tokens: number;
  lastRefillTime: number;
}
