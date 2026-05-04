import { Module, Global } from '@nestjs/common';
import Redis from 'ioredis';
import { TokenBucketLimiter } from './infrastructure/token-bucket-limiter';
import { RedisTokenBucketLimiter } from './infrastructure/redis-token-bucket-limiter';
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

function inboundBackend(): 'memory' | 'redis' {
  const raw = (process.env.INBOUND_RATE_LIMITER_BACKEND || '').toLowerCase();
  if (raw === 'memory' || raw === 'redis') return raw;
  // Default to in-memory under tests (no Redis required); Redis everywhere else.
  return process.env.NODE_ENV === 'test' ? 'memory' : 'redis';
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
      useFactory: (redis: Redis) => {
        const capacity = readPositiveNumber('INBOUND_RATE_LIMIT_CAPACITY', 10);
        const refill = readPositiveNumber('INBOUND_RATE_LIMIT_REFILL_PER_SECOND', 5);
        const backend = inboundBackend();
        const logger = new PinoLoggerAdapter(
          rootLogger.child({ context: 'InboundRateLimiter', backend }),
        );

        if (backend === 'redis') {
          return new RedisTokenBucketLimiter(redis, capacity, refill, logger);
        }
        return new TokenBucketLimiter(capacity, refill, logger);
      },
      inject: [REDIS_CLIENT],
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
