import { jest, describe, it, expect, beforeEach } from '@jest/globals';
import { RedisDistributedSemaphore } from '../../../src/modules/rate-limiter/infrastructure/redis-distributed-semaphore';
import { NoOpLogger } from '../../../src/modules/rate-limiter/infrastructure/logger';

// Mock Redis client
function createMockRedis() {
  const store: Record<string, string> = {};

  return {
    store,
    set: jest.fn(async (...args: any[]) => {
      const [key, value, exFlag, ttl, nxFlag] = args;
      if (nxFlag === 'NX') {
        if (store[key]) {
          return null; // Key already exists
        }
        store[key] = value;
        return 'OK';
      }
      store[key] = value;
      return 'OK';
    }),
    get: jest.fn(async (key: string) => {
      return store[key] || null;
    }),
    del: jest.fn(async (key: string) => {
      const existed = key in store;
      delete store[key];
      return existed ? 1 : 0;
    }),
    exists: jest.fn(async (key: string) => {
      return key in store ? 1 : 0;
    }),
  };
}

describe('RedisDistributedSemaphore', () => {
  let mockRedis: ReturnType<typeof createMockRedis>;
  let semaphore: RedisDistributedSemaphore;

  beforeEach(() => {
    mockRedis = createMockRedis();
    semaphore = new RedisDistributedSemaphore(
      mockRedis as any,
      { maxSlots: 2, slotTtlSeconds: 30, retryIntervalMs: 10, acquireTimeoutMs: 500 },
      new NoOpLogger(),
    );
  });

  describe('constructor', () => {
    it('should throw if maxSlots is 0 or negative', () => {
      expect(() => new RedisDistributedSemaphore(mockRedis as any, { maxSlots: 0 }))
        .toThrow('maxSlots must be greater than 0');
      expect(() => new RedisDistributedSemaphore(mockRedis as any, { maxSlots: -1 }))
        .toThrow('maxSlots must be greater than 0');
    });
  });

  describe('acquire', () => {
    it('should acquire a slot and return an owner ID', async () => {
      const ownerId = await semaphore.acquire('test-key');

      expect(ownerId).toBeDefined();
      expect(typeof ownerId).toBe('string');
      expect(mockRedis.set).toHaveBeenCalledWith(
        'semaphore:test-key:slot:0',
        ownerId,
        'EX',
        30,
        'NX',
      );
    });

    it('should acquire two different slots for two calls', async () => {
      const owner1 = await semaphore.acquire('test-key');
      const owner2 = await semaphore.acquire('test-key');

      expect(owner1).not.toBe(owner2);
      expect(mockRedis.store['semaphore:test-key:slot:0']).toBe(owner1);
      expect(mockRedis.store['semaphore:test-key:slot:1']).toBe(owner2);
    });

    it('should timeout when all slots are taken', async () => {
      // Fill all slots
      await semaphore.acquire('test-key');
      await semaphore.acquire('test-key');

      // Third acquire should timeout
      await expect(semaphore.acquire('test-key')).rejects.toThrow(
        'Failed to acquire semaphore for key "test-key"',
      );
    });
  });

  describe('release', () => {
    it('should release a previously acquired slot', async () => {
      const ownerId = await semaphore.acquire('test-key');
      expect(mockRedis.store['semaphore:test-key:slot:0']).toBe(ownerId);

      await semaphore.release('test-key', ownerId);
      expect(mockRedis.store['semaphore:test-key:slot:0']).toBeUndefined();
    });

    it('should not release a slot owned by a different owner', async () => {
      const ownerId = await semaphore.acquire('test-key');

      await semaphore.release('test-key', 'wrong-owner-id');

      // Slot should still be held
      expect(mockRedis.store['semaphore:test-key:slot:0']).toBe(ownerId);
    });

    it('should allow reacquire after release', async () => {
      const owner1 = await semaphore.acquire('test-key');
      const owner2 = await semaphore.acquire('test-key');

      // Release first slot
      await semaphore.release('test-key', owner1);

      // Should be able to acquire again
      const owner3 = await semaphore.acquire('test-key');
      expect(owner3).toBeDefined();
      expect(mockRedis.store['semaphore:test-key:slot:0']).toBe(owner3);
    });
  });

  describe('availableSlots', () => {
    it('should return maxSlots when nothing is acquired', async () => {
      const available = await semaphore.availableSlots('test-key');
      expect(available).toBe(2);
    });

    it('should decrement after acquiring', async () => {
      await semaphore.acquire('test-key');
      expect(await semaphore.availableSlots('test-key')).toBe(1);

      await semaphore.acquire('test-key');
      expect(await semaphore.availableSlots('test-key')).toBe(0);
    });

    it('should increment after releasing', async () => {
      const ownerId = await semaphore.acquire('test-key');
      expect(await semaphore.availableSlots('test-key')).toBe(1);

      await semaphore.release('test-key', ownerId);
      expect(await semaphore.availableSlots('test-key')).toBe(2);
    });
  });

  describe('key isolation', () => {
    it('should manage slots independently for different keys', async () => {
      const ownerA = await semaphore.acquire('key-a');
      const ownerB = await semaphore.acquire('key-b');

      expect(await semaphore.availableSlots('key-a')).toBe(1);
      expect(await semaphore.availableSlots('key-b')).toBe(1);

      await semaphore.release('key-a', ownerA);
      expect(await semaphore.availableSlots('key-a')).toBe(2);
      expect(await semaphore.availableSlots('key-b')).toBe(1);
    });
  });
});
