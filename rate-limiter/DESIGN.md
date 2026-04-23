# Rate Limiter Design - System Design Challenge

## Overview
This repository implements a working prototype of a **Rate Limiter**, a critical component in system design for protecting services from abuse and ensuring fair usage.

The implementation is based on the **Token Bucket** algorithm, as described in "System Design Interview – An Insider’s Guide" by Alex Xu.

## Architectural Choices

### 1. Algorithm: Token Bucket
I chose the **Token Bucket** algorithm for the following reasons:
- **Simplicity**: It is easy to understand and implement correctly.
- **Memory Efficiency**: It only requires storing two values per key: the current token count and the timestamp of the last refill.
- **Burst Handling**: It allows for bursts of traffic up to the bucket's capacity, which is a common requirement for many APIs.
- **Performance**: Check and update operations are O(1).

### 2. Implementation Strategy: Lazy Refill
Instead of having a background thread or timer refilling tokens for every active bucket (which would be inefficient and hard to scale), I implemented **Lazy Refill**. Tokens are only recalculated when a request for a specific key arrives. This ensures that we only consume CPU cycles for active users.

### 3. Language & Stack
- **TypeScript**: Provides strong typing, which helps prevent common bugs in rate-limiting logic (e.g., mixing milliseconds and seconds).
- **Jest**: Used for testing with "Fake Timers" to reliably test time-dependent logic without actual waiting.
- **In-Memory Storage**: For this prototype, I used a `Map`. In a production distributed system, this would be replaced with a fast key-value store like **Redis** using atomic `INCR` or Lua scripts to prevent race conditions.

## Trade-offs

| Feature | Trade-off |
|---------|-----------|
| **In-Memory** | High performance and low latency, but not shared across multiple instances (nodes). For a multi-node setup, Redis is preferred. |
| **Lazy Refill** | Low CPU overhead, but requires a small calculation on every request. |
| **Floating Point Tokens** | Allows for smooth, fractional token replenishment, but requires care with precision (though not an issue for standard rate limits). |

## Error Handling & Defensive Design
- **Validation**: The constructor validates that capacity and refill rates are positive.
- **Independence**: Rate limits are isolated per key (e.g., IP or User ID).
- **Observability**: A `Logger` interface is integrated to track "allowed" vs "denied" requests, which is crucial for production monitoring and debugging.

## How I Used AI
I used Antigravity (powered by Gemini) to:
- Scaffolding the project structure (TypeScript + Jest).
- Implementing the core logic of the Token Bucket algorithm.
- Writing comprehensive tests using `jest.useFakeTimers()`.
- Documenting the design choices in this file.

I have reviewed all the code and ensured it follows the "Philosophy of Software Design" (APOSD) principles:
- **Deep Modules**: The `TokenBucketLimiter` provides a simple interface (`allow`) while hiding the complexity of token math and refill logic.
- **Clear Information Hiding**: The internal `BucketState` and refill logic are private.

## How to Run
1. Install dependencies: `yarn install`
2. Run tests: `yarn test`
