/**
 * Caching layer for Redis integration
 * Provides simple cache interface with TTL support
 */

export interface CacheOptions {
  ttl?: number; // Time to live in seconds (default: 3600)
  prefix?: string;
}

export interface CacheStats {
  hits: number;
  misses: number;
  hitRate: number;
}

type CacheEntry = {
  value: unknown;
  expiresAt: number;
};

/**
 * In-memory cache implementation (for development/testing)
 * Replace with Redis client in production
 */
export class CacheService {
  private cache = new Map<string, CacheEntry>();
  private stats = { hits: 0, misses: 0 };
  private prefix: string;

  constructor(prefix: string = 'cache:') {
    this.prefix = prefix;
  }

  /**
   * Get value from cache
   */
  async get<T = unknown>(key: string): Promise<T | null> {
    const fullKey = this.prefix + key;
    const entry = this.cache.get(fullKey);

    if (!entry) {
      this.stats.misses++;
      return null;
    }

    // Check if expired
    if (entry.expiresAt < Date.now()) {
      this.cache.delete(fullKey);
      this.stats.misses++;
      return null;
    }

    this.stats.hits++;
    return entry.value as T;
  }

  /**
   * Set value in cache with optional TTL
   */
  async set(key: string, value: unknown, ttl: number = 3600): Promise<void> {
    const fullKey = this.prefix + key;
    const expiresAt = Date.now() + ttl * 1000;
    this.cache.set(fullKey, { value, expiresAt });
  }

  /**
   * Delete value from cache
   */
  async del(key: string): Promise<void> {
    const fullKey = this.prefix + key;
    this.cache.delete(fullKey);
  }

  /**
   * Clear all cached values
   */
  async clear(): Promise<void> {
    this.cache.clear();
  }

  /**
   * Get cache statistics
   */
  getStats(): CacheStats {
    const total = this.stats.hits + this.stats.misses;
    return {
      hits: this.stats.hits,
      misses: this.stats.misses,
      hitRate: total > 0 ? this.stats.hits / total : 0
    };
  }

  /**
   * Reset statistics
   */
  resetStats(): void {
    this.stats = { hits: 0, misses: 0 };
  }

  /**
   * Get cache size
   */
  size(): number {
    return this.cache.size;
  }
}

/**
 * Cache wrapper for function results
 */
export const cacheable = (
  cacheService: CacheService,
  options: CacheOptions = {}
) => {
  return function <TArgs extends unknown[], TResult>(
    _target: object,
    propertyKey: string,
    descriptor: TypedPropertyDescriptor<(...args: TArgs) => TResult | Promise<TResult>>
  ) {
    const originalMethod = descriptor.value;
    if (!originalMethod) return descriptor;
    const { ttl = 3600, prefix = propertyKey } = options;

    descriptor.value = async function (...args: TArgs): Promise<TResult> {
      const cacheKey = `${prefix}:${JSON.stringify(args)}`;

      // Try to get from cache
      const cached = await cacheService.get<TResult>(cacheKey);
      if (cached !== null) {
        return cached;
      }

      // Call original method
      const result = await originalMethod.apply(this, args);

      // Store in cache
      await cacheService.set(cacheKey, result, ttl);

      return result;
    };

    return descriptor;
  };
};

/**
 * Singleton cache instance
 */
let cacheInstance: CacheService | null = null;

export const getCacheService = (prefix?: string): CacheService => {
  if (!cacheInstance) {
    cacheInstance = new CacheService(prefix);
  }
  return cacheInstance;
};
