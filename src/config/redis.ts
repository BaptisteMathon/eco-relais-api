/**
 * Redis client for session management and caching
 */

import Redis from 'ioredis';

const redisUrl = process.env.REDIS_URL || 'redis://localhost:6379';

export const redis = new Redis(redisUrl, {
  maxRetriesPerRequest: 3,
  retryStrategy(times) {
    const delay = Math.min(times * 100, 3000);
    return delay;
  },
});

redis.on('error', (err) => {
  console.error('Redis connection error:', err);
});

redis.on('connect', () => {
  console.log('Redis connected');
});

/**
 * Store session data (e.g. JWT blacklist or rate-limit keys are handled by libraries)
 * Can be used for custom session storage if needed.
 */
export async function setSession(key: string, value: string, ttlSeconds?: number): Promise<void> {
  if (ttlSeconds) {
    await redis.setex(key, ttlSeconds, value);
  } else {
    await redis.set(key, value);
  }
}

export async function getSession(key: string): Promise<string | null> {
  return redis.get(key);
}

export async function deleteSession(key: string): Promise<void> {
  await redis.del(key);
}

export default redis;
