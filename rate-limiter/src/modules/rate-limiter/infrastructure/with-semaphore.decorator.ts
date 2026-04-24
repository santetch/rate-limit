import { Inject } from '@nestjs/common';
import { DistributedSemaphore } from '../domain/distributed-semaphore.interface';

export const DISTRIBUTED_SEMAPHORE = 'DistributedSemaphore';

/**
 * Method decorator that wraps a method call with a distributed semaphore.
 *
 * Before the method executes, it acquires a semaphore slot.
 * After the method completes (or throws), it releases the slot.
 *
 * The decorated class MUST have a `distributedSemaphore` property
 * injected via `@Inject('DistributedSemaphore')`.
 *
 * @param semaphoreKey - The Redis key namespace for this semaphore (default: 'default')
 */
export function WithSemaphore(semaphoreKey: string = 'default') {
  return function (
    _target: any,
    _propertyKey: string,
    descriptor: PropertyDescriptor,
  ) {
    const originalMethod = descriptor.value;

    descriptor.value = async function (this: any, ...args: any[]) {
      const semaphore: DistributedSemaphore = this.distributedSemaphore;

      if (!semaphore) {
        throw new Error(
          `@WithSemaphore requires a 'distributedSemaphore' property. ` +
          `Inject it with @Inject('${DISTRIBUTED_SEMAPHORE}').`,
        );
      }

      const slotId = await semaphore.acquire(semaphoreKey);

      try {
        return await originalMethod.apply(this, args);
      } finally {
        await semaphore.release(semaphoreKey, slotId);
      }
    };

    return descriptor;
  };
}
