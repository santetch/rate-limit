import { jest, describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import { TokenBucketLimiter } from '../src/modules/rate-limiter/infrastructure/token-bucket-limiter';

describe('TokenBucketLimiter', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date('2023-01-01T00:00:00Z'));
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('should allow requests within capacity', async () => {
    const limiter = new TokenBucketLimiter(5, 1); // 5 capacity, 1 token per second
    
    for (let i = 0; i < 5; i++) {
      expect(await limiter.allow('user-1')).toBe(true);
    }
    
    expect(await limiter.allow('user-1')).toBe(false);
  });

  it('should refill tokens over time', async () => {
    const limiter = new TokenBucketLimiter(5, 1);
    
    // Consume all tokens
    for (let i = 0; i < 5; i++) {
      await limiter.allow('user-1');
    }
    expect(await limiter.allow('user-1')).toBe(false);

    // Advance time by 1 second
    jest.advanceTimersByTime(1000);
    expect(await limiter.allow('user-1')).toBe(true);
    expect(await limiter.allow('user-1')).toBe(false);

    // Advance time by 5 seconds (full refill)
    jest.advanceTimersByTime(5000);
    for (let i = 0; i < 5; i++) {
      expect(await limiter.allow('user-1')).toBe(true);
    }
    expect(await limiter.allow('user-1')).toBe(false);
  });

  it('should handle multiple keys independently', async () => {
    const limiter = new TokenBucketLimiter(1, 1);
    
    expect(await limiter.allow('user-1')).toBe(true);
    expect(await limiter.allow('user-1')).toBe(false);
    
    expect(await limiter.allow('user-2')).toBe(true);
    expect(await limiter.allow('user-2')).toBe(false);
  });

  it('should return correct limit status', async () => {
    const limiter = new TokenBucketLimiter(10, 2); // 2 tokens per sec
    
    await limiter.allow('user-1'); // 9 left
    await limiter.allow('user-1'); // 8 left
    
    const status = await limiter.getLimitStatus('user-1');
    expect(status.remaining).toBe(8);
    expect(status.limit).toBe(10);
    expect(status.allowed).toBe(true);

    // Advance 1 second -> 2 tokens added -> 10 tokens total (cap)
    jest.advanceTimersByTime(1000);
    const status2 = await limiter.getLimitStatus('user-1');
    expect(status2.remaining).toBe(10);
  });

  it('should throw error for invalid configuration', () => {
    expect(() => new TokenBucketLimiter(0, 1)).toThrow();
    expect(() => new TokenBucketLimiter(1, 0)).toThrow();
  });

  it('should handle fractional refill correctly', async () => {
      const limiter = new TokenBucketLimiter(1, 1); // 1 token per 1000ms
      
      await limiter.allow('user-1');
      expect(await limiter.allow('user-1')).toBe(false);
      
      // Advance 500ms -> 0.5 tokens. Still not enough for 1 full token.
      jest.advanceTimersByTime(500);
      expect(await limiter.allow('user-1')).toBe(false);
      
      // Advance another 500ms -> 1.0 tokens total.
      jest.advanceTimersByTime(500);
      expect(await limiter.allow('user-1')).toBe(true);
  });
});
