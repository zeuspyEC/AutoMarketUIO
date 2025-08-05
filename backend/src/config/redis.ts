import { createClient } from 'redis';
import { logger } from '../utils/logger';

// Parse Redis URL
const redisUrl = process.env.REDIS_URL || 'redis://localhost:6379';

// Create Redis client
const redisClient = createClient({
  url: redisUrl,
  socket: {
    reconnectStrategy: (retries) => {
      if (retries > 10) {
        logger.error('Redis: Too many reconnection attempts');
        return new Error('Too many reconnection attempts');
      }
      const delay = Math.min(retries * 100, 3000);
      logger.info(`Redis: Reconnecting in ${delay}ms...`);
      return delay;
    },
  },
});

// Handle Redis events
redisClient.on('connect', () => {
  logger.info('Redis: Connected successfully');
});

redisClient.on('ready', () => {
  logger.info('Redis: Ready to accept commands');
});

redisClient.on('error', (error) => {
  logger.error('Redis error:', error);
});

redisClient.on('reconnecting', () => {
  logger.warn('Redis: Reconnecting...');
});

// Connect to Redis
(async () => {
  try {
    await redisClient.connect();
  } catch (error) {
    logger.error('Failed to connect to Redis:', error);
    // Don't exit the process, let the app run without cache
  }
})();

// Cache helper functions
export const cache = {
  async get<T>(key: string): Promise<T | null> {
    try {
      const value = await redisClient.get(key);
      return value ? JSON.parse(value) : null;
    } catch (error) {
      logger.error(`Cache get error for key ${key}:`, error);
      return null;
    }
  },

  async set(key: string, value: any, ttl?: number): Promise<void> {
    try {
      const serialized = JSON.stringify(value);
      if (ttl) {
        await redisClient.setEx(key, ttl, serialized);
      } else {
        await redisClient.set(key, serialized);
      }
    } catch (error) {
      logger.error(`Cache set error for key ${key}:`, error);
    }
  },

  async del(key: string | string[]): Promise<void> {
    try {
      if (Array.isArray(key)) {
        await redisClient.del(key);
      } else {
        await redisClient.del(key);
      }
    } catch (error) {
      logger.error(`Cache delete error for key ${key}:`, error);
    }
  },

  async exists(key: string): Promise<boolean> {
    try {
      const result = await redisClient.exists(key);
      return result === 1;
    } catch (error) {
      logger.error(`Cache exists error for key ${key}:`, error);
      return false;
    }
  },

  async expire(key: string, seconds: number): Promise<void> {
    try {
      await redisClient.expire(key, seconds);
    } catch (error) {
      logger.error(`Cache expire error for key ${key}:`, error);
    }
  },

  async keys(pattern: string): Promise<string[]> {
    try {
      return await redisClient.keys(pattern);
    } catch (error) {
      logger.error(`Cache keys error for pattern ${pattern}:`, error);
      return [];
    }
  },

  async flush(): Promise<void> {
    try {
      await redisClient.flushAll();
      logger.warn('Cache flushed');
    } catch (error) {
      logger.error('Cache flush error:', error);
    }
  },

  // Increment counter
  async incr(key: string, by: number = 1): Promise<number> {
    try {
      if (by === 1) {
        return await redisClient.incr(key);
      } else {
        return await redisClient.incrBy(key, by);
      }
    } catch (error) {
      logger.error(`Cache increment error for key ${key}:`, error);
      return 0;
    }
  },

  // Decrement counter
  async decr(key: string, by: number = 1): Promise<number> {
    try {
      if (by === 1) {
        return await redisClient.decr(key);
      } else {
        return await redisClient.decrBy(key, by);
      }
    } catch (error) {
      logger.error(`Cache decrement error for key ${key}:`, error);
      return 0;
    }
  },

  // Set operations
  async sadd(key: string, members: string | string[]): Promise<number> {
    try {
      if (Array.isArray(members)) {
        return await redisClient.sAdd(key, members);
      } else {
        return await redisClient.sAdd(key, members);
      }
    } catch (error) {
      logger.error(`Cache sadd error for key ${key}:`, error);
      return 0;
    }
  },

  async srem(key: string, members: string | string[]): Promise<number> {
    try {
      if (Array.isArray(members)) {
        return await redisClient.sRem(key, members);
      } else {
        return await redisClient.sRem(key, members);
      }
    } catch (error) {
      logger.error(`Cache srem error for key ${key}:`, error);
      return 0;
    }
  },

  async smembers(key: string): Promise<string[]> {
    try {
      return await redisClient.sMembers(key);
    } catch (error) {
      logger.error(`Cache smembers error for key ${key}:`, error);
      return [];
    }
  },

  async sismember(key: string, member: string): Promise<boolean> {
    try {
      return await redisClient.sIsMember(key, member);
    } catch (error) {
      logger.error(`Cache sismember error for key ${key}:`, error);
      return false;
    }
  },
};

// Cache key generators
export const cacheKeys = {
  vehicle: (id: string) => `vehicle:${id}`,
  vehicleList: (filters: string) => `vehicles:list:${filters}`,
  user: (id: string) => `user:${id}`,
  userProfile: (id: string) => `user:profile:${id}`,
  conversation: (id: string) => `conversation:${id}`,
  favorites: (userId: string) => `favorites:${userId}`,
  searchResults: (query: string) => `search:${query}`,
  popularVehicles: () => 'vehicles:popular',
  brands: () => 'brands:all',
  models: (brandId: string) => `models:${brandId}`,
  statistics: {
    vehicle: (id: string) => `stats:vehicle:${id}`,
    user: (id: string) => `stats:user:${id}`,
    global: () => 'stats:global',
  },
};

// Cache TTL values (in seconds)
export const cacheTTL = {
  short: 300, // 5 minutes
  medium: 3600, // 1 hour
  long: 86400, // 24 hours
  week: 604800, // 7 days
};

export { redisClient };
