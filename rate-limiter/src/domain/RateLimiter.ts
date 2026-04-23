export interface RateLimiter {
  allow(key: string): Promise<boolean>;
  wait(key: string): Promise<void>; // Added wait to support "have to wait" requirement
  getLimitStatus(key: string): Promise<RateLimitStatus>;
}

export interface RateLimitStatus {
  allowed: boolean;
  remaining: number;
  limit: number;
  resetTime: number;
}
