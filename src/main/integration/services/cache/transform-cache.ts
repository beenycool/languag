/**
 * @file Provides caching for content transformation results.
 */
// import { logger } from '../../../services/logger';

// This cache is very similar to FormatCache.
// Depending on specific needs, it could inherit from a base cache class
// or FormatCache could be made generic enough to be reused directly.
// For this exercise, we'll define it separately but with similar logic.

interface CacheEntry<T> {
  value: T;
  expiresAt: number;
  createdAt: number;
}

export interface TransformCacheConfig {
  /** Default Time-To-Live for cache entries in milliseconds. */
  defaultTtlMs: number;
  /** Maximum number of items in the cache. 0 for unlimited. */
  maxItems: number;
  /** Interval in milliseconds to check for and prune expired items. 0 to disable. */
  pruneIntervalMs: number;
}

const DEFAULT_TRANSFORM_CACHE_CONFIG: TransformCacheConfig = {
  defaultTtlMs: 30 * 60 * 1000, // 30 minutes (transformations might be more volatile or costly)
  maxItems: 500,
  pruneIntervalMs: 5 * 60 * 1000, // 5 minutes
};

// T is expected to be Buffer | string for transformed content
export class TransformCache<T extends Buffer | string = Buffer | string> {
  private cache: Map<string, CacheEntry<T>> = new Map();
  private config: TransformCacheConfig;
  private pruneIntervalId?: NodeJS.Timeout;

  constructor(config?: Partial<TransformCacheConfig>) {
    this.config = { ...DEFAULT_TRANSFORM_CACHE_CONFIG, ...config };
    // logger.info('TransformCache initialized with config:', this.config);
    console.info('TransformCache initialized with config:', this.config);

    if (this.config.pruneIntervalMs > 0) {
      this.pruneIntervalId = setInterval(() => this.pruneExpired(), this.config.pruneIntervalMs);
      // logger.info(`TransformCache: Periodic pruning enabled every ${this.config.pruneIntervalMs}ms.`);
      console.info(`TransformCache: Periodic pruning enabled every ${this.config.pruneIntervalMs}ms.`);
    }
  }

  get(key: string): T | undefined {
    const entry = this.cache.get(key);
    if (entry) {
      if (Date.now() < entry.expiresAt) {
        // logger.debug(`TransformCache: Cache hit for key '${key}'.`);
        console.debug(`TransformCache: Cache hit for key '${key}'.`);
        return entry.value;
      } else {
        // logger.debug(`TransformCache: Cache expired for key '${key}'. Deleting.`);
        console.debug(`TransformCache: Cache expired for key '${key}'. Deleting.`);
        this.cache.delete(key);
      }
    } else {
      // logger.debug(`TransformCache: Cache miss for key '${key}'.`);
      console.debug(`TransformCache: Cache miss for key '${key}'.`);
    }
    return undefined;
  }

  set(key: string, value: T, ttlMs?: number): void {
    if (this.config.maxItems > 0 && this.cache.size >= this.config.maxItems && !this.cache.has(key)) {
      const oldestKey = this.cache.keys().next().value;
      if (oldestKey) {
        this.cache.delete(oldestKey);
        // logger.warn(`TransformCache: Max items (${this.config.maxItems}) reached. Evicted oldest entry: '${oldestKey}'.`);
        console.warn(`TransformCache: Max items (${this.config.maxItems}) reached. Evicted oldest entry: '${oldestKey}'.`);
      }
    }

    const effectiveTtl = ttlMs || this.config.defaultTtlMs;
    const entry: CacheEntry<T> = {
      value,
      expiresAt: Date.now() + effectiveTtl,
      createdAt: Date.now(),
    };
    this.cache.set(key, entry);
    // logger.debug(`TransformCache: Item set for key '${key}' with TTL ${effectiveTtl}ms.`);
    console.debug(`TransformCache: Item set for key '${key}' with TTL ${effectiveTtl}ms.`);
  }

  delete(key: string): boolean {
    const deleted = this.cache.delete(key);
    if (deleted) {
      // logger.debug(`TransformCache: Item deleted for key '${key}'.`);
      console.debug(`TransformCache: Item deleted for key '${key}'.`);
    }
    return deleted;
  }

  clear(): void {
    this.cache.clear();
    // logger.info('TransformCache: Cache cleared.');
    console.info('TransformCache: Cache cleared.');
  }

  size(): number {
    return this.cache.size;
  }

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
      // logger.info(`TransformCache: Pruned ${prunedCount} expired items.`);
      console.info(`TransformCache: Pruned ${prunedCount} expired items.`);
    }
  }

  stopPruning(): void {
    if (this.pruneIntervalId) {
      clearInterval(this.pruneIntervalId);
      this.pruneIntervalId = undefined;
      // logger.info('TransformCache: Stopped periodic pruning.');
      console.info('TransformCache: Stopped periodic pruning.');
    }
  }
}