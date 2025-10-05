import { RETRY_CONFIG } from '../config/constants';
import { logger } from './logger';

interface RetryOptions {
  maxRetries?: number;
  initialDelayMs?: number;
  maxDelayMs?: number;
  backoffMultiplier?: number;
  shouldRetry?: (error: any) => boolean;
}

/**
 * Execute a function with exponential backoff retry logic
 */
export async function withRetry<T>(
  fn: () => Promise<T>,
  options: RetryOptions = {}
): Promise<T> {
  const {
    maxRetries = RETRY_CONFIG.MAX_RETRIES,
    initialDelayMs = RETRY_CONFIG.INITIAL_DELAY_MS,
    maxDelayMs = RETRY_CONFIG.MAX_DELAY_MS,
    backoffMultiplier = RETRY_CONFIG.BACKOFF_MULTIPLIER,
    shouldRetry = () => true,
  } = options;

  let lastError: any;
  let delay = initialDelayMs;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;

      // Check if we should retry this error
      if (!shouldRetry(error)) {
        logger.warn('Error is not retryable', { error, attempt });
        throw error;
      }

      // Check if we've exhausted all retries
      if (attempt === maxRetries) {
        logger.error('Max retries exceeded', { error, maxRetries });
        throw error;
      }

      // Log retry attempt
      logger.warn(`Retry attempt ${attempt}/${maxRetries}`, {
        error: error instanceof Error ? error.message : String(error),
        delayMs: delay,
      });

      // Wait before retrying
      await sleep(delay);

      // Increase delay with exponential backoff
      delay = Math.min(delay * backoffMultiplier, maxDelayMs);
    }
  }

  throw lastError;
}

/**
 * Sleep for specified milliseconds
 */
export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Check if error is retryable (network errors, rate limits, 5xx errors)
 */
export function isRetryableError(error: any): boolean {
  // Network errors
  if (error.code === 'ECONNRESET' || error.code === 'ETIMEDOUT') {
    return true;
  }

  // HTTP errors
  if (error.response) {
    const status = error.response.status;
    // Retry on 429 (rate limit) and 5xx (server errors)
    return status === 429 || (status >= 500 && status < 600);
  }

  // Default to retryable for unknown errors
  return true;
}

/**
 * Retry with jitter to prevent thundering herd
 */
export async function withRetryJitter<T>(
  fn: () => Promise<T>,
  options: RetryOptions = {}
): Promise<T> {
  const {
    maxRetries = RETRY_CONFIG.MAX_RETRIES,
    initialDelayMs = RETRY_CONFIG.INITIAL_DELAY_MS,
    maxDelayMs = RETRY_CONFIG.MAX_DELAY_MS,
    backoffMultiplier = RETRY_CONFIG.BACKOFF_MULTIPLIER,
    shouldRetry = isRetryableError,
  } = options;

  let lastError: any;
  let delay = initialDelayMs;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;

      if (!shouldRetry(error)) {
        throw error;
      }

      if (attempt === maxRetries) {
        logger.error('Max retries exceeded with jitter', { error, maxRetries });
        throw error;
      }

      // Add jitter (random factor between 0.5 and 1.5)
      const jitter = 0.5 + Math.random();
      const jitteredDelay = Math.min(delay * jitter, maxDelayMs);

      logger.warn(`Retry attempt ${attempt}/${maxRetries} with jitter`, {
        error: error instanceof Error ? error.message : String(error),
        delayMs: Math.round(jitteredDelay),
      });

      await sleep(jitteredDelay);

      delay = Math.min(delay * backoffMultiplier, maxDelayMs);
    }
  }

  throw lastError;
}

/**
 * Circuit breaker pattern
 */
export class CircuitBreaker {
  private failureCount = 0;
  private successCount = 0;
  private state: 'CLOSED' | 'OPEN' | 'HALF_OPEN' = 'CLOSED';
  private nextAttempt = 0;

  constructor(
    private threshold: number = 5,
    private timeout: number = 60000, // 1 minute
    private resetCount: number = 2
  ) {}

  async execute<T>(fn: () => Promise<T>): Promise<T> {
    if (this.state === 'OPEN') {
      if (Date.now() < this.nextAttempt) {
        throw new Error('Circuit breaker is OPEN');
      }
      this.state = 'HALF_OPEN';
      logger.info('Circuit breaker entering HALF_OPEN state');
    }

    try {
      const result = await fn();
      this.onSuccess();
      return result;
    } catch (error) {
      this.onFailure();
      throw error;
    }
  }

  private onSuccess(): void {
    this.failureCount = 0;

    if (this.state === 'HALF_OPEN') {
      this.successCount++;
      if (this.successCount >= this.resetCount) {
        this.state = 'CLOSED';
        this.successCount = 0;
        logger.info('Circuit breaker is now CLOSED');
      }
    }
  }

  private onFailure(): void {
    this.failureCount++;
    this.successCount = 0;

    if (this.failureCount >= this.threshold) {
      this.state = 'OPEN';
      this.nextAttempt = Date.now() + this.timeout;
      logger.error('Circuit breaker is now OPEN', {
        failureCount: this.failureCount,
        reopenAt: new Date(this.nextAttempt).toISOString(),
      });
    }
  }

  getState(): string {
    return this.state;
  }

  reset(): void {
    this.state = 'CLOSED';
    this.failureCount = 0;
    this.successCount = 0;
    logger.info('Circuit breaker manually reset');
  }
}
