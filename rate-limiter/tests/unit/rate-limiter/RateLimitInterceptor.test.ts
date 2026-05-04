import { jest, describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import { CallHandler, ExecutionContext, HttpException, HttpStatus } from '@nestjs/common';
import { firstValueFrom, lastValueFrom, of, throwError } from 'rxjs';
import { RateLimitInterceptor } from '../../../src/modules/rate-limiter/interface/rate-limit.interceptor';
import { TokenBucketLimiter } from '../../../src/modules/rate-limiter/infrastructure/token-bucket-limiter';

function buildContext(req: Partial<{ ip: string; url: string; originalUrl: string }>) {
  const headers: Record<string, unknown> = {};
  let sent = false;
  const res = {
    setHeader: (name: string, value: unknown) => {
      headers[name] = value;
    },
    get headersSent() {
      return sent;
    },
    markSent() {
      sent = true;
    },
  };
  const ctx = {
    switchToHttp: () => ({
      getRequest: () => req,
      getResponse: () => res,
    }),
  } as unknown as ExecutionContext;
  return { ctx, headers, res };
}

const passThroughHandler: CallHandler = {
  handle: () => of({ ok: true }),
};

describe('RateLimitInterceptor', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date('2026-05-04T00:00:00Z'));
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('attaches RateLimit-* headers on the success path', async () => {
    const limiter = new TokenBucketLimiter(10, 5);
    const interceptor = new RateLimitInterceptor(limiter);
    const { ctx, headers } = buildContext({ ip: '1.2.3.4' });

    const result = await firstValueFrom(
      interceptor.intercept(ctx, passThroughHandler) as any,
    );

    expect(result).toEqual({ ok: true });
    expect(headers['RateLimit-Limit']).toBe(10);
    // one token consumed -> 9 remaining
    expect(headers['RateLimit-Remaining']).toBe(9);
    // not at full -> reset > 0
    expect(headers['RateLimit-Reset']).toBeGreaterThan(0);
    expect(headers['Retry-After']).toBeUndefined();
  });

  it('decrements remaining across consecutive requests from the same key', async () => {
    const limiter = new TokenBucketLimiter(3, 1);
    const interceptor = new RateLimitInterceptor(limiter);

    for (let expected = 2; expected >= 0; expected--) {
      const { ctx, headers } = buildContext({ ip: '9.9.9.9' });
      await firstValueFrom(interceptor.intercept(ctx, passThroughHandler) as any);
      expect(headers['RateLimit-Remaining']).toBe(expected);
    }
  });

  it('throws 429 with Retry-After when bucket is empty', async () => {
    const limiter = new TokenBucketLimiter(1, 1); // refill 1 token/sec
    const interceptor = new RateLimitInterceptor(limiter);

    // First request consumes the token
    const ok = buildContext({ ip: '5.5.5.5' });
    await firstValueFrom(interceptor.intercept(ok.ctx, passThroughHandler) as any);

    // Second request should be denied
    const { ctx, headers } = buildContext({ ip: '5.5.5.5' });
    let captured: HttpException | undefined;
    try {
      await firstValueFrom(interceptor.intercept(ctx, passThroughHandler) as any);
    } catch (err) {
      captured = err as HttpException;
    }

    expect(captured).toBeInstanceOf(HttpException);
    expect(captured!.getStatus()).toBe(HttpStatus.TOO_MANY_REQUESTS);

    expect(headers['RateLimit-Limit']).toBe(1);
    expect(headers['RateLimit-Remaining']).toBe(0);
    expect(headers['Retry-After']).toBeGreaterThanOrEqual(1);
    expect(headers['RateLimit-Reset']).toBeGreaterThanOrEqual(1);
  });

  it('isolates buckets per remote IP', async () => {
    const limiter = new TokenBucketLimiter(1, 1);
    const interceptor = new RateLimitInterceptor(limiter);

    // First IP burns its token
    const a1 = buildContext({ ip: '1.1.1.1' });
    await firstValueFrom(interceptor.intercept(a1.ctx, passThroughHandler) as any);

    // Second IP still has a fresh bucket
    const b1 = buildContext({ ip: '2.2.2.2' });
    const result = await firstValueFrom(interceptor.intercept(b1.ctx, passThroughHandler) as any);
    expect(result).toEqual({ ok: true });
    expect(b1.headers['RateLimit-Remaining']).toBe(0); // 1 capacity, just consumed
    expect(b1.headers['Retry-After']).toBeUndefined();

    // First IP is still rate limited
    const a2 = buildContext({ ip: '1.1.1.1' });
    let denied = false;
    try {
      await firstValueFrom(interceptor.intercept(a2.ctx, passThroughHandler) as any);
    } catch {
      denied = true;
    }
    expect(denied).toBe(true);
  });

  it('does not swallow downstream errors', async () => {
    const limiter = new TokenBucketLimiter(5, 1);
    const interceptor = new RateLimitInterceptor(limiter);
    const { ctx } = buildContext({ ip: '3.3.3.3' });

    const failing: CallHandler = {
      handle: () => throwError(() => new Error('boom')),
    };

    await expect(
      lastValueFrom(interceptor.intercept(ctx, failing) as any),
    ).rejects.toThrow('boom');
  });
});
