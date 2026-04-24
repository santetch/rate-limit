import Redis from 'ioredis';
import { dataSource } from './data-source';
import { rootLogger } from '../logging/logger.config';

const logger = rootLogger.child({ context: 'Migrations' });

const LOCK_KEY = 'migrations:lock';
const LOCK_TTL_SECONDS = 60; // auto-expires if the process crashes
const POLL_INTERVAL_MS = 500;
const LOCK_TIMEOUT_MS = 120_000;

/**
 * Acquire a Redis mutex using SET NX EX (atomic set-if-not-exists).
 */
async function tryAcquireLock(redis: Redis, ownerId: string): Promise<boolean> {
  const result = await redis.set(
    LOCK_KEY,
    ownerId,
    'EX',
    LOCK_TTL_SECONDS,
    'NX',
  );
  return result === 'OK';
}

async function releaseLock(redis: Redis, ownerId: string): Promise<void> {
  // Only release if we still own the lock (avoids releasing a lock re-acquired by another replica after TTL)
  const current = await redis.get(LOCK_KEY);
  if (current === ownerId) {
    await redis.del(LOCK_KEY);
  }
}

async function runMigrations(): Promise<void> {
  const redis = new Redis({
    host: process.env.REDIS_HOST || 'localhost',
    port: parseInt(process.env.REDIS_PORT as string, 10) || 6379,
    lazyConnect: true,
  });

  const ownerId = `${process.pid}-${Date.now()}`;

  try {
    await redis.connect();

    const started = Date.now();
    let isLeader = false;

    // --- Leader election: race to acquire the mutex ---
    while (Date.now() - started < LOCK_TIMEOUT_MS) {
      isLeader = await tryAcquireLock(redis, ownerId);
      if (isLeader) break;
      logger.info({ ownerId }, 'migration lock held by another replica, waiting');
      await new Promise((resolve) => setTimeout(resolve, POLL_INTERVAL_MS));
    }

    if (!isLeader) {
      logger.error(
        { ownerId, timeoutMs: LOCK_TIMEOUT_MS },
        'could not acquire migration lock, giving up',
      );
      process.exit(1);
    }

    logger.info({ ownerId }, 'migration lock acquired, initializing data source');
    await dataSource.initialize();

    logger.info('running migrations');
    const ran = await dataSource.runMigrations();
    logger.info(
      { count: ran.length, migrations: ran.map((m) => m.name) },
      'migrations complete',
    );
    await dataSource.destroy();
  } catch (err: any) {
    logger.error({ err: { message: err?.message, stack: err?.stack } }, 'migration error');
    process.exit(1);
  } finally {
    await releaseLock(redis, ownerId).catch(() => {});
    await redis.quit().catch(() => {});
  }
}

runMigrations();
