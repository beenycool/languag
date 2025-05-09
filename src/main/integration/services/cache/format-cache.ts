/**
 * @file Provides caching for parsed or serialized content specific to file formats.
 */
// import { logger } from '../../../services/logger';

// A simple in-memory cache. For production, consider libraries like 'node-cache' or Redis.
interface CacheEntry<T> {
  value: T;
  expiresAt: number;
  createdAt: number;
}

export interface FormatCacheConfig {
  /** Default Time-To-Live for cache entries in milliseconds. */
  defaultTtlMs: number;
  /** Maximum number of items in the cache. 0 for unlimited (not recommended for basic in-memory). */
  maxItems: number;
  /** Interval in milliseconds to check for and prune expired items. 0 to disable periodic pruning. */
  pruneIntervalMs: number;
}

const DEFAULT_CACHE_CONFIG: FormatCacheConfig = {
  defaultTtlMs: 60 * 60 * 1000, // 1 hour
  maxItems: 1000,
  pruneIntervalMs: 5 * 60 * 1000, // 5 minutes
};

export class FormatCache<T = any> {
  private cache: Map<string, CacheEntry<T>> = new Map();
  private config: FormatCacheConfig;
  private pruneIntervalId?: NodeJS.Timeout;

  constructor(config?: Partial<FormatCacheConfig>) {
    this.config = { ...DEFAULT_CACHE_CONFIG, ...config };
    // logger.info('FormatCache initialized with config:', this.config);
    console.info('FormatCache initialized with config:', this.config);

    if (this.config.pruneIntervalMs > 0) {
      this.pruneIntervalId = setInterval(() => this.pruneExpired(), this.config.pruneIntervalMs);
      // logger.info(`FormatCache: Periodic pruning enabled every ${this.config.pruneIntervalMs}ms.`);
      console.info(`FormatCache: Periodic pruning enabled every ${this.config.pruneIntervalMs}ms.`);
    }
  }

  /**
   * Retrieves an item from the cache.
   * @param key The cache key.
   * @returns The cached value, or undefined if not found or expired.
   */
  get(key: string): T | undefined {
    const entry = this.cache.get(key);
    if (entry) {
      if (Date.now() < entry.expiresAt) {
        // logger.debug(`FormatCache: Cache hit for key '${key}'.`);
        console.debug(`FormatCache: Cache hit for key '${key}'.`);
        return entry.value;
      } else {
        // logger.debug(`FormatCache: Cache expired for key '${key}'. Deleting.`);
        console.debug(`FormatCache: Cache expired for key '${key}'. Deleting.`);
        this.cache.delete(key);
      }
    } else {
      // logger.debug(`FormatCache: Cache miss for key '${key}'.`);
      console.debug(`FormatCache: Cache miss for key '${key}'.`);
    }
    return undefined;
  }

  /**
   * Adds or updates an item in the cache.
   * @param key The cache key.
   * @param value The value to cache.
   * @param ttlMs Optional Time-To-Live for this specific entry in milliseconds. Uses default if not provided.
   */
  set(key: string, value: T, ttlMs?: number): void {
    if (this.config.maxItems > 0 && this.cache.size >= this.config.maxItems && !this.cache.has(key)) {
      // Simple Least Recently Used (LRU) like eviction: remove the oldest entry.
      // A more sophisticated LRU would track access times. Here, we remove the first one iterated.
      const oldestKey = this.cache.keys().next().value;
      if (oldestKey) {
        this.cache.delete(oldestKey);
        // logger.warn(`FormatCache: Max items (${this.config.maxItems}) reached. Evicted oldest entry: '${oldestKey}'.`);
        console.warn(`FormatCache: Max items (${this.config.maxItems}) reached. Evicted oldest entry: '${oldestKey}'.`);
      }
    }

    const effectiveTtl = ttlMs || this.config.defaultTtlMs;
    const entry: CacheEntry<T> = {
      value,
      expiresAt: Date.now() + effectiveTtl,
      createdAt: Date.now(),
    };
    this.cache.set(key, entry);
    // logger.debug(`FormatCache: Item set for key '${key}' with TTL ${effectiveTtl}ms.`);
    console.debug(`FormatCache: Item set for key '${key}' with TTL ${effectiveTtl}ms.`);
  }

  /**
   * Deletes an item from the cache.
   * @param key The cache key.
   * @returns True if an item was deleted, false otherwise.
   */
  delete(key: string): boolean {
    const deleted = this.cache.delete(key);
    if (deleted) {
      // logger.debug(`FormatCache: Item deleted for key '${key}'.`);
      console.debug(`FormatCache: Item deleted for key '${key}'.`);
    }
    return deleted;
  }

  /**
   * Clears all items from the cache.
   */
  clear(): void {
    this.cache.clear();
    // logger.info('FormatCache: Cache cleared.');
    console.info('FormatCache: Cache cleared.');
  }

  /**
   * Returns the current number of items in the cache.
   */
  size(): number {
    return this.cache.size;
  }

  /**
   * Manually prunes expired items from the cache.
   * This is also called periodically if pruneIntervalMs > 0.
   */
  pruneExpired(): void {
    const now = Date.now();
    let prunedCount = 0;
    for (const [key, entry] of this.cache) {
      if (now >= entry.expiresAt) {
        this.cache.delete(key);
        prunedCount++;
      }
    }
    if (prunedCount > 0) {
      // logger.info(`FormatCache: Pruned ${prunedCount} expired items.`);
      console.info(`FormatCache: Pruned ${prunedCount} expired items.`);
    }
  }

  /**
   * Stops the periodic pruning of expired items.
   */
  stopPruning(): void {
    if (this.pruneIntervalId) {
      clearInterval(this.pruneIntervalId);
      this.pruneIntervalId = undefined;
      // logger.info('FormatCache: Stopped periodic pruning.');
      console.info('FormatCache: Stopped periodic pruning.');
    }
  }
}