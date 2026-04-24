# Rate Limiter Design - System Design Challenge

## Overview
This repository implements a working prototype of a **Rate Limiter**, a critical component in system design for protecting services from abuse and ensuring fair usage.

The implementation is based on the **Token Bucket** algorithm, as described in "System Design Interview – An Insider's Guide" by Alex Xu, extended with a **Redis Distributed Semaphore** for multi-replica support.

## Architectural Choices

### 1. Algorithm: Token Bucket with Wait Support
I extended the **Token Bucket** algorithm to support a `wait()` operation:
- **Waitable Limiter**: If no tokens are available, the limiter calculates the time until the next token is ready and returns a `Promise` that resolves after that duration (using `setTimeout`).
- **Token Reservation**: To support multiple concurrent requests waiting in line, the limiter "reserves" tokens by allowing the token count to go negative. This ensures that the next request waits for a duration that accounts for all previous waiting requests.
- **Queueing Behavior**: This effectively creates a queue where requests are processed at a fixed rate (1 per second by default).

### 2. Redis Distributed Semaphore (Multi-Replica)
To support horizontal scaling, a **Redis-backed distributed semaphore** controls the maximum number of concurrent outbound connections to the PokeAPI across all replicas:
- **Slot-Based Concurrency**: Uses N Redis keys (`semaphore:{key}:slot:{0..N-1}`) with `SET NX EX` (atomic set-if-not-exists with TTL) to implement a counting semaphore. Default: **2 concurrent connections**.
- **Crash Safety**: Each slot has a TTL (default 30s). If a replica crashes, its slots auto-expire — no manual cleanup or deadlock risk.
- **Decorator Pattern**: Applied via `@WithSemaphore('pokeapi')` on `PokeApiClient.getRandomPokemon()`, keeping concurrency control as a cross-cutting concern separate from business logic.
- **Dual Limiting**: The Token Bucket (local rate-per-second) and Distributed Semaphore (global concurrency) work in tandem — the decorator acquires a semaphore slot first, then the method body waits for a token bucket token.

### 3. NestJS Modular Integration
The application is organized into feature modules to follow NestJS best practices:
- **`RedisModule`**: A global module providing the shared `ioredis` client. Reads `REDIS_HOST`/`REDIS_PORT` from env. Gracefully disconnects on shutdown.
- **`RateLimiterModule`**: A global module that provides both the `RateLimiter` (Token Bucket) and `DistributedSemaphore` (Redis-backed) instances.
- **`PokemonModule`**: Encapsulates all Pokemon-related logic, including the Controller, Service, and the PokeAPI Client.
- **Dependency Injection**: Used NestJS DI with string tokens (e.g., `@Inject('RateLimiter')`, `@Inject('DistributedSemaphore')`) to decouple interfaces from implementations, facilitating easier testing and future-proofing.
- **Directory Structure**:
  - `src/modules/pokemon/`: Controller, Service, Interface, and Client.
  - `src/modules/rate-limiter/`: Module, Interfaces, Token Bucket, Distributed Semaphore, Decorator, and Logger.
  - `src/modules/redis/`: Redis connection module.

### 4. Pokemon API Client
- **Resilient Client**: The `PokeApiClient` fetches random Pokemon from the PokeAPI (IDs 1-150).
- **Integrated Limiting**: The client uses `@WithSemaphore('pokeapi')` for distributed concurrency control and `rateLimiter.wait()` for local rate limiting.

### 5. Observability & Documentation
- **Swagger**: Integrated Swagger UI at `/api/docs` for endpoint documentation.
- **Sentry**: Added Sentry for error tracking and performance monitoring (tracing).
- **Logging**: A custom `ConsoleLogger` tracks allowed, denied, and waiting requests, as well as semaphore acquire/release events.

## Multi-Replica Architecture

