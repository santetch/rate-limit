import { jest, describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import RedisMock from 'ioredis-mock';
import { RedisTokenBucketLimiter } from '../../../src/modules/rate-limiter/infrastructure/redis-token-bucket-limiter';
import { NoOpLogger } from '../../../src/modules/rate-limiter/infrastructure/logger';

describe('RedisTokenBucketLimiter', () => {
  let redis: any;

  beforeEach(async () => {
    redis = new RedisMock();
    // ioredis-mock instances share their backing store by default —
    // flush so each test starts from a clean slate.
    await redis.flushall();
    jest.useFakeTimers();
    jest.setSystemTime(new Date('2026-01-01T00:00:00Z'));
  });

  afterEach(async () => {
    jest.useRealTimers();
    await redis.flushall();
    await redis.quit();
  });

  describe('configuration', () => {
    it('throws when capacity <= 0', () => {
      expect(() => new RedisTokenBucketLimiter(redis, 0, 1, new NoOpLogger())).toThrow(
        'Capacity must be greater than 0',
      );
      expect(() => new RedisTokenBucketLimiter(redis, -1, 1, new NoOpLogger())).toThrow(
        'Capacity must be greater than 0',
      );
    });

    it('throws when refill rate <= 0', () => {
      expect(() => new RedisTokenBucketLimiter(redis, 1, 0, new NoOpLogger())).toThrow(
        'Refill rate must be greater than 0',
      );
      expect(() => new RedisTokenBucketLimiter(redis, 1, -5, new NoOpLogger())).toThrow(
        'Refill rate must be greater than 0',
      );
    });
  });

  describe('allow()', () => {
    it('allows requests up to capacity, then denies', async () => {
      const limiter = new RedisTokenBucketLimiter(redis, 5, 1, new NoOpLogger());

      for (let i = 0; i < 5; i++) {
        expect(await limiter.allow('user-1')).toBe(true);
      }
      expect(await limiter.allow('user-1')).toBe(false);
    });

    it('refills tokens over time', async () => {
      const limiter = new RedisTokenBucketLimiter(redis, 5, 1, new NoOpLogger());

      // Drain the bucket
      for (let i = 0; i < 5; i++) {
        await limiter.allow('user-1');
      }
      expect(await limiter.allow('user-1')).toBe(false);

      // After 1s, one token should refill
      jest.advanceTimersByTime(1000);
      expect(await limiter.allow('user-1')).toBe(true);
      expect(await limiter.allow('user-1')).toBe(false);

      // After another 5s, the bucket is full again
      jest.advanceTimersByTime(5000);
      for (let i = 0; i < 5; i++) {
        expect(await limiter.allow('user-1')).toBe(true);
      }
      expect(await limiter.allow('user-1')).toBe(false);
    });

    it('handles fractional refill correctly', async () => {
      const limiter = new RedisTokenBucketLimiter(redis, 1, 1, new NoOpLogger());

      await limiter.allow('user-1');
      expect(await limiter.allow('user-1')).toBe(false);

      jest.advanceTimersByTime(500);
      expect(await limiter.allow('user-1')).toBe(false);

      jest.advanceTimersByTime(500);
      expect(await limiter.allow('user-1')).toBe(true);
    });

    it('isolates buckets per key', async () => {
      const limiter = new RedisTokenBucketLimiter(redis, 1, 1, new NoOpLogger());

      expect(await limiter.allow('user-1')).toBe(true);
      expect(await limiter.allow('user-1')).toBe(false);

      expect(await limiter.allow('user-2')).toBe(true);
      expect(await limiter.allow('user-2')).toBe(false);
    });
  });

  describe('getLimitStatus()', () => {
    it('does not consume tokens', async () => {
      const limiter = new RedisTokenBucketLimiter(redis, 3, 1, new NoOpLogger());

      const before = await limiter.getLimitStatus('user-1');
      const again = await limiter.getLimitStatus('user-1');
      const after = await limiter.getLimitStatus('user-1');

      expect(before.remaining).toBe(3);
      expect(again.remaining).toBe(3);
      expect(after.remaining).toBe(3);
    });

    it('reports correct remaining after partial consumption', async () => {
      const limiter = new RedisTokenBucketLimiter(redis, 10, 2, new NoOpLogger());

      await limiter.allow('user-1');
      await limiter.allow('user-1');

      const status = await limiter.getLimitStatus('user-1');
      expect(status.remaining).toBe(8);
      expect(status.limit).toBe(10);
      expect(status.allowed).toBe(true);
      expect(status.retryAfterMs).toBe(0);
    });

    it('reports retryAfterMs > 0 when bucket is empty', async () => {
      const limiter = new RedisTokenBucketLimiter(redis, 1, 1, new NoOpLogger());

      await limiter.allow('user-1');
      const status = await limiter.getLimitStatus('user-1');

      expect(status.allowed).toBe(false);
      expect(status.remaining).toBe(0);
      // 1 token / (1 token/sec) = 1000ms
      expect(status.retryAfterMs).toBe(1000);
    });

    it('returns retryAfterMs that decreases monotonically over time', async () => {
      const limiter = new RedisTokenBucketLimiter(redis, 1, 1, new NoOpLogger());

      await limiter.allow('user-1');

      const a = await limiter.getLimitStatus('user-1');
      jest.advanceTimersByTime(200);
      const b = await limiter.getLimitStatus('user-1');
      jest.advanceTimersByTime(300);
      const c = await limiter.getLimitStatus('user-1');

      expect(a.retryAfterMs).toBeGreaterThan(b.retryAfterMs);
      expect(b.retryAfterMs).toBeGreaterThan(c.retryAfterMs);
    });

    it('reports resetTime in the future when bucket not full', async () => {
      const limiter = new RedisTokenBucketLimiter(redis, 5, 1, new NoOpLogger());

      const now = Date.now();
      // Drain 3 tokens — needs 3s of refill to be full again
      await limiter.allow('user-1');
      await limiter.allow('user-1');
      await limiter.allow('user-1');

      const status = await limiter.getLimitStatus('user-1');
      expect(status.resetTime).toBeGreaterThanOrEqual(now + 2900);
      expect(status.resetTime).toBeLessThanOrEqual(now + 3100);
    });
  });

  describe('persistence', () => {
    it('stores state under ratelimit:<key>', async () => {
      const limiter = new RedisTokenBucketLimiter(redis, 5, 1, new NoOpLogger());
      await limiter.allow('alice');

      const stored = await redis.hgetall('ratelimit:alice');
      expect(stored).toHaveProperty('tokens');
      expect(stored).toHaveProperty('lastRefillMs');
      expect(parseFloat(stored.tokens)).toBeCloseTo(4, 5);
    });

    it('sets a TTL so idle keys self-clean', async () => {
      // capacity=5 / refill=1 → keyTtl = ceil(5 * 2) = 10s
      const limiter = new RedisTokenBucketLimiter(redis, 5, 1, new NoOpLogger());
      await limiter.allow('idle-key');

      const ttl = await redis.ttl('ratelimit:idle-key');
      expect(ttl).toBeGreaterThan(0);
      expect(ttl).toBeLessThanOrEqual(10);
    });

    it('does not persist on read-only getLimitStatus when key is absent', async () => {
      const limiter = new RedisTokenBucketLimiter(redis, 5, 1, new NoOpLogger());

      await limiter.getLimitStatus('never-touched');

      const exists = await redis.exists('ratelimit:never-touched');
      expect(exists).toBe(0);
    });
  });

  describe('cross-instance sharing', () => {
    it('two limiter instances on the same Redis share a single bucket', async () => {
      // Simulates two replicas: each holds its own limiter object, but they
      // observe the same Redis state, so the global rate is enforced.
      const a = new RedisTokenBucketLimiter(redis, 3, 1, new NoOpLogger());
      const b = new RedisTokenBucketLimiter(redis, 3, 1, new NoOpLogger());

      expect(await a.allow('shared')).toBe(true);
      expect(await b.allow('shared')).toBe(true);
      expect(await a.allow('shared')).toBe(true);
      // Capacity=3, all three tokens used — both replicas now denied.
      expect(await b.allow('shared')).toBe(false);
      expect(await a.allow('shared')).toBe(false);
    });
  });
});
