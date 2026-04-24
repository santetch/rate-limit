/**
 * Docker Integration Test
 *
 * Validates the distributed rate limiter and Redis semaphore across
 * multiple live Docker containers. Must be run while Docker services
 * are up: `docker compose up --build --scale app=3`
 *
 * Run with: `yarn test:docker`
 */
import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import { execSync } from 'child_process';
import Redis from 'ioredis';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

interface ContainerInfo {
  name: string;
  port: number;
}

/**
 * Discover all running `app` service containers and their mapped host ports
 * by parsing `docker compose ps`.
 */
function discoverContainers(): ContainerInfo[] {
  const output = execSync('docker compose ps --format json', {
    cwd: process.env.COMPOSE_DIR || `${__dirname}/../../../`,
    encoding: 'utf-8',
  });

  // `docker compose ps --format json` can output either:
  // - A single JSON array (newer versions)
  // - One JSON object per line (older versions)
  const containers: ContainerInfo[] = [];
  const trimmed = output.trim();

  let entries: any[];
  if (trimmed.startsWith('[')) {
    entries = JSON.parse(trimmed);
  } else {
    entries = trimmed.split('\n').filter(Boolean).map((line) => JSON.parse(line));
  }

  for (const entry of entries) {
    // Only consider the `app` service containers
    if (entry.Service !== 'app') continue;
    if (entry.State !== 'running') continue;

    let port: number | null = null;

    // Publishers is an array of objects in newer docker compose
    if (entry.Publishers && Array.isArray(entry.Publishers)) {
      for (const pub of entry.Publishers) {
        if (pub.TargetPort === 3000 && pub.PublishedPort > 0) {
          port = pub.PublishedPort;
          break;
        }
      }
    }

    // Fallback: parse from Ports string
    if (!port && entry.Ports) {
      const match = String(entry.Ports).match(/(\d+)->3000/);
      if (match) {
        port = parseInt(match[1], 10);
      }
    }

    if (port) {
      containers.push({ name: entry.Name, port });
    }
  }

  return containers;
}

/**
 * HTTP GET helper using native fetch (Node 18+).
 */
async function httpGet(url: string, timeoutMs = 30_000): Promise<{ status: number; body: any; elapsed: number }> {
  const start = Date.now();
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const res = await fetch(url, { signal: controller.signal });
    const body = await res.json();
    return { status: res.status, body, elapsed: Date.now() - start };
  } finally {
    clearTimeout(timer);
  }
}

// ---------------------------------------------------------------------------
// Test Suite
// ---------------------------------------------------------------------------

