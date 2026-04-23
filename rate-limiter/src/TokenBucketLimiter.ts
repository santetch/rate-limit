import { RateLimiter, RateLimitStatus } from './RateLimiter';
import { Logger, NoOpLogger } from './Logger';

/**
 * TokenBucketLimiter implements the Token Bucket algorithm.
 * 
 * Design Choices:
 * - In-memory storage using a Map.
 * - Lazy token replenishment: Tokens are added when a request arrives, 
 *   based on the time elapsed since the last request.
 * - Efficient: O(1) time complexity for `allow()` and O(1) space per active key.
 */
export class TokenBucketLimiter implements RateLimiter {
  private readonly buckets: Map<string, BucketState>;
  private readonly capacity: number;
  private readonly refillRate: number; // tokens per millisecond
  private readonly logger: Logger;

  /**
   * @param capacity Maximum number of tokens the bucket can hold.
   * @param refillRatePerSecond Number of tokens added to the bucket every second.
   * @param logger Optional logger for monitoring.
   */
  constructor(capacity: number, refillRatePerSecond: number, logger: Logger = new NoOpLogger()) {
    if (capacity <= 0) throw new Error('Capacity must be greater than 0');
    if (refillRatePerSecond <= 0) throw new Error('Refill rate must be greater than 0');

    this.buckets = new Map();
    this.capacity = capacity;
    this.refillRate = refillRatePerSecond / 1000;
    this.logger = logger;
  }

  /**
   * Checks if a request is allowed for the given key.
   */
  public async allow(key: string): Promise<boolean> {
    const now = Date.now();
    const state = this.getOrInitializeBucket(key, now);

    this.refill(state, now);

    if (state.tokens >= 1) {
      state.tokens -= 1;
      this.logger.info(`Allowed request for key: ${key}. Tokens remaining: ${Math.floor(state.tokens)}`);
      return true;
    }

    this.logger.warn(`Rate limit exceeded for key: ${key}`);
    return false;
  }

  /**
   * Returns the current status of the rate limit for the given key.
   */
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

    return {
      allowed: currentTokens >= 1,
      remaining: Math.floor(currentTokens),
      limit: this.capacity,
      resetTime: Math.ceil(resetTime),
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
    
    state.tokens = Math.min(this.capacity, state.tokens + tokensToAdd);
    state.lastRefillTime = now;
  }
}

interface BucketState {
  tokens: number; // Can be fractional to handle smooth refill
  lastRefillTime: number;
}
