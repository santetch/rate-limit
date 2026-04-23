"use strict";
Object.defineProperty(exports, "__esModule", {
    value: true
});
Object.defineProperty(exports, "TokenBucketLimiter", {
    enumerable: true,
    get: function() {
        return TokenBucketLimiter;
    }
});
const _logger = require("./logger");
let TokenBucketLimiter = class TokenBucketLimiter {
    async allow(key) {
        const now = Date.now();
        const state = this.getOrInitializeBucket(key, now);
        this.refill(state, now);
        if (state.tokens >= 1) {
            state.tokens -= 1;
            this.logger.info(`Allowed request for key: ${key}. Tokens remaining: ${Math.floor(state.tokens)}`);
            return true;
        }
        this.logger.warn(`Rate limit exceeded for key: ${key}`);
        return false;
    }
    /**
   * Waits until a token is available and then consumes it.
   */ async wait(key) {
        const now = Date.now();
        const state = this.getOrInitializeBucket(key, now);
        this.refill(state, now);
        if (state.tokens >= 1) {
            state.tokens -= 1;
            return;
        }
        // Calculate when the next token will be available
        // We also need to account for other requests waiting in line
        // To do this, we "reserve" a token by allowing state.tokens to go negative
        state.tokens -= 1;
        const waitTime = Math.abs(state.tokens) / this.refillRate;
        this.logger.info(`Key ${key} is waiting for ${Math.round(waitTime)}ms`);
        return new Promise((resolve)=>{
            setTimeout(resolve, waitTime);
        });
    }
    async getLimitStatus(key) {
        const now = Date.now();
        const state = this.getOrInitializeBucket(key, now);
        const elapsedTime = now - state.lastRefillTime;
        const tokensToAdd = elapsedTime * this.refillRate;
        const currentTokens = Math.min(this.capacity, state.tokens + tokensToAdd);
        let resetTime = now;
        if (currentTokens < this.capacity) {
            const missingTokens = this.capacity - currentTokens;
            resetTime = now + missingTokens / this.refillRate;
        }
        return {
            allowed: currentTokens >= 1,
            remaining: Math.max(0, Math.floor(currentTokens)),
            limit: this.capacity,
            resetTime: Math.ceil(resetTime)
        };
    }
    getOrInitializeBucket(key, now) {
        let state = this.buckets.get(key);
        if (!state) {
            state = {
                tokens: this.capacity,
                lastRefillTime: now
            };
            this.buckets.set(key, state);
        }
        return state;
    }
    refill(state, now) {
        const elapsedTime = now - state.lastRefillTime;
        const tokensToAdd = elapsedTime * this.refillRate;
        // We allow tokens to be negative if they are "reserved" by wait()
        // but when refilling, we cap it at capacity
        state.tokens = Math.min(this.capacity, state.tokens + tokensToAdd);
        state.lastRefillTime = now;
    }
    constructor(capacity, refillRatePerSecond, logger = new _logger.NoOpLogger()){
        if (capacity <= 0) throw new Error('Capacity must be greater than 0');
        if (refillRatePerSecond <= 0) throw new Error('Refill rate must be greater than 0');
        this.buckets = new Map();
        this.capacity = capacity;
        this.refillRate = refillRatePerSecond / 1000;
        this.logger = logger;
    }
};
