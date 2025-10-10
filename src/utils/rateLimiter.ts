import { logger } from './logger';

interface RateLimiterOptions {
  maxRequests: number;
  intervalMs: number;
}

/**
 * Token bucket rate limiter
 */
export class RateLimiter {
  private tokens: number;
  private maxTokens: number;
  private refillRate: number;
  private lastRefill: number;
  private queue: Array<{
    resolve: () => void;
    reject: (error: Error) => void;
  }> = [];

  constructor(options: RateLimiterOptions) {
    this.maxTokens = options.maxRequests;
    this.tokens = this.maxTokens;
    this.refillRate = options.maxRequests / options.intervalMs;
    this.lastRefill = Date.now();
  }

  /**
   * Refill tokens based on time passed
   */
  private refill(): void {
    const now = Date.now();
    const timePassed = now - this.lastRefill;
    const tokensToAdd = timePassed * this.refillRate;

    this.tokens = Math.min(this.maxTokens, this.tokens + tokensToAdd);
    this.lastRefill = now;
  }

  /**
   * Process queued requests
   */
  private processQueue(): void {
    while (this.queue.length > 0 && this.tokens >= 1) {
      const request = this.queue.shift();
      if (request) {
        this.tokens -= 1;
        request.resolve();
      }
    }
  }

  /**
   * Wait for available token
   */
  async acquire(): Promise<void> {
    this.refill();

    if (this.tokens >= 1) {
      this.tokens -= 1;
      return Promise.resolve();
    }

    // Queue the request
    return new Promise((resolve, reject) => {
      this.queue.push({ resolve, reject });

      // Set timeout to process queue
      setTimeout(() => {
        this.refill();
        this.processQueue();
      }, 1000 / this.refillRate);
    });
  }

  /**
   * Get current token count
   */
  getAvailableTokens(): number {
    this.refill();
    return Math.floor(this.tokens);
  }
}

// Create rate limiters for different APIs
export const rateLimiters = {
  coinGecko: new RateLimiter({ maxRequests: 50, intervalMs: 60000 }), // 50 req/min
  binance: new RateLimiter({ maxRequests: 1200, intervalMs: 60000 }), // 1200 req/min
  coinbase: new RateLimiter({ maxRequests: 10000, intervalMs: 3600000 }), // 10000 req/hour
  reddit: new RateLimiter({ maxRequests: 60, intervalMs: 60000 }), // 60 req/min
  cryptoPanic: new RateLimiter({ maxRequests: 100, intervalMs: 60000 }), // 100 req/min
  alphaVantage: new RateLimiter({ maxRequests: 5, intervalMs: 60000 }), // 5 req/min
  etherscan: new RateLimiter({ maxRequests: 5, intervalMs: 60000 }), // 5 req/min
  openai: new RateLimiter({ maxRequests: 500, intervalMs: 60000 }), // 500 req/min
  anthropic: new RateLimiter({ maxRequests: 1000, intervalMs: 60000 }), // 1000 req/min
};

/**
 * Execute a function with rate limiting
 */
export async function withRateLimit<T>(
  limiter: RateLimiter,
  fn: () => Promise<T>,
  apiName: string
): Promise<T> {
  await limiter.acquire();
  logger.debug(`Rate limit acquired for ${apiName}`, {
    availableTokens: limiter.getAvailableTokens(),
  });
  return fn();
}
