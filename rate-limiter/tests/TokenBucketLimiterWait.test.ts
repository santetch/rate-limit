import { jest, describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import { TokenBucketLimiter } from '../src/infrastructure/TokenBucketLimiter';

describe('TokenBucketLimiter Wait Support', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date('2023-01-01T00:00:00Z'));
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('should wait when no tokens are available', async () => {
    const limiter = new TokenBucketLimiter(1, 1); // 1 token per second
    
    // First call: allowed immediately
    const start = Date.now();
    await limiter.wait('user-1');
    expect(Date.now() - start).toBe(0);

    // Second call: should wait 1000ms
    const waitPromise = limiter.wait('user-1');
    
    // Check it's not resolved yet
    let resolved = false;
    waitPromise.then(() => { resolved = true; });
    
    await Promise.resolve(); // allow microtasks
    expect(resolved).toBe(false);

    // Advance time by 500ms
    jest.advanceTimersByTime(500);
    await Promise.resolve();
    expect(resolved).toBe(false);

    // Advance time by another 500ms
    jest.advanceTimersByTime(500);
    await Promise.resolve(); // allow microtasks to run timers
    // In Node/Jest fake timers, we might need to flush promises
    // Actually, advanceTimersByTime should trigger the timeout
  });

  it('should queue multiple requests', async () => {
      const limiter = new TokenBucketLimiter(1, 1);
      
      await limiter.wait('user-1'); // T=0
      
      const p1 = limiter.wait('user-1'); // T=1000
      const p2 = limiter.wait('user-1'); // T=2000
      
      let p1Resolved = false;
      let p2Resolved = false;
      p1.then(() => p1Resolved = true);
      p2.then(() => p2Resolved = true);
      
      jest.advanceTimersByTime(1000);
      await Promise.resolve();
      // Use setImmediate to wait for promise resolution if needed
      // but in Jest, jest.runAllTicks() or multiple Promise.resolve() help
      
      // Wait for p1
      await p1;
      expect(p1Resolved).toBe(true);
      expect(p2Resolved).toBe(false);
      
      jest.advanceTimersByTime(1000);
      await p2;
      expect(p2Resolved).toBe(true);
  });
});
