import { Module, Global } from '@nestjs/common';
import { TokenBucketLimiter } from './infrastructure/token-bucket-limiter';
import { ConsoleLogger } from './infrastructure/logger';

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
  ],
  exports: ['RateLimiter'],
})
export class RateLimiterModule {}
