import { Module, Global } from '@nestjs/common';
import Redis from 'ioredis';
import { TokenBucketLimiter } from './infrastructure/token-bucket-limiter';
import { PinoLoggerAdapter } from './infrastructure/logger';
import { RedisDistributedSemaphore } from './infrastructure/redis-distributed-semaphore';
import { DISTRIBUTED_SEMAPHORE } from './infrastructure/with-semaphore.decorator';
import { REDIS_CLIENT } from '../redis/redis.module';
import { rootLogger } from '../../logging/logger.config';

@Global()
@Module({
  providers: [
    {
      provide: 'RateLimiter',
      useFactory: () => {
        const logger = new PinoLoggerAdapter(
          rootLogger.child({ context: 'TokenBucketLimiter' }),
        );
        // Default limit: 1 request per second
        return new TokenBucketLimiter(1, 1, logger);
      },
    },
    {
      provide: DISTRIBUTED_SEMAPHORE,
      useFactory: (redis: Redis) => {
        const logger = new PinoLoggerAdapter(
          rootLogger.child({ context: 'DistributedSemaphore' }),
        );
        return new RedisDistributedSemaphore(redis, { maxSlots: 2 }, logger);
      },
      inject: [REDIS_CLIENT],
    },
  ],
  exports: ['RateLimiter', DISTRIBUTED_SEMAPHORE],
})
export class RateLimiterModule {}
