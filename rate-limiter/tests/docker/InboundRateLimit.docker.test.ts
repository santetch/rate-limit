/**
 * Docker Integration Test — Distributed Inbound Rate Limit
 *
 * Verifies that the Redis-backed token bucket enforces the configured
 * capacity/refill *globally* across replicas, not per-replica. Pre-Plan-01,
 * each replica had its own in-process bucket, so the effective global rate
 * was N × configured. This test is the regression guard against that bug.
 *
 * Prerequisites:
 *   docker compose up --build --scale app=3
 *
 * Assumes the docker-compose default rate-limit config:
 *   INBOUND_RATE_LIMIT_CAPACITY (default 10)
 *   INBOUND_RATE_LIMIT_REFILL_PER_SECOND (default 5)
 *
 * Run with: `yarn test:docker`
 */
import { describe, it, expect, beforeAll, afterAll, beforeEach } from '@jest/globals';
import { execSync } from 'child_process';
import Redis from 'ioredis';

interface ContainerInfo {
  name: string;
  port: number;
}

function discoverContainers(): ContainerInfo[] {
  const output = execSync('docker compose ps --format json', {
    cwd: process.env.COMPOSE_DIR || `${__dirname}/../../../`,
    encoding: 'utf-8',
  });

  const trimmed = output.trim();
  const entries: any[] = trimmed.startsWith('[')
    ? JSON.parse(trimmed)
    : trimmed.split('\n').filter(Boolean).map((line) => JSON.parse(line));

  const containers: ContainerInfo[] = [];
  for (const entry of entries) {
    if (entry.Service !== 'app' || entry.State !== 'running') continue;
    let port: number | null = null;
    if (entry.Publishers && Array.isArray(entry.Publishers)) {
      for (const pub of entry.Publishers) {
        if (pub.TargetPort === 3000 && pub.PublishedPort > 0) {
          port = pub.PublishedPort;
          break;
        }
      }
    }
    if (!port && entry.Ports) {
      const match = String(entry.Ports).match(/(\d+)->3000/);
      if (match) port = parseInt(match[1], 10);
    }
    if (port) containers.push({ name: entry.Name, port });
  }
  return containers;
}

async function httpGet(url: string, timeoutMs = 10_000): Promise<{ status: number }> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, { signal: controller.signal });
    // Drain body so the connection is reusable.
    await res.text().catch(() => undefined);
    return { status: res.status };
  } catch {
    return { status: -1 };
  } finally {
    clearTimeout(timer);
  }
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

describe('Docker Integration — Distributed Inbound Rate Limit', () => {
  let containers: ContainerInfo[];
  let redis: Redis;

  // Match docker-compose defaults — kept here so the assertion math is explicit.
  const CAPACITY = Number(process.env.INBOUND_RATE_LIMIT_CAPACITY) || 10;
  const REFILL_PER_SEC = Number(process.env.INBOUND_RATE_LIMIT_REFILL_PER_SECOND) || 5;
  const HAMMER_MS = 5_000;

  beforeAll(async () => {
    containers = discoverContainers();
    console.log(`\n📦 Discovered ${containers.length} container(s):`);
    containers.forEach((c) => console.log(`   • ${c.name} → localhost:${c.port}`));

    if (containers.length < 2) {
      throw new Error(
        'At least 2 app containers must be running. ' +
          'Start with: docker compose up --build --scale app=3',
      );
    }

    redis = new Redis({ host: 'localhost', port: 6379, maxRetriesPerRequest: 3 });
  });

  afterAll(async () => {
    if (redis) await redis.quit();
  });

  beforeEach(async () => {
    // Wipe any leftover bucket state from prior runs so the test starts
    // with a fresh, full bucket. Limits live under `ratelimit:<key>`.
    const keys = await redis.keys('ratelimit:*');
    if (keys.length) await redis.del(...keys);
  });

  it('caps total non-429 responses at the global rate, regardless of replica count', async () => {
    const start = Date.now();
    const responses: number[] = [];

    // One worker per container; each loops as fast as it can for HAMMER_MS.
    // Without coordination, an in-process limiter would allow ≈ replicas × global.
    const workers = containers.map((c) =>
      (async () => {
        while (Date.now() - start < HAMMER_MS) {
          const { status } = await httpGet(`http://localhost:${c.port}/random-pokemon`);
          responses.push(status);
          // Tiny gap to avoid a tight loop hammering one socket.
          await sleep(5);
        }
      })(),
    );

    await Promise.all(workers);
    const elapsed = Date.now() - start;

    const passed = responses.filter((s) => s !== 429 && s !== -1).length;
    const denied = responses.filter((s) => s === 429).length;
    const errors = responses.filter((s) => s === -1).length;

    // Theoretical max with a *global* limiter:
    //   bucket starts full → CAPACITY initial allows
    //   then REFILL_PER_SEC per second for the test duration
    const theoreticalGlobalMax =
      CAPACITY + REFILL_PER_SEC * (elapsed / 1000);

    // Generous slack (50%) absorbs request-timing + clock-skew jitter.
    const upperBound = Math.ceil(theoreticalGlobalMax * 1.5);

    // What the per-replica in-process limiter would have allowed:
    const replicaMultipliedMax = containers.length * theoreticalGlobalMax;

    console.log(`\n📊 Inbound rate-limit fairness:`);
    console.log(`   Replicas: ${containers.length}`);
    console.log(`   Capacity / refill: ${CAPACITY} / ${REFILL_PER_SEC}/s`);
    console.log(`   Hammered for ${elapsed}ms`);
    console.log(`   Total responses: ${responses.length}`);
    console.log(`   Passed (non-429): ${passed}`);
    console.log(`   Denied (429):     ${denied}`);
    console.log(`   Errors:           ${errors}`);
    console.log(`   Global bound:     ≤ ${upperBound} (theoretical ${theoreticalGlobalMax.toFixed(1)})`);
    console.log(`   Old per-replica:  ≈ ${replicaMultipliedMax.toFixed(0)}`);

    // Sanity: hammering hard enough that the bucket actually empties.
    expect(denied).toBeGreaterThan(0);

    // Core assertion: total accepted is bounded by the global config,
    // not multiplied by replica count.
    expect(passed).toBeLessThanOrEqual(upperBound);

    // Defensive: confirm we're well below the broken-limiter outcome.
    expect(passed).toBeLessThan(replicaMultipliedMax * 0.8);
  }, 60_000);

  it('cleans up idle bucket keys via TTL', async () => {
    // Issue exactly one request so a bucket key is created.
    const c = containers[0];
    await httpGet(`http://localhost:${c.port}/random-pokemon`);

    const keys = await redis.keys('ratelimit:*');
    expect(keys.length).toBeGreaterThan(0);

    for (const key of keys) {
      const ttl = await redis.ttl(key);
      // Must have a positive TTL — otherwise idle clients leak entries forever.
      expect(ttl).toBeGreaterThan(0);
      // ceil(capacity / refill * 2) — generous upper bound to absorb config drift.
      expect(ttl).toBeLessThanOrEqual(Math.ceil((CAPACITY / REFILL_PER_SEC) * 2) + 1);
    }
  }, 30_000);
});
