import { randomUUID } from 'crypto';
import pino, { Logger as PinoNativeLogger } from 'pino';
import type { Params } from 'nestjs-pino';
import type { IncomingMessage } from 'http';

const isProd = process.env.NODE_ENV === 'production';

const baseOptions = {
  level: process.env.LOG_LEVEL ?? (isProd ? 'info' : 'debug'),
  redact: {
    paths: [
      'req.headers.authorization',
      'req.headers.cookie',
      'req.headers["set-cookie"]',
    ],
    remove: true,
  },
  transport: isProd
    ? undefined
    : {
        target: 'pino-pretty',
        options: {
          colorize: true,
          translateTime: 'SYS:HH:MM:ss.l',
          singleLine: true,
          ignore: 'pid,hostname,req,res,responseTime',
          messageFormat: '[{context}] {msg}',
        },
      },
};

/**
 * Shared root pino logger. Use `.child({ context })` to derive a scoped
 * logger for a specific subsystem without paying a new transport cost.
 */
export const rootLogger: PinoNativeLogger = pino(baseOptions);

/**
 * nestjs-pino configuration. Hands pino the already-built `rootLogger`
 * so HTTP logs and application logs share one transport + format.
 *
 * - Auto-assigns a request ID (honors `x-request-id` header, otherwise UUID).
 * - Maps 5xx → error, 4xx → warn, else info.
 */
export const pinoConfig: Params = {
  pinoHttp: {
    logger: rootLogger,
    genReqId: (req: IncomingMessage) => {
      const existing = req.headers['x-request-id'];
      return typeof existing === 'string' && existing.length > 0
        ? existing
        : randomUUID();
    },
    customLogLevel: (_req, res, err) => {
      if (err || res.statusCode >= 500) return 'error';
      if (res.statusCode >= 400) return 'warn';
      return 'info';
    },
  },
};
