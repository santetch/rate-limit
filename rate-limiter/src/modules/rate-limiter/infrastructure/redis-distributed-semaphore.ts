import Redis from 'ioredis';
import { DistributedSemaphore } from '../domain/distributed-semaphore.interface';
import { Logger, NoOpLogger } from './logger';

export interface RedisSemaphoreOptions {
  /** Maximum number of concurrent slots (default: 2) */
  maxSlots: number;
  /** TTL in seconds for each slot — auto-releases on crash (default: 30) */
  slotTtlSeconds: number;
  /** Retry interval in ms when all slots are taken (default: 100) */
  retryIntervalMs: number;
  /** Maximum time in ms to wait for a slot before giving up (default: 30000) */
  acquireTimeoutMs: number;
}

const DEFAULT_OPTIONS: RedisSemaphoreOptions = {
  maxSlots: 1,
  slotTtlSeconds: 30,
  retryIntervalMs: 100,
  acquireTimeoutMs: 30000,
};

/**
 * Redis-backed distributed semaphore.
 *
 * Uses N Redis keys (one per slot) with SET NX EX to implement
 * a counting semaphore that works across multiple service replicas.
 *
 * Each slot key: `semaphore:{key}:slot:{index}`
 * Value: a unique owner ID (UUID) to prevent releasing someone else's slot.
 */
export class RedisDistributedSemaphore implements DistributedSemaphore {
  private readonly options: RedisSemaphoreOptions;
  private readonly logger: Logger;

  constructor(
    private readonly redis: Redis,
    options: Partial<RedisSemaphoreOptions> = {},
    logger: Logger = new NoOpLogger(),
  ) {
    this.options = { ...DEFAULT_OPTIONS, ...options };
    this.logger = logger;

    if (this.options.maxSlots <= 0) {
      throw new Error('maxSlots must be greater than 0');
    }
  }

  async acquire(key: string): Promise<string> {
    const ownerId = this.generateOwnerId();
    const startTime = Date.now();

    while (true) {
      // Try each slot
      for (let i = 0; i < this.options.maxSlots; i++) {
        const slotKey = this.slotKey(key, i);
        const acquired = await this.tryAcquireSlot(slotKey, ownerId);
        if (acquired) {
          this.logger.info(
            `Acquired semaphore slot ${i} for key "${key}" (owner: ${ownerId})`,
          );
          return ownerId;
        }
      }

      // Check timeout
      const elapsed = Date.now() - startTime;
      if (elapsed >= this.options.acquireTimeoutMs) {
        throw new Error(
          `Failed to acquire semaphore for key "${key}" within ${this.options.acquireTimeoutMs}ms`,
        );
      }

      // Wait before retrying
      this.logger.info(
        `All ${this.options.maxSlots} slots busy for key "${key}", retrying in ${this.options.retryIntervalMs}ms...`,
      );
      await this.sleep(this.options.retryIntervalMs);
    }
  }

  async release(key: string, ownerId: string): Promise<void> {
    for (let i = 0; i < this.options.maxSlots; i++) {
      const slotKey = this.slotKey(key, i);
      const currentOwner = await this.redis.get(slotKey);

      if (currentOwner === ownerId) {
        await this.redis.del(slotKey);
        this.logger.info(
          `Released semaphore slot ${i} for key "${key}" (owner: ${ownerId})`,
        );
        return;
      }
    }

    this.logger.warn(
      `Attempted to release semaphore for key "${key}" with owner "${ownerId}", but no matching slot found`,
    );
  }

  /**
   * Returns the number of currently available slots for a key.
   */
  async availableSlots(key: string): Promise<number> {
    let available = 0;
    for (let i = 0; i < this.options.maxSlots; i++) {
      const slotKey = this.slotKey(key, i);
      const exists = await this.redis.exists(slotKey);
      if (!exists) {
        available++;
      }
    }
    return available;
  }

  private async tryAcquireSlot(
    slotKey: string,
    ownerId: string,
  ): Promise<boolean> {
    // SET key value NX EX ttl — atomic set-if-not-exists with expiry
    const result = await this.redis.set(
      slotKey,
      ownerId,
      'EX',
      this.options.slotTtlSeconds,
      'NX',
    );
    return result === 'OK';
  }

  private slotKey(key: string, index: number): string {
    return `semaphore:${key}:slot:${index}`;
  }

  private generateOwnerId(): string {
    // Use crypto.randomUUID if available, else fallback
    if (typeof crypto !== 'undefined' && crypto.randomUUID) {
      return crypto.randomUUID();
    }
    // Simple fallback
    return `${Date.now()}-${Math.random().toString(36).substring(2, 11)}`;
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
