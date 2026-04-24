import { Module, Global, Inject } from '@nestjs/common';
import Redis from 'ioredis';
import { TokenBucketLimiter } from './infrastructure/token-bucket-limiter';
import { ConsoleLogger } from './infrastructure/logger';
import { RedisDistributedSemaphore } from './infrastructure/redis-distributed-semaphore';
import { DISTRIBUTED_SEMAPHORE } from './infrastructure/with-semaphore.decorator';
import { REDIS_CLIENT } from '../redis/redis.module';

@Global() // Make it global so other modules can use the rate limiter easily
@Module({
  providers: [
    {
      provide: 'RateLimiter',
      useFactory: () => {
        // Default limit: 1 request per second
        return new TokenBucketLimiter(1, 1, new ConsoleLogger());
      },
    },
    {
      provide: DISTRIBUTED_SEMAPHORE,
      useFactory: (redis: Redis) => {
        return new RedisDistributedSemaphore(
          redis,
          { maxSlots: 2 },
          new ConsoleLogger(),
        );
      },
      inject: [REDIS_CLIENT],
    },
  ],
  exports: ['RateLimiter', DISTRIBUTED_SEMAPHORE],
})
export class RateLimiterModule {}
