import {
  CallHandler,
  ExecutionContext,
  HttpException,
  HttpStatus,
  Inject,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import { Observable, from, switchMap } from 'rxjs';
import type { Request, Response } from 'express';
import { RateLimiter, RateLimitStatus } from '../domain/rate-limiter.interface';
import { INBOUND_RATE_LIMITER } from '../rate-limiter.module';
import { Logger, PinoLoggerAdapter } from '../infrastructure/logger';
import { rootLogger } from '../../../logging/logger.config';

@Injectable()
export class RateLimitInterceptor implements NestInterceptor {
  private readonly logger: Logger = new PinoLoggerAdapter(
    rootLogger.child({ context: 'RateLimitInterceptor' }),
  );

  constructor(
    @Inject(INBOUND_RATE_LIMITER) private readonly limiter: RateLimiter,
  ) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const http = context.switchToHttp();
    const req = http.getRequest<Request>();
    const res = http.getResponse<Response>();
    const key = this.keyForRequest(req);

    return from(this.limiter.allow(key)).pipe(
      switchMap((allowed) =>
        from(this.limiter.getLimitStatus(key)).pipe(
          switchMap((status) => {
            this.applyRateLimitHeaders(res, status);

            if (!allowed) {
              const retryAfterSec = Math.max(1, Math.ceil(status.retryAfterMs / 1000));
              res.setHeader('Retry-After', retryAfterSec);
              this.logger.warn('inbound rate limit exceeded', {
                key,
                retryAfterSec,
                path: req.originalUrl ?? req.url,
              });
              throw new HttpException(
                {
                  statusCode: HttpStatus.TOO_MANY_REQUESTS,
                  message: 'Too Many Requests',
                  retryAfterSec,
                },
                HttpStatus.TOO_MANY_REQUESTS,
              );
            }

            return next.handle();
          }),
        ),
      ),
    );
  }

  private keyForRequest(req: Request): string {
    return req.ip || req.socket?.remoteAddress || 'unknown';
  }

  private applyRateLimitHeaders(res: Response, status: RateLimitStatus): void {
    if (res.headersSent) return;
    const resetSec = Math.max(0, Math.ceil((status.resetTime - Date.now()) / 1000));
    res.setHeader('RateLimit-Limit', status.limit);
    res.setHeader('RateLimit-Remaining', status.remaining);
    res.setHeader('RateLimit-Reset', resetSec);
  }
}
