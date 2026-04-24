import type { Logger as PinoLogger } from 'pino';

/**
 * Framework-agnostic logger interface used by the rate-limiter primitives.
 * The second argument is structured context — pino's merging object form —
 * so call sites stay easy to search in a log aggregator.
 */
export interface Logger {
  info(message: string, context?: Record<string, unknown>): void;
  warn(message: string, context?: Record<string, unknown>): void;
  error(message: string, context?: Record<string, unknown>): void;
}

export class PinoLoggerAdapter implements Logger {
  constructor(private readonly pino: PinoLogger) {}

  info(message: string, context?: Record<string, unknown>): void {
    context ? this.pino.info(context, message) : this.pino.info(message);
  }
  warn(message: string, context?: Record<string, unknown>): void {
    context ? this.pino.warn(context, message) : this.pino.warn(message);
  }
  error(message: string, context?: Record<string, unknown>): void {
    context ? this.pino.error(context, message) : this.pino.error(message);
  }
}

export class NoOpLogger implements Logger {
  info(): void {}
  warn(): void {}
  error(): void {}
}
