# Rate Limiter — Pokemon API (System Design Challenge)

A NestJS + TypeScript implementation of a **Token Bucket rate limiter** paired with a **Redis-backed distributed semaphore** for multi-replica deployments. Exercised through a rate-limited wrapper around the public [PokeAPI](https://pokeapi.co).

> For the architecture walkthrough and trade-off discussion, see [rate-limiter/DESIGN.md](rate-limiter/DESIGN.md).

## Stack
- **Runtime**: Node.js 22 (alpine in Docker), Yarn 4 (via Corepack).
- **Framework**: NestJS 11 (`@nestjs/*`, `@nestjs/axios`, `@nestjs/swagger`).
- **Storage**: PostgreSQL 15 via TypeORM (schema managed with migrations).
- **Coordination**: Redis 7 (`ioredis`) — powers the distributed semaphore and the migration leader-election mutex.
- **Testing**: Jest 30 + Supertest.
- **Observability**: Sentry (optional, set `SENTRY_DSN`) and Swagger UI at `/api/docs`.

## Repository Layout
```
rate-limiter/
├── Dockerfile              # Multi-stage build for the NestJS app
├── docker-compose.yml      # Postgres + Redis + app (scalable)
├── package.json            # Yarn scripts (start, test, migrations, docker:up/down)
├── jest.config.js
└── rate-limiter/
    ├── DESIGN.md           # Architecture + trade-offs
    ├── src/
    │   ├── main.ts                     # Bootstrap (Swagger + Sentry)
    │   ├── app.module.ts
    │   ├── database/                   # data-source, migrations, migration runner
    │   └── modules/
    │       ├── pokemon/                # Controller, Service, Repo, PokeAPI client
    │       ├── rate-limiter/           # Token bucket + Redis semaphore + @WithSemaphore
    │       └── redis/                  # Shared ioredis client (global module)
    └── tests/
        ├── unit/           # Pure logic tests
        ├── integration/    # Service-level tests
        ├── e2e/            # Full NestJS app via supertest
        └── docker/         # Multi-replica tests against live containers
```

## Endpoints
| Method | Path                       | Description                                         |
| ------ | -------------------------- | --------------------------------------------------- |
| GET    | `/random-pokemon`          | Fetches a random Pokemon (ID 1–150), rate-limited. |
| GET    | `/random-pokemon/ranking`  | Returns appearance counts sorted most-seen first.   |
| GET    | `/api/docs`                | Swagger UI.                                         |

## Prerequisites
- Docker + Docker Compose (for the quick start below)
- Node.js 22 and Yarn 4 (only needed for running tests / local dev outside Docker)

## Quick Start (Docker — recommended)

Start Postgres, Redis, and the NestJS app (migrations run automatically on startup):

```bash
yarn docker:up        # 1 replica (default)
yarn docker:up 3      # 3 replicas — exercises the distributed semaphore
```

This builds the image and brings everything up. The `app` service has `ports: ["3000"]` (no host port specified), so each replica is assigned a **random host port**. Find them with:

```bash
docker compose ps
# Look at the PORTS column, e.g.  0.0.0.0:54321->3000/tcp
```

Then hit any replica:
```bash
curl http://localhost:<port>/random-pokemon
curl http://localhost:<port>/random-pokemon/ranking
open  http://localhost:<port>/api/docs
```

Tear it all down (including volumes):
```bash
yarn docker:down
```

### Environment variables
All have sensible defaults and are pre-wired in `docker-compose.yml`:

| Variable       | Default       | Used for                             |
| -------------- | ------------- | ------------------------------------ |
| `DB_HOST`      | `localhost`   | Postgres host                        |
| `DB_PORT`      | `5432`        | Postgres port                        |
| `DB_USERNAME`  | `root`        | Postgres user                        |
| `DB_PASSWORD`  | `password`    | Postgres password                    |
| `DB_NAME`      | `pokemon`     | Postgres database                    |
| `REDIS_HOST`   | `localhost`   | Redis host (semaphore + mutex)       |
| `REDIS_PORT`   | `6379`        | Redis port                           |
| `SENTRY_DSN`   | *(empty)*     | Enable Sentry tracing if provided    |

## Local Development (without Docker for the app)

Run just Postgres + Redis in Docker, then run the app locally:
```bash
yarn install
docker compose up -d postgres redis
yarn migration:run
yarn start              # Watch-mode via nest + swc
```

App listens on `http://localhost:3000`. Migrations:
```bash
yarn migration:generate rate-limiter/src/database/migrations/<Name>
yarn migration:run
yarn migration:revert
```

## Testing

All tests assume a clean shell in the repo root.

### Unit tests (no infra required)
Fast, hermetic — mock Redis, HTTP, and DB:
```bash
yarn test:unit
```

### E2E tests (require Postgres + Redis)
Boots the full NestJS app, mocks only the outbound PokeAPI call, hits real Postgres + Redis:
```bash
docker compose up -d postgres redis
yarn migration:run
yarn test:e2e
```
The e2e suite truncates all tables between tests, so it's safe to re-run.

### Full suite
```bash
yarn test               # unit + e2e (needs Postgres + Redis)
yarn test:cov           # with coverage → ./coverage
```

### Multi-replica integration test (Docker)
Proves the distributed semaphore caps concurrency globally across replicas.

```bash
# Terminal 1 — start N replicas and leave them running
yarn docker:up 3

# Terminal 2 — run the test against the live stack
yarn test:docker
```

The test discovers running containers via `docker compose ps`, fires concurrent requests at each one, and polls Redis to assert `peak(semaphore:pokeapi:slot:*) ≤ 2`.

## Quick manual check: is the limiter actually limiting?
With the stack up (`yarn docker:up`), fire two requests at once and watch the wall-clock:
```bash
time (curl -s http://localhost:<port>/random-pokemon > /dev/null &
      curl -s http://localhost:<port>/random-pokemon > /dev/null &
      wait)
```
Expect `real ≥ 1s` — the second request waits for the next token (default rate: 1 req/s per replica).

## Troubleshooting
- **`Could not acquire migration lock`** — another replica crashed mid-migration. Wait 60s for the Redis TTL to expire, or `docker compose exec redis redis-cli DEL migrations:lock`.
- **E2E tests fail with connection errors** — make sure `docker compose up -d postgres redis` is running and `yarn migration:run` has been run at least once.
- **`test:docker` finds <2 containers** — run `yarn docker:up 3` (in another shell) before running the docker test suite.
- **Pokemon ranking is empty** — you need at least one successful `/random-pokemon` call first.

## Problem & Approach
- **Challenge**: Design a Rate Limiter (Alex Xu, *System Design Interview* Vol. 1).
- **Algorithm**: Token Bucket, extended with a reservation-based `wait()` for queueing.
- **Multi-replica**: Redis distributed semaphore caps **global** concurrent outbound PokeAPI calls.
- **Language**: TypeScript on NestJS.

Details, diagrams, and trade-offs: [rate-limiter/DESIGN.md](rate-limiter/DESIGN.md).
