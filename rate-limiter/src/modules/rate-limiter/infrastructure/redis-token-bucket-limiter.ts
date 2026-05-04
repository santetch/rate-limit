import Redis from 'ioredis';
import { RateLimiter, RateLimitStatus } from '../domain/rate-limiter.interface';
import { Logger, NoOpLogger } from './logger';

/**
 * Atomic refill + (optional) consume + status read in a single Lua script.
 *
 * KEYS[1] = bucket hash key (`ratelimit:<id>`)
 * ARGV[1] = capacity (max tokens)
 * ARGV[2] = refill rate, tokens per millisecond
 * ARGV[3] = now (ms since epoch) — supplied by client so the script is
 *           independent of Redis server clock and stays compatible with
 *           ioredis-mock, which doesn't honor Jest fake timers.
 * ARGV[4] = consume flag: 1 = decrement on allow, 0 = peek only
 * ARGV[5] = key TTL in seconds (idle bucket cleanup)
 *
 * Returns: { allowed (0/1), remaining (int), retryAfterMs, resetTimeMs }
 */
const LUA_SCRIPT = `
local key       = KEYS[1]
local capacity  = tonumber(ARGV[1])
local refillMs  = tonumber(ARGV[2])
local now       = tonumber(ARGV[3])
local consume   = tonumber(ARGV[4])
local ttl       = tonumber(ARGV[5])

local data = redis.call('HMGET', key, 'tokens', 'lastRefillMs')
local tokens = tonumber(data[1])
local last   = tonumber(data[2])

if tokens == nil then
  tokens = capacity
  last   = now
end

local elapsed = now - last
if elapsed < 0 then elapsed = 0 end
tokens = math.min(capacity, tokens + elapsed * refillMs)

local allowed = 0
if tokens >= 1 then
  allowed = 1
  if consume == 1 then
    tokens = tokens - 1
  end
end

local retryAfterMs = 0
if tokens < 1 then
  retryAfterMs = math.ceil((1 - tokens) / refillMs)
end

local resetTime = now
if tokens < capacity then
  resetTime = now + math.ceil((capacity - tokens) / refillMs)
end

if consume == 1 then
  redis.call('HMSET', key, 'tokens', tokens, 'lastRefillMs', now)
  redis.call('EXPIRE', key, ttl)
end

local remaining = math.floor(tokens)
if remaining < 0 then remaining = 0 end

return { allowed, remaining, retryAfterMs, resetTime }
`;

/**
 * Redis-backed token bucket. State lives in a Redis hash per key, so the
 * configured capacity/refill apply *globally* across replicas — unlike the
 * in-process limiter, where the effective rate scales with replica count.
 *
 * Bucket key: `ratelimit:<key>`
 * Hash fields: `tokens`, `lastRefillMs`
 */
export class RedisTokenBucketLimiter implements RateLimiter {
  private readonly capacity: number;
  private readonly refillRatePerMs: number;
  private readonly keyTtlSec: number;
  private readonly logger: Logger;

  constructor(
    private readonly redis: Redis,
    capacity: number,
    refillRatePerSecond: number,
    logger: Logger = new NoOpLogger(),
  ) {
    if (capacity <= 0) throw new Error('Capacity must be greater than 0');
    if (refillRatePerSecond <= 0) throw new Error('Refill rate must be greater than 0');

    this.capacity = capacity;
    this.refillRatePerMs = refillRatePerSecond / 1000;
    // Idle keys self-clean after ~2× the time it takes to fully refill from empty.
    this.keyTtlSec = Math.max(1, Math.ceil((capacity / refillRatePerSecond) * 2));
    this.logger = logger;
  }

  async allow(key: string): Promise<boolean> {
    const status = await this.runScript(key, true);
    if (status.allowed) {
      this.logger.info('rate limit allowed', { key, remaining: status.remaining });
    } else {
      this.logger.warn('rate limit exceeded', { key, retryAfterMs: status.retryAfterMs });
    }
    return status.allowed;
  }

  /**
   * Polls until a token is available. Distributed reservation (negative
   * tokens, as the in-memory limiter does) would need owner tracking to be
   * safe across replicas; polling with the script-reported retryAfterMs is
   * simpler and good enough for the outbound-throttle use case.
   */
  async wait(key: string): Promise<void> {
    while (true) {
      const status = await this.runScript(key, true);
      if (status.allowed) return;
      const delay = Math.max(1, status.retryAfterMs);
      this.logger.info('rate limit wait', { key, waitMs: delay });
      await new Promise((resolve) => setTimeout(resolve, delay));
    }
  }

  async getLimitStatus(key: string): Promise<RateLimitStatus> {
    return this.runScript(key, false);
  }

  private async runScript(key: string, consume: boolean): Promise<RateLimitStatus> {
    const now = Date.now();
    const result = (await this.redis.eval(
      LUA_SCRIPT,
      1,
      this.bucketKey(key),
      String(this.capacity),
      String(this.refillRatePerMs),
      String(now),
      consume ? '1' : '0',
      String(this.keyTtlSec),
    )) as [number, number, number, number];

    const [allowed, remaining, retryAfterMs, resetTime] = result.map((v) => Number(v)) as [
      number,
      number,
      number,
      number,
    ];

    return {
      allowed: allowed === 1,
      remaining,
      limit: this.capacity,
      resetTime,
      retryAfterMs,
    };
  }

  private bucketKey(key: string): string {
    return `ratelimit:${key}`;
  }
}
