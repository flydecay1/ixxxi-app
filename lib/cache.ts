// lib/cache.ts
// Redis caching layer for performance optimization

import Redis from 'ioredis';

// Initialize Redis client
const getRedisClient = () => {
  const redisUrl = process.env.REDIS_URL;
  
  if (!redisUrl) {
    console.warn('REDIS_URL not configured, caching disabled');
    return null;
  }

  return new Redis(redisUrl, {
    maxRetriesPerRequest: 3,
    retryDelayOnFailover: 100,
    lazyConnect: true,
  });
};

let redis: Redis | null = null;

const getRedis = () => {
  if (!redis) {
    redis = getRedisClient();
  }
  return redis;
};

// Cache key prefixes
const KEYS = {
  TRACK: 'track:',
  ARTIST: 'artist:',
  USER: 'user:',
  PLAYLIST: 'playlist:',
  TRENDING: 'trending:',
  SEARCH: 'search:',
  STATS: 'stats:',
  GENRES: 'genres',
  RADIO: 'radio:',
};

// Default TTLs (in seconds)
const TTL = {
  SHORT: 60,           // 1 minute - realtime data
  MEDIUM: 300,         // 5 minutes - frequently updated
  LONG: 3600,          // 1 hour - semi-static
  DAY: 86400,          // 24 hours - static data
};

// Generic cache operations
export const cache = {
  // Get cached value
  async get<T>(key: string): Promise<T | null> {
    const client = getRedis();
    if (!client) return null;

    try {
      const value = await client.get(key);
      return value ? JSON.parse(value) : null;
    } catch (err) {
      console.error('Cache get error:', err);
      return null;
    }
  },

  // Set cached value
  async set(key: string, value: any, ttl: number = TTL.MEDIUM): Promise<boolean> {
    const client = getRedis();
    if (!client) return false;

    try {
      await client.setex(key, ttl, JSON.stringify(value));
      return true;
    } catch (err) {
      console.error('Cache set error:', err);
      return false;
    }
  },

  // Delete cached value
  async del(key: string): Promise<boolean> {
    const client = getRedis();
    if (!client) return false;

    try {
      await client.del(key);
      return true;
    } catch (err) {
      console.error('Cache del error:', err);
      return false;
    }
  },

  // Delete multiple keys by pattern
  async delPattern(pattern: string): Promise<number> {
    const client = getRedis();
    if (!client) return 0;

    try {
      const keys = await client.keys(pattern);
      if (keys.length === 0) return 0;
      return await client.del(...keys);
    } catch (err) {
      console.error('Cache delPattern error:', err);
      return 0;
    }
  },

  // Get or set (cache-aside pattern)
  async getOrSet<T>(
    key: string,
    fetcher: () => Promise<T>,
    ttl: number = TTL.MEDIUM
  ): Promise<T | null> {
    // Try cache first
    const cached = await this.get<T>(key);
    if (cached !== null) {
      return cached;
    }

    // Fetch fresh data
    try {
      const data = await fetcher();
      await this.set(key, data, ttl);
      return data;
    } catch (err) {
      console.error('Cache getOrSet fetcher error:', err);
      return null;
    }
  },

  // Increment counter
  async incr(key: string, ttl?: number): Promise<number> {
    const client = getRedis();
    if (!client) return 0;

    try {
      const value = await client.incr(key);
      if (ttl && value === 1) {
        await client.expire(key, ttl);
      }
      return value;
    } catch (err) {
      console.error('Cache incr error:', err);
      return 0;
    }
  },
};

// Track-specific caching
export const trackCache = {
  // Get track by ID
  async get(trackId: string) {
    return cache.get(`${KEYS.TRACK}${trackId}`);
  },

  // Set track data
  async set(trackId: string, data: any) {
    return cache.set(`${KEYS.TRACK}${trackId}`, data, TTL.LONG);
  },

  // Invalidate track cache
  async invalidate(trackId: string) {
    return cache.del(`${KEYS.TRACK}${trackId}`);
  },

  // Increment play count
  async incrPlays(trackId: string) {
    return cache.incr(`${KEYS.TRACK}${trackId}:plays`, TTL.DAY);
  },

  // Get play count (cached)
  async getPlays(trackId: string) {
    const client = getRedis();
    if (!client) return 0;
    const value = await client.get(`${KEYS.TRACK}${trackId}:plays`);
    return value ? parseInt(value, 10) : 0;
  },
};

