/**
 * A distributed semaphore that limits concurrent access across
 * multiple replicas. Each slot represents a permit — acquiring
 * a slot blocks until one is available.
 */
export interface DistributedSemaphore {
  /**
   * Acquires a semaphore slot, waiting if necessary until one is available.
   * Returns a slot identifier that must be passed to release().
   */
  acquire(key: string): Promise<string>;

  /**
   * Releases a previously acquired semaphore slot.
   */
  release(key: string, slotId: string): Promise<void>;
}