```
┌─────────────┐     ┌─────────────┐
│  Replica 1  │     │  Replica 2  │
│  (NestJS)   │     │  (NestJS)   │
│             │     │             │
│ @WithSemaphore    │ @WithSemaphore
│     ↓       │     │     ↓       │
│ TokenBucket │     │ TokenBucket │
│     ↓       │     │     ↓       │
└──────┬──────┘     └──────┬──────┘
       │                   │
       └───────┬───────────┘
               ↓
        ┌─────────────┐
        │    Redis     │
        │  Semaphore   │
        │  (max 2)     │
        └──────┬──────┘
               ↓
        ┌─────────────┐
        │   PokeAPI    │
        └─────────────┘
```

### How the Semaphore Works
1. `PokeApiClient.getRandomPokemon()` is decorated with `@WithSemaphore('pokeapi')`.
2. Before the method body runs, the decorator calls `semaphore.acquire('pokeapi')`.
3. `acquire()` tries each slot key (`semaphore:pokeapi:slot:0`, `semaphore:pokeapi:slot:1`) with `SET NX EX 30`.
4. If a slot is available, the method proceeds. If not, it polls with backoff until a slot frees up.
5. After the method returns (or throws), `semaphore.release()` deletes the slot key.
6. The `try/finally` in the decorator guarantees release even on errors.

## Trade-offs

| Feature | Trade-off |
|---------|-----------|
| **In-Memory Token Bucket** | High performance and low latency for local rate limiting, but per-replica only. Combined with the distributed semaphore for global control. |
| **Redis Semaphore (SET NX EX)** | Simple, battle-tested, crash-safe. But uses polling (not pub/sub) which adds latency under contention. Acceptable for typical concurrency levels. |
| **Slot TTL Auto-Expiry** | Prevents deadlocks on crash. But if a request legitimately takes longer than TTL, the slot may be released prematurely. Mitigated by using a generous TTL (30s). |
| **Token Reservation** | Simple queueing logic, but long queues can lead to high memory usage (promises) and potential timeouts in upstream clients. |
| **Decorator Pattern** | Clean separation of concerns, but requires the target class to expose a `distributedSemaphore` property via DI. |

## Error Handling & Defensive Design
- **Graceful Failures**: PokeAPI failures are caught and transformed into `InternalServerErrorException`.
- **Validation**: Constructor validation ensures valid rate limits and semaphore configuration.
- **DI Isolation**: The application doesn't know *how* the rate limit is enforced, only that it *is*.
- **Semaphore Safety**: `try/finally` in the decorator guarantees slot release. TTL auto-expiry is the last-resort safety net.
- **Redis Reconnection**: The `ioredis` client includes a retry strategy with exponential backoff.

## How I Used AI
- Scaffolding NestJS structure.
- Implementing the "Reservation" logic for the Token Bucket.
- Writing integration tests with `supertest` and fake timers.
- Troubleshooting TypeScript decorator and module resolution issues.
- Designing and implementing the Redis distributed semaphore pattern.

## How to Run

### Local Development
1. Install dependencies: `yarn install`
2. Start infrastructure: `docker compose up postgres redis -d`
3. Run migrations: `yarn migration:run`
4. Start server: `yarn start`

### Docker (Multi-Replica)
```bash
docker compose up --build --scale app=2
```
This starts 2 app replicas sharing the same Redis semaphore (max 2 concurrent PokeAPI connections globally).

### Tests
```bash
yarn test          # All tests
yarn test:unit     # Unit tests only
yarn test:e2e      # E2E tests (requires postgres + redis running)
```

## Philosophy of Software Design (APOSD)
- **Deep Modules**: The `TokenBucketLimiter` provides a simple interface (`allow`, `wait`) while hiding token math and refill logic. The `RedisDistributedSemaphore` provides `acquire`/`release` while hiding slot management, TTL, and retry logic.
- **Clear Information Hiding**: Internal `BucketState`, Redis key structure, and polling mechanics are private implementation details.
- **Decorator as Abstraction**: The `@WithSemaphore` decorator hides the entire acquire/release lifecycle from the client code.