describe('Docker Integration — Distributed Rate Limiter', () => {
  let containers: ContainerInfo[];
  let redis: Redis;

  beforeAll(async () => {
    // 1. Discover running containers
    containers = discoverContainers();
    console.log(`\n📦 Discovered ${containers.length} container(s):`);
    containers.forEach((c) => console.log(`   • ${c.name} → localhost:${c.port}`));

    if (containers.length < 2) {
      throw new Error(
        'At least 2 app containers must be running. ' +
        'Start with: docker compose up --build --scale app=3',
      );
    }

    // 2. Connect to Redis
    redis = new Redis({
      host: 'localhost',
      port: 6379,
      maxRetriesPerRequest: 3,
    });
  });

  afterAll(async () => {
    if (redis) await redis.quit();
  });

  // -------------------------------------------------------------------------
  // Test 1: Connectivity — every instance is reachable and serving HTTP
  // -------------------------------------------------------------------------
  it('should reach every running container instance', async () => {
    // Use the ranking endpoint for connectivity since it doesn't depend on
    // an external API (PokeAPI). A 200 proves the container is up and serving.
    const results = await Promise.all(
      containers.map(async (c) => {
        try {
          const { status } = await httpGet(`http://localhost:${c.port}/random-pokemon/ranking`);
          return { name: c.name, status, ok: status === 200 };
        } catch (err: any) {
          return { name: c.name, status: -1, ok: false, error: err.message };
        }
      }),
    );

    console.log('\n🏥 Health check results:');
    results.forEach((r) => {
      console.log(`   ${r.ok ? '✅' : '❌'} ${r.name}: HTTP ${r.status}`);
    });

    results.forEach((r) => {
      expect(r.ok).toBe(true);
    });
  });

  // -------------------------------------------------------------------------
  // Test 2: Concurrent requests across all instances are throttled
  // -------------------------------------------------------------------------
  it('should throttle concurrent requests across instances via distributed semaphore', async () => {
    // Clear any stale semaphore keys
    const existingKeys = await redis.keys('semaphore:pokeapi:*');
    if (existingKeys.length) {
      await redis.del(...existingKeys);
    }

    // To observe real throttling, send MORE requests than available semaphore slots
    // and more than 1 per container so each local token bucket must rate-limit.
    // With maxSlots=2 and 1 token/s per bucket, sending 2 requests per container
    // means the second request on each container must wait ~1s for a new token.
    const requestsPerContainer = 2;
    const totalRequests = containers.length * requestsPerContainer;
    console.log(`\n🚀 Firing ${totalRequests} concurrent requests (${requestsPerContainer}/container) across all instances...`);

    const start = Date.now();

    const promises: Promise<any>[] = [];
    for (let round = 0; round < requestsPerContainer; round++) {
      for (const c of containers) {
        promises.push(
          httpGet(`http://localhost:${c.port}/random-pokemon`).then((r) => ({
            ...r,
            name: c.name,
          })),
        );
      }
    }

    const results = await Promise.all(promises);
    const totalDuration = Date.now() - start;

    console.log('\n📊 Concurrent request results:');
    results.forEach((r) => {
      console.log(
        `   ${r.status === 200 ? '✅' : '❌'} ${r.name}: ${r.elapsed}ms — ${r.body?.name || 'ERROR'}`,
      );
    });
    console.log(`   ⏱  Total wall-clock time: ${totalDuration}ms`);

    // Most requests should succeed (allow for occasional PokeAPI failures)
    const successful = results.filter((r) => r.status === 200);
    console.log(`   ✅ Successful: ${successful.length}/${results.length}`);
    expect(successful.length).toBeGreaterThanOrEqual(Math.ceil(results.length * 0.7));

    // With 6 concurrent requests, 2 semaphore slots, and 1 token/s per container,
    // the total duration should be > 1s due to both semaphore contention and
    // per-container rate limiting.
    console.log(`   🔒 Total duration: ${totalDuration}ms (expect > 1000ms due to rate limit + semaphore)`);
    expect(totalDuration).toBeGreaterThan(1000);
  }, 60_000);

  // -------------------------------------------------------------------------
  // Test 3: Redis semaphore never exceeds maxSlots during load
  // -------------------------------------------------------------------------
  it('should never exceed 2 concurrent semaphore slots under load', async () => {
    // Clear semaphore state
    const existingKeys = await redis.keys('semaphore:pokeapi:*');
    if (existingKeys.length) {
      await redis.del(...existingKeys);
    }

    // Strategy: fire many requests while polling Redis semaphore keys
    const totalRequests = Math.max(containers.length * 2, 6);
    const maxObservedSlots: number[] = [];
    let polling = true;

    // Poller: check how many semaphore slots are occupied
    const poller = (async () => {
      while (polling) {
        const keys = await redis.keys('semaphore:pokeapi:slot:*');
        const occupied = keys.length;
        maxObservedSlots.push(occupied);
        await new Promise((r) => setTimeout(r, 50));
      }
    })();

    // Fire requests in round-robin across containers
    console.log(`\n🔥 Firing ${totalRequests} requests in round-robin across ${containers.length} instances...`);

    const promises: Promise<any>[] = [];
    for (let i = 0; i < totalRequests; i++) {
      const c = containers[i % containers.length];
      promises.push(httpGet(`http://localhost:${c.port}/random-pokemon`));
    }

    const results = await Promise.all(promises);
    polling = false;
    await poller;

    const peak = Math.max(...maxObservedSlots);
    const avg = maxObservedSlots.reduce((a, b) => a + b, 0) / maxObservedSlots.length;

    console.log(`\n📈 Semaphore observation during load:`);
    console.log(`   Peak occupied slots: ${peak}`);
    console.log(`   Average occupied slots: ${avg.toFixed(2)}`);
    console.log(`   Samples collected: ${maxObservedSlots.length}`);
    console.log(`   All requests succeeded: ${results.every((r) => r.status === 200)}`);

    // CRITICAL ASSERTION: never more than 2 slots occupied
    expect(peak).toBeLessThanOrEqual(2);

    // All requests should succeed
    results.forEach((r) => {
      expect(r.status).toBe(200);
    });
  }, 120_000);

  // -------------------------------------------------------------------------
  // Test 4: Ranking data is consistent across all replicas
  // -------------------------------------------------------------------------
  it('should show consistent ranking data from any replica', async () => {
    // Hit 3 random pokemon endpoints across different instances
    for (let i = 0; i < 3; i++) {
      const c = containers[i % containers.length];
      await httpGet(`http://localhost:${c.port}/random-pokemon`);
    }

    // Give a moment for DB writes to propagate
    await new Promise((r) => setTimeout(r, 500));

    // Query ranking from every replica — should all return the same data
    const rankings = await Promise.all(
      containers.map(async (c) => {
        const { body } = await httpGet(`http://localhost:${c.port}/random-pokemon/ranking`);
        return { name: c.name, ranking: body };
      }),
    );

    console.log('\n📋 Ranking consistency check:');
    rankings.forEach((r) => {
      console.log(`   ${r.name}: ${JSON.stringify(r.ranking)}`);
    });

    // All replicas should return the same ranking
    const firstRanking = JSON.stringify(rankings[0].ranking);
    rankings.forEach((r) => {
      expect(JSON.stringify(r.ranking)).toBe(firstRanking);
    });

    // Should have at least some appearances
    expect(rankings[0].ranking.length).toBeGreaterThan(0);
  }, 60_000);

  // -------------------------------------------------------------------------
  // Test 5: Burst load across all instances
  // -------------------------------------------------------------------------
  it('should handle burst load across all instances without errors', async () => {
    const burstSize = containers.length * 3;
    console.log(`\n💥 Burst test: ${burstSize} requests across ${containers.length} instances`);

    const start = Date.now();

    const promises: Promise<any>[] = [];
    for (let i = 0; i < burstSize; i++) {
      const c = containers[i % containers.length];
      promises.push(
        httpGet(`http://localhost:${c.port}/random-pokemon`).catch((err) => ({
          status: -1,
          body: { error: err.message },
          elapsed: Date.now() - start,
        })),
      );
    }

    const results = await Promise.all(promises);
    const totalDuration = Date.now() - start;

    const successful = results.filter((r) => r.status === 200);
    const failed = results.filter((r) => r.status !== 200);

    console.log(`\n📊 Burst results:`);
    console.log(`   Total requests: ${burstSize}`);
    console.log(`   Successful: ${successful.length}`);
    console.log(`   Failed: ${failed.length}`);
    console.log(`   Total duration: ${totalDuration}ms`);

    if (failed.length > 0) {
      console.log(`   ⚠️  Failed requests:`);
      failed.forEach((r) => console.log(`      ${JSON.stringify(r.body)}`));
    }

    // At least 80% of requests should succeed (some may timeout under heavy load)
    const successRate = successful.length / burstSize;
    console.log(`   Success rate: ${(successRate * 100).toFixed(1)}%`);
    expect(successRate).toBeGreaterThanOrEqual(0.8);
  }, 120_000);
});
