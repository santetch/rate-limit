/**
 * Interface for a Rate Limiter.
 * 
 * A rate limiter is used to control the rate of traffic sent or received by a network interface controller
 * or a network node.
 */
export interface RateLimiter {
  /**
   * Attempts to consume a token or unit from the rate limiter.
   * 
   * @param key The unique identifier for the client or resource (e.g., user ID, IP address).
   * @returns A promise that resolves to true if the request is allowed, false otherwise.
   */
  allow(key: string): Promise<boolean>;

  /**
   * Returns information about the current rate limit status for a key.
   * Useful for headers like X-RateLimit-Remaining.
   */
  getLimitStatus(key: string): Promise<RateLimitStatus>;
}

export interface RateLimitStatus {
  allowed: boolean;
  remaining: number;
  limit: number;
  resetTime: number; // Unix timestamp in milliseconds
}
