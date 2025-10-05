import { createClient, RedisClientType } from 'redis';
import dotenv from 'dotenv';
import { logger } from '../utils/logger';

dotenv.config();

let redisClient: RedisClientType | null = null;

/**
 * Initialize Redis client
 */
export async function initRedis(): Promise<RedisClientType> {
  if (redisClient) {
    return redisClient;
  }

  redisClient = createClient({
    url: process.env.REDIS_URL || 'redis://localhost:6379',
    socket: {
      reconnectStrategy: (retries) => {
        if (retries > 10) {
          logger.error('Redis reconnection failed after 10 attempts');
          return new Error('Redis reconnection limit exceeded');
        }
        const delay = Math.min(retries * 100, 3000);
        logger.warn(`Redis reconnecting in ${delay}ms (attempt ${retries})`);
        return delay;
      },
    },
  });

  redisClient.on('error', (err) => {
    logger.error('Redis client error', { error: err });
  });

  redisClient.on('connect', () => {
    logger.info('Redis client connected');
  });

  redisClient.on('reconnecting', () => {
    logger.warn('Redis client reconnecting');
  });

  redisClient.on('ready', () => {
    logger.info('Redis client ready');
  });

  await redisClient.connect();

  return redisClient;
}

/**
 * Get Redis client instance
 */
export function getRedisClient(): RedisClientType {
  if (!redisClient) {
    throw new Error('Redis client not initialized. Call initRedis() first.');
  }
  return redisClient;
}

/**
 * Close Redis connection
 */
export async function closeRedis() {
  if (redisClient) {
    await redisClient.quit();
    redisClient = null;
    logger.info('Redis connection closed');
  }
}

/**
 * Cache-aside pattern: Get from cache or execute callback
 */
export async function cacheAside<T>(
  key: string,
  ttl: number,
  fetchFn: () => Promise<T>
): Promise<T> {
  const client = getRedisClient();

  try {
    // Try to get from cache
    const cached = await client.get(key);
    if (cached) {
      logger.debug('Cache hit', { key });
      return JSON.parse(cached) as T;
    }

    // Cache miss - fetch data
    logger.debug('Cache miss', { key });
    const data = await fetchFn();

    // Store in cache
    await client.setEx(key, ttl, JSON.stringify(data));

    return data;
  } catch (error) {
    logger.error('Cache operation failed', { key, error });
    // Fallback to fetching without cache
    return fetchFn();
  }
}

/**
 * Set a value in cache
 */
export async function setCache(
  key: string,
  value: any,
  ttl: number
): Promise<void> {
  const client = getRedisClient();
  try {
    await client.setEx(key, ttl, JSON.stringify(value));
    logger.debug('Cache set', { key, ttl });
  } catch (error) {
    logger.error('Cache set failed', { key, error });
  }
}

/**
 * Get a value from cache
 */
export async function getCache<T>(key: string): Promise<T | null> {
  const client = getRedisClient();
  try {
    const cached = await client.get(key);
    if (cached) {
      logger.debug('Cache retrieved', { key });
      return JSON.parse(cached) as T;
    }
    return null;
  } catch (error) {
    logger.error('Cache get failed', { key, error });
    return null;
  }
}

/**
 * Delete a key from cache
 */
export async function deleteCache(key: string): Promise<void> {
  const client = getRedisClient();
  try {
    await client.del(key);
    logger.debug('Cache deleted', { key });
  } catch (error) {
    logger.error('Cache delete failed', { key, error });
  }
}

/**
 * Delete all keys matching a pattern
 */
export async function deleteCachePattern(pattern: string): Promise<void> {
  const client = getRedisClient();
  try {
    const keys = await client.keys(pattern);
    if (keys.length > 0) {
      await client.del(keys);
      logger.debug('Cache pattern deleted', { pattern, count: keys.length });
    }
  } catch (error) {
    logger.error('Cache pattern delete failed', { pattern, error });
  }
}

/**
 * Test Redis connection
 */
export async function testRedisConnection(): Promise<boolean> {
  try {
    const client = getRedisClient();
    const pong = await client.ping();
    logger.info('Redis connection test successful', { response: pong });
    return pong === 'PONG';
  } catch (error) {
    logger.error('Redis connection test failed', { error });
    return false;
  }
}
