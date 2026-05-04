import { Module, Global } from '@nestjs/common';
import Redis from 'ioredis';
import { TokenBucketLimiter } from './infrastructure/token-bucket-limiter';
import { PinoLoggerAdapter } from './infrastructure/logger';
import { RedisDistributedSemaphore } from './infrastructure/redis-distributed-semaphore';
import { DISTRIBUTED_SEMAPHORE } from './infrastructure/with-semaphore.decorator';
import { REDIS_CLIENT } from '../redis/redis.module';
import { rootLogger } from '../../logging/logger.config';

export const INBOUND_RATE_LIMITER = 'InboundRateLimiter';

function readPositiveNumber(envName: string, fallback: number): number {
  const raw = process.env[envName];
  if (raw === undefined || raw === '') return fallback;
  const parsed = Number(raw);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

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
      provide: INBOUND_RATE_LIMITER,
      useFactory: () => {
        const capacity = readPositiveNumber('INBOUND_RATE_LIMIT_CAPACITY', 10);
        const refill = readPositiveNumber('INBOUND_RATE_LIMIT_REFILL_PER_SECOND', 5);
        const logger = new PinoLoggerAdapter(
          rootLogger.child({ context: 'InboundRateLimiter' }),
        );
        return new TokenBucketLimiter(capacity, refill, logger);
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
  exports: ['RateLimiter', INBOUND_RATE_LIMITER, DISTRIBUTED_SEMAPHORE],
})
export class RateLimiterModule {}