// Artist-specific caching
export const artistCache = {
  async get(artistId: string) {
    return cache.get(`${KEYS.ARTIST}${artistId}`);
  },

  async set(artistId: string, data: any) {
    return cache.set(`${KEYS.ARTIST}${artistId}`, data, TTL.LONG);
  },

  async invalidate(artistId: string) {
    return cache.del(`${KEYS.ARTIST}${artistId}`);
  },
};

// User-specific caching
export const userCache = {
  async get(userId: string) {
    return cache.get(`${KEYS.USER}${userId}`);
  },

  async set(userId: string, data: any) {
    return cache.set(`${KEYS.USER}${userId}`, data, TTL.MEDIUM);
  },

  async invalidate(userId: string) {
    return cache.del(`${KEYS.USER}${userId}`);
  },
};

// Trending/discovery caching
export const trendingCache = {
  // Get trending tracks
  async getTracks(timeframe: string = '24h') {
    return cache.get(`${KEYS.TRENDING}tracks:${timeframe}`);
  },

  // Set trending tracks
  async setTracks(timeframe: string, data: any) {
    const ttl = timeframe === 'realtime' ? TTL.SHORT : TTL.MEDIUM;
    return cache.set(`${KEYS.TRENDING}tracks:${timeframe}`, data, ttl);
  },

  // Get trending artists
  async getArtists(timeframe: string = '24h') {
    return cache.get(`${KEYS.TRENDING}artists:${timeframe}`);
  },

  async setArtists(timeframe: string, data: any) {
    return cache.set(`${KEYS.TRENDING}artists:${timeframe}`, data, TTL.MEDIUM);
  },
};

// Search caching
export const searchCache = {
  // Get cached search results
  async get(query: string, filters?: Record<string, string>) {
    const filterKey = filters ? JSON.stringify(filters) : '';
    const key = `${KEYS.SEARCH}${query}:${filterKey}`;
    return cache.get(key);
  },

  // Cache search results
  async set(query: string, results: any, filters?: Record<string, string>) {
    const filterKey = filters ? JSON.stringify(filters) : '';
    const key = `${KEYS.SEARCH}${query}:${filterKey}`;
    return cache.set(key, results, TTL.MEDIUM);
  },
};

// Genre caching
export const genreCache = {
  async get() {
    return cache.get(KEYS.GENRES);
  },

  async set(data: any) {
    return cache.set(KEYS.GENRES, data, TTL.DAY);
  },
};

// Platform stats caching
export const statsCache = {
  async get(type: string) {
    return cache.get(`${KEYS.STATS}${type}`);
  },

  async set(type: string, data: any, ttl: number = TTL.SHORT) {
    return cache.set(`${KEYS.STATS}${type}`, data, ttl);
  },
};

// Rate limiting helper
export const rateLimit = {
  async check(key: string, limit: number, windowSeconds: number): Promise<boolean> {
    const client = getRedis();
    if (!client) return true; // Allow if Redis unavailable

    const fullKey = `ratelimit:${key}`;
    const count = await cache.incr(fullKey, windowSeconds);
    return count <= limit;
  },

  async remaining(key: string, limit: number): Promise<number> {
    const client = getRedis();
    if (!client) return limit;

    const fullKey = `ratelimit:${key}`;
    const current = await client.get(fullKey);
    return Math.max(0, limit - (current ? parseInt(current, 10) : 0));
  },
};

// Session/token caching
export const sessionCache = {
  async set(token: string, data: any, ttlSeconds: number = 86400) {
    return cache.set(`session:${token}`, data, ttlSeconds);
  },

  async get(token: string) {
    return cache.get(`session:${token}`);
  },

  async del(token: string) {
    return cache.del(`session:${token}`);
  },
};

// Cleanup and utility functions
export const cacheUtils = {
  // Flush all cache (use with caution)
  async flush() {
    const client = getRedis();
    if (!client) return false;

    try {
      await client.flushdb();
      return true;
    } catch (err) {
      console.error('Cache flush error:', err);
      return false;
    }
  },

  // Get cache stats
  async stats() {
    const client = getRedis();
    if (!client) return null;

    try {
      const info = await client.info();
      return info;
    } catch (err) {
      console.error('Cache stats error:', err);
      return null;
    }
  },

  // Ping to check connection
  async ping() {
    const client = getRedis();
    if (!client) return false;

    try {
      const result = await client.ping();
      return result === 'PONG';
    } catch (err) {
      return false;
    }
  },
};

export { KEYS, TTL };
