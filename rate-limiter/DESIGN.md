# Rate Limiter Design — System Design Challenge

## Overview
This repository implements a working prototype of a **Rate Limiter**, a critical component in system design for protecting services from abuse and ensuring fair usage.

The implementation is based on the **Token Bucket** algorithm, as described in *System Design Interview – An Insider's Guide* by Alex Xu, and extended with:
- A **`wait()`** operation (reservation-based queueing) so requests block instead of being rejected.
- A **Redis-backed distributed semaphore** to cap global concurrency across multiple replicas.
- A **PostgreSQL persistence layer** (via TypeORM) for recording Pokemon appearances and computing a ranking.
- A **Redis-based migration leader election** so only one replica runs DB migrations on startup.

The rate limiter is exercised by a Pokemon API wrapper (`GET /random-pokemon`) that calls [PokeAPI](https://pokeapi.co) under tight concurrency and rate constraints.

## Architectural Choices

### 1. Algorithm: Token Bucket with Wait Support
The Token Bucket algorithm was extended to support a `wait()` operation:
- **Waitable Limiter**: If no tokens are available, the limiter calculates the time until the next token is ready and returns a `Promise` that resolves after that duration (using `setTimeout`).
- **Token Reservation**: To support multiple concurrent requests waiting in line, the limiter "reserves" tokens by allowing the token count to go negative. This ensures that the next request waits for a duration that accounts for all previous waiting requests.
- **Queueing Behavior**: This effectively creates a queue where requests are processed at a fixed rate (1 per second by default — `capacity = 1`, `refillRate = 1 token/s`).
- **Per-key buckets**: The limiter stores one `BucketState` per key, so different resources can be rate-limited independently.

See [rate-limiter/src/modules/rate-limiter/infrastructure/token-bucket-limiter.ts](rate-limiter/src/modules/rate-limiter/infrastructure/token-bucket-limiter.ts).

### 2. Redis Distributed Semaphore (Multi-Replica)
To support horizontal scaling, a **Redis-backed distributed semaphore** caps the number of concurrent outbound connections to PokeAPI **globally**, across all replicas:
- **Slot-Based Concurrency**: Uses N Redis keys (`semaphore:{key}:slot:{0..N-1}`) with `SET NX EX` (atomic set-if-not-exists with TTL) to implement a counting semaphore. Default: **2 concurrent connections**.
- **Crash Safety**: Each slot has a TTL (default 30s). If a replica crashes, its slots auto-expire — no manual cleanup, no deadlock risk.
- **Owner-scoped release**: Each `acquire()` returns a unique owner ID (UUID) so `release()` only deletes a slot it still owns. This prevents a slow request from accidentally releasing a slot that was re-acquired by another replica after TTL expiry.
- **Decorator Pattern**: Applied via `@WithSemaphore('pokeapi')` on `PokeApiClient.getRandomPokemon()`, keeping concurrency control as a cross-cutting concern separate from business logic.
- **Dual Limiting**: The Token Bucket (local rate-per-second) and Distributed Semaphore (global concurrency) work in tandem — the decorator acquires a semaphore slot first, then the method body waits for a token bucket token.

See [rate-limiter/src/modules/rate-limiter/infrastructure/redis-distributed-semaphore.ts](rate-limiter/src/modules/rate-limiter/infrastructure/redis-distributed-semaphore.ts) and [rate-limiter/src/modules/rate-limiter/infrastructure/with-semaphore.decorator.ts](rate-limiter/src/modules/rate-limiter/infrastructure/with-semaphore.decorator.ts).

### 3. Persistence Layer (PostgreSQL + TypeORM)
Every successful Pokemon fetch is persisted so we can expose a ranking endpoint:
- **Entities**: `Pokemon` (id, name), `Type` (unique name), `Appearance` (timestamped record, FK to Pokemon). Many-to-many join between `Pokemon` and `Type` via `pokemon_types`.
- **Repository Pattern**: `IPokemonRepository` hides the storage choice from the service. Two implementations exist:
  - `TypeormPokemonRepository` — production, writes to Postgres.
  - `InMemoryPokemonRepository` — used for unit tests.
- **Migrations, not sync**: `synchronize: false`. Schema changes go through TypeORM migrations (`yarn migration:generate`, `yarn migration:run`).
- **Ranking query**: `getRanking()` uses a `COUNT(*) GROUP BY pokemon.id ORDER BY count DESC` to produce `[{ name, appearances }]`, sorted most-frequent-first.

See [rate-limiter/src/modules/pokemon/infrastructure/typeorm-pokemon.repository.ts](rate-limiter/src/modules/pokemon/infrastructure/typeorm-pokemon.repository.ts).

### 4. Migration Leader Election (Redis Mutex)
When running multiple replicas that all boot simultaneously, each container would otherwise try to run migrations in parallel — a classic race condition that can corrupt schema state. To prevent this:
- **Redis mutex via `SET NX EX`** on `migrations:lock` (60s TTL).
- **Leader-only execution**: Only the replica that acquires the lock runs `dataSource.runMigrations()`. The others poll and wait for the lock to release.
- **Owner-scoped release**: Each replica writes a unique owner ID and only deletes the key if it still holds the lock — same pattern as the semaphore, same crash-safety guarantees.
- **Dockerfile CMD**: `yarn migration:run:prod && yarn start:prod` — each container boots this sequence, but only one actually touches the DB.

See [rate-limiter/src/database/run-migrations.ts](rate-limiter/src/database/run-migrations.ts).

### 5. NestJS Modular Integration
The app follows NestJS best practices, with feature modules and DDD-style folders:
- **`RedisModule`** (global) — provides a shared `ioredis` client via `REDIS_CLIENT` token. Reads `REDIS_HOST`/`REDIS_PORT`. Gracefully quits on shutdown.
- **`RateLimiterModule`** (global) — provides both the `RateLimiter` (Token Bucket) and `DistributedSemaphore` (Redis-backed).
- **`PokemonModule`** — encapsulates the Controller, Service, Client (PokeAPI), Repository, and TypeORM entities.
- **Dependency Injection**: String tokens (`'RateLimiter'`, `'DistributedSemaphore'`, `'PokemonClient'`, `'IPokemonRepository'`) decouple interfaces from implementations and make swapping implementations (e.g. in-memory repo for tests) trivial.
- **DDD-style folders**: `pokemon/domain` (entities + interfaces), `pokemon/application` (service), `pokemon/infrastructure` (repository + HTTP client), `pokemon/interface` (controller).

### 6. Pokemon API Client
- `PokeApiClient` fetches a random Pokemon (IDs 1–150) from PokeAPI.
- Decorated with `@WithSemaphore('pokeapi')` for global concurrency control.
- Calls `rateLimiter.wait('pokeapi-global')` inside the method body for local rate limiting.
- Failures are wrapped in `InternalServerErrorException`.

### 7. Observability & Documentation
- **Swagger**: UI at `/api/docs` (powered by `@nestjs/swagger`).
- **Sentry**: `@sentry/nestjs` with profiling and tracing (requires `SENTRY_DSN`).
- **Logging (pino + `nestjs-pino`)**:
  - Structured JSON in production, `pino-pretty` in development (controlled by `NODE_ENV`).
  - Level controlled by `LOG_LEVEL` (default `debug` in dev, `info` in prod).
  - `nestjs-pino` auto-emits one log line per HTTP request with status, method, path, and latency.
  - Every request is assigned a `reqId` (honors an incoming `x-request-id` header, else mints a UUID) — all logs emitted during the request lifecycle share the same ID for correlation.
  - `Authorization`, `Cookie`, and `Set-Cookie` headers are redacted at the logger level.
  - A small framework-agnostic `Logger` interface (`info`/`warn`/`error`, each accepting an optional structured context object) is implemented by `PinoLoggerAdapter`. It's what `TokenBucketLimiter`, `RedisDistributedSemaphore`, and `PokeApiClient` log through, so those classes stay unit-testable with a `NoOpLogger` and don't depend on NestJS.
  - Subsystems get their own `context` field via pino child loggers (`TokenBucketLimiter`, `DistributedSemaphore`, `PokeApiClient`, `Migrations`), so you can filter by component.

## Multi-Replica Architecture

```
┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│  Replica 1  │     │  Replica 2  │     │  Replica 3  │
│   (NestJS)  │     │   (NestJS)  │     │   (NestJS)  │
│             │     │             │     │             │
│ @WithSemaphore    │ @WithSemaphore    │ @WithSemaphore
│     ↓       │     │     ↓       │     │     ↓       │
│ TokenBucket │     │ TokenBucket │     │ TokenBucket │
│ (per-replica)     │ (per-replica)     │ (per-replica)
└──────┬──────┘     └──────┬──────┘     └──────┬──────┘
       │                   │                   │
       └───────────────────┼───────────────────┘
                           ↓
          ┌─────────────────────────────────┐
          │              Redis              │
          │  • semaphore:pokeapi:slot:{0,1} │
          │  • migrations:lock              │
          └────────────────┬────────────────┘
                           ↓
          ┌─────────────────────────────────┐
          │            PostgreSQL           │
          │  pokemons / types / appearances │
          └─────────────────────────────────┘

                    External call
                    ──────────────►  PokeAPI
```

### How the Semaphore Works
1. `PokeApiClient.getRandomPokemon()` is decorated with `@WithSemaphore('pokeapi')`.
2. Before the method body runs, the decorator calls `semaphore.acquire('pokeapi')`, which returns a unique `ownerId`.
3. `acquire()` tries each slot key (`semaphore:pokeapi:slot:0`, `semaphore:pokeapi:slot:1`) with `SET NX EX 30`.
4. If a slot is available, the method proceeds. If not, it polls every ~100 ms until a slot frees up (or `acquireTimeoutMs` is hit).
5. After the method returns (or throws), `semaphore.release('pokeapi', ownerId)` deletes the slot key — but only if the current value still matches `ownerId`.
6. The `try/finally` in the decorator guarantees release even on errors. TTL auto-expiry is the last-resort safety net.

## Trade-offs

| Feature | Trade-off |
|---------|-----------|
| **In-Memory Token Bucket** | High performance and low latency for local rate limiting, but per-replica only. Combined with the distributed semaphore for global control. |
| **Redis Semaphore (`SET NX EX`)** | Simple, battle-tested, crash-safe. Uses polling (not pub/sub) which adds ~100ms latency under contention. Acceptable for typical concurrency levels. |
| **Slot TTL Auto-Expiry** | Prevents deadlocks on crash. If a request legitimately takes longer than TTL, the slot may be released prematurely — mitigated with a generous 30s TTL. |
| **Token Reservation** | Simple queueing logic, but long queues can lead to high memory usage (pending promises) and potential timeouts in upstream HTTP clients. |
| **Decorator Pattern** | Clean separation of concerns, but requires the target class to expose a `distributedSemaphore` property via DI. |
| **TypeORM + Migrations** | Type-safe, declarative schema, good DX. But the extra round-trip of "find-or-create type, find-or-create pokemon, insert appearance" is chatty — acceptable at this scale, would be worth consolidating under load. |
| **Redis migration lock** | Prevents parallel-migration races without needing a Postgres advisory lock. Adds a Redis dependency for the startup path, which we already have anyway. |

## Error Handling & Defensive Design
- **Graceful Failures**: PokeAPI failures are caught and transformed into `InternalServerErrorException`.
- **Validation**: Constructor validation ensures valid rate limits and semaphore configuration (`capacity > 0`, `maxSlots > 0`).
- **DI Isolation**: Callers don't know *how* the rate limit is enforced, only that it *is*.
- **Semaphore Safety**: `try/finally` in the decorator guarantees slot release. TTL auto-expiry is the last-resort safety net. Owner-scoped release prevents double-release bugs.
- **Redis Reconnection**: The `ioredis` client uses exponential backoff retry (`min(times * 200, 2000)` ms).
- **Migration Safety**: Redis mutex with owner-scoped release means migrations never run twice and never deadlock.

## Testing Strategy
The test suite is split into four layers:
- **Unit** (`tests/unit`) — pure logic: `TokenBucketLimiter`, `RedisDistributedSemaphore` (with `ioredis-mock`-style fakes), `WithSemaphore` decorator, `PokeApiClient`, etc.
- **Integration** (`tests/integration`) — service-level with in-memory collaborators.
- **E2E** (`tests/e2e`) — full NestJS app via `supertest`, real Postgres + Redis, PokeAPI mocked with `jest.spyOn(HttpService, 'get')`. Verifies the rate limiter by firing two concurrent requests and asserting the wall-clock time ≥ 1s.
- **Docker integration** (`tests/docker`) — spins up multiple replicas (via `docker compose --scale app=N`), discovers their ports, then hammers them concurrently while polling Redis to assert the semaphore never exceeds `maxSlots`.

## How I Used AI
- Scaffolding NestJS structure.
- Implementing the reservation logic for the Token Bucket.
- Writing integration tests with `supertest`.
- Troubleshooting TypeScript decorator and module resolution issues.
- Designing and implementing the Redis distributed semaphore pattern and migration leader-election.

## Philosophy of Software Design (APOSD)
- **Deep Modules**: `TokenBucketLimiter` exposes `allow` / `wait` / `getLimitStatus` while hiding token math and refill logic. `RedisDistributedSemaphore` exposes `acquire` / `release` while hiding slot management, TTL, ownership, and retry logic.
- **Clear Information Hiding**: Internal `BucketState`, Redis key structure, and polling cadence are private implementation details.
- **Decorator as Abstraction**: `@WithSemaphore` hides the entire acquire/release lifecycle from the client code — a single annotation replaces ~10 lines of try/finally boilerplate per call site.
- **Interface-driven DI**: String tokens + interfaces (`RateLimiter`, `DistributedSemaphore`, `IPokemonRepository`, `PokemonClient`) keep the application ignorant of implementation choices — swapping the rate-limiter or repository is a one-line change in the module.
