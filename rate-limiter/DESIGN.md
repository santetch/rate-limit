# Rate Limiter Design - System Design Challenge

## Overview
This repository implements a working prototype of a **Rate Limiter**, a critical component in system design for protecting services from abuse and ensuring fair usage.

The implementation is based on the **Token Bucket** algorithm, as described in "System Design Interview – An Insider’s Guide" by Alex Xu.

## Architectural Choices

### 1. Algorithm: Token Bucket with Wait Support
I extended the **Token Bucket** algorithm to support a `wait()` operation:
- **Waitable Limiter**: If no tokens are available, the limiter calculates the time until the next token is ready and returns a `Promise` that resolves after that duration (using `setTimeout`).
- **Token Reservation**: To support multiple concurrent requests waiting in line, the limiter "reserves" tokens by allowing the token count to go negative. This ensures that the next request waits for a duration that accounts for all previous waiting requests.
- **Queueing Behavior**: This effectively creates a queue where requests are processed at a fixed rate (1 per second by default).

### 2. NestJS Modular Integration
The application is organized into feature modules to follow NestJS best practices:
- **`RateLimiterModule`**: A global module that provides the `RateLimiter` instance. This allows any other module to easily inject the rate limiter.
- **`PokemonModule`**: Encapsulates all Pokemon-related logic, including the Controller, Service, and the PokeAPI Client.
- **Dependency Injection**: Used NestJS DI with string tokens (e.g., `@Inject('RateLimiter')`) to decouple interfaces from implementations, facilitating easier testing and future-proofing.
- **Directory Structure**:
  - `src/modules/pokemon/`: Controller, Service, Interface, and Client.
  - `src/modules/rate-limiter/`: Module, Interface, Limiter implementation, and Logger.

### 3. Pokemon API Client
- **Resilient Client**: The `PokeApiClient` fetches random Pokemon from the PokeAPI (IDs 1-150).
- **Integrated Limiting**: The client automatically calls `rateLimiter.wait()` before making the external HTTP call, ensuring compliance with the specified rate limit.

### 4. Observability & Documentation
- **Swagger**: Integrated Swagger UI at `/api/docs` for endpoint documentation.
- **Sentry**: Added Sentry for error tracking and performance monitoring (tracing).
- **Logging**: A custom `ConsoleLogger` tracks allowed, denied, and waiting requests.

## Trade-offs

| Feature | Trade-off |
|---------|-----------|
| **In-Memory** | High performance and low latency, but not shared across multiple instances (nodes). For a multi-node setup, Redis is preferred. |
| **Token Reservation** | Simple queueing logic, but long queues can lead to high memory usage (promises) and potential timeouts in upstream clients. |
| **Floating Point Tokens** | Allows for smooth, fractional token replenishment, but requires care with precision (though not an issue for standard rate limits). |

## Error Handling & Defensive Design
- **Graceful Failures**: PokeAPI failures are caught and transformed into `InternalServerErrorException`.
- **Validation**: Constructor validation ensures valid rate limits.
- **DI Isolation**: The application doesn't know *how* the rate limit is enforced, only that it *is*.

## How I Used AI
- Scaffolding NestJS structure.
- Implementing the "Reservation" logic for the Token Bucket.
- Writing integration tests with `supertest` and fake timers.
- Troubleshooting TypeScript decorator and module resolution issues.

## How to Run
1. Install dependencies: `yarn install`
2. Run tests: `yarn test`
3. Start server: `yarn start` (or `npx ts-node rate-limiter/src/main.ts`)


I have reviewed all the code and ensured it follows the "Philosophy of Software Design" (APOSD) principles:
- **Deep Modules**: The `TokenBucketLimiter` provides a simple interface (`allow`) while hiding the complexity of token math and refill logic.
- **Clear Information Hiding**: The internal `BucketState` and refill logic are private.

## How to Run
1. Install dependencies: `yarn install`
2. Run tests: `yarn test`
