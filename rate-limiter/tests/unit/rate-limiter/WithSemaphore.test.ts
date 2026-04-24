import { jest, describe, it, expect, beforeEach } from '@jest/globals';
import { WithSemaphore } from '../../../src/modules/rate-limiter/infrastructure/with-semaphore.decorator';
import { DistributedSemaphore } from '../../../src/modules/rate-limiter/domain/distributed-semaphore.interface';

describe('WithSemaphore Decorator', () => {
  let mockSemaphore: jest.Mocked<DistributedSemaphore>;

  beforeEach(() => {
    mockSemaphore = {
      acquire: jest.fn<() => Promise<string>>().mockResolvedValue('slot-123'),
      release: jest.fn<() => Promise<void>>().mockResolvedValue(undefined),
    };
  });

  it('should acquire and release semaphore around method execution', async () => {
    const executionOrder: string[] = [];

    class TestService {
      public distributedSemaphore = mockSemaphore;

      @WithSemaphore('test-key')
      async doWork() {
        executionOrder.push('work');
        return 'result';
      }
    }

    mockSemaphore.acquire.mockImplementation(async () => {
      executionOrder.push('acquire');
      return 'slot-123';
    });
    mockSemaphore.release.mockImplementation(async () => {
      executionOrder.push('release');
    });

    const service = new TestService();
    const result = await service.doWork();

    expect(result).toBe('result');
    expect(executionOrder).toEqual(['acquire', 'work', 'release']);
    expect(mockSemaphore.acquire).toHaveBeenCalledWith('test-key');
    expect(mockSemaphore.release).toHaveBeenCalledWith('test-key', 'slot-123');
  });

  it('should release semaphore even when method throws', async () => {
    class TestService {
      public distributedSemaphore = mockSemaphore;

      @WithSemaphore('test-key')
      async doWork() {
        throw new Error('Boom!');
      }
    }

    const service = new TestService();
    await expect(service.doWork()).rejects.toThrow('Boom!');

    expect(mockSemaphore.acquire).toHaveBeenCalledWith('test-key');
    expect(mockSemaphore.release).toHaveBeenCalledWith('test-key', 'slot-123');
  });

  it('should throw if distributedSemaphore property is missing', async () => {
    class TestService {
      @WithSemaphore('test-key')
      async doWork() {
        return 'result';
      }
    }

    const service = new TestService();
    await expect(service.doWork()).rejects.toThrow(
      "@WithSemaphore requires a 'distributedSemaphore' property",
    );
  });

  it('should use default key when none is provided', async () => {
    class TestService {
      public distributedSemaphore = mockSemaphore;

      @WithSemaphore()
      async doWork() {
        return 'result';
      }
    }

    const service = new TestService();
    await service.doWork();

    expect(mockSemaphore.acquire).toHaveBeenCalledWith('default');
    expect(mockSemaphore.release).toHaveBeenCalledWith('default', 'slot-123');
  });

  it('should pass through method arguments and return value', async () => {
    class TestService {
      public distributedSemaphore = mockSemaphore;

      @WithSemaphore('test-key')
      async add(a: number, b: number) {
        return a + b;
      }
    }

    const service = new TestService();
    const result = await service.add(3, 4);

    expect(result).toBe(7);
  });
});
