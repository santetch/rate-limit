import Redis from 'ioredis';
import { dataSource } from './data-source';

const LOCK_KEY = 'migrations:lock';
const LOCK_TTL_SECONDS = 60; // auto-expires if the process crashes
const POLL_INTERVAL_MS = 500;
const LOCK_TIMEOUT_MS = 120_000;

/**
 * Acquire a Redis mutex using SET NX EX (atomic set-if-not-exists).
 * Returns the owner ID if the lock was acquired, or null otherwise.
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

  // Use a unique owner ID so each replica knows whether it holds the lock
  const ownerId = `${process.pid}-${Date.now()}`;

  try {
    await redis.connect();

    const started = Date.now();
    let isLeader = false;

    // --- Leader election: race to acquire the mutex ---
    while (Date.now() - started < LOCK_TIMEOUT_MS) {
      isLeader = await tryAcquireLock(redis, ownerId);
      if (isLeader) break;
      console.log(
        'Another replica is running migrations, waiting...',
      );
      await new Promise((resolve) => setTimeout(resolve, POLL_INTERVAL_MS));
    }

    if (!isLeader) {
      console.error(
        `Could not acquire migration lock within ${LOCK_TIMEOUT_MS}ms — giving up.`,
      );
      process.exit(1);
    }

    // --- We are the elected leader: run migrations ---
    console.log('Acquired migration lock, initializing data source...');
    await dataSource.initialize();
    console.log('Running migrations...');
    await dataSource.runMigrations();
    console.log('Migrations complete');
    await dataSource.destroy();
  } catch (err) {
    console.error('Migration error:', err);
    process.exit(1);
  } finally {
    await releaseLock(redis, ownerId).catch(() => {});
    await redis.quit().catch(() => {});
  }
}

runMigrations();
