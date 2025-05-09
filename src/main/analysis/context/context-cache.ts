// src/main/analysis/context/context-cache.ts

/**
 * @file Context-specific caching implementation for analysis results.
 */

import { IDocumentContext, IDocumentSegment } from './document-context';
// Potentially import a generic CacheService if available
// import { CacheService } from '../../services/cache-service';

/**
 * Represents an entry in the context cache.
 */
export interface IContextCacheEntry<T> {
  contextKey: string; // A key derived from the document/segment context
  data: T; // The cached data (e.g., analysis results)
  timestamp: number; // Timestamp of when the entry was cached
  expiresAt?: number; // Optional expiration timestamp
}

/**
 * Configuration for the ContextCache.
 */
export interface IContextCacheConfig {
  maxSize?: number; // Maximum number of entries in the cache
  defaultTTL?: number; // Default time-to-live for cache entries in milliseconds
}

/**
 * Manages caching of analysis results based on document or segment context.
 */
export class ContextCache<T> {
  private cache: Map<string, IContextCacheEntry<T>>;
  private config: IContextCacheConfig;
  // private genericCacheService?: CacheService<IContextCacheEntry<T>>; // If using a generic cache

  constructor(config: IContextCacheConfig = {}) {
    this.cache = new Map<string, IContextCacheEntry<T>>();
    this.config = {
      maxSize: config.maxSize || 1000, // Default max size
      defaultTTL: config.defaultTTL || 60 * 60 * 1000, // Default TTL 1 hour
    };
    // Initialize genericCacheService if used
  }

  /**
   * Generates a cache key based on the provided context.
   * @param context - The document or segment context.
   * @returns A string cache key.
   */
  private generateCacheKey(context: IDocumentContext | IDocumentSegment): string {
    // Simple key generation for demonstration.
    // In a real scenario, this should be a robust hash of relevant context properties.
    if ('uri' in context) { // IDocumentContext
      return `doc:${context.uri}:${context.language || 'unknown'}`;
    } else { // IDocumentSegment
      return `seg:${context.id}:${context.range.start}-${context.range.end}`;
    }
  }

  /**
   * Retrieves an item from the cache.
   * @param context - The context to retrieve the cached item for.
   * @returns The cached data or undefined if not found or expired.
   */
  public get(context: IDocumentContext | IDocumentSegment): T | undefined {
    const key = this.generateCacheKey(context);
    const entry = this.cache.get(key);

    if (entry) {
      if (entry.expiresAt && entry.expiresAt < Date.now()) {
        this.cache.delete(key); // Entry expired
        return undefined;
      }
      return entry.data;
    }
    return undefined;
  }

  /**
   * Adds or updates an item in the cache.
   * @param context - The context associated with the data.
   * @param data - The data to cache.
   * @param ttl - Optional time-to-live for this specific entry in milliseconds.
   */
  public set(context: IDocumentContext | IDocumentSegment, data: T, ttl?: number): void {
    if (this.cache.size >= this.config.maxSize!) {
      // Basic eviction strategy: remove the oldest entry (by insertion order for Map)
      // More sophisticated strategies like LRU could be implemented.
      const oldestKey = this.cache.keys().next().value;
      if (oldestKey) {
        this.cache.delete(oldestKey);
      }
    }

    const key = this.generateCacheKey(context);
    const timestamp = Date.now();
    const expiresAt = ttl || this.config.defaultTTL ? timestamp + (ttl || this.config.defaultTTL!) : undefined;

    const entry: IContextCacheEntry<T> = {
      contextKey: key,
      data,
      timestamp,
      expiresAt,
    };
    this.cache.set(key, entry);
  }

  /**
   * Removes an item from the cache.
   * @param context - The context of the item to remove.
   */
  public delete(context: IDocumentContext | IDocumentSegment): void {
    const key = this.generateCacheKey(context);
    this.cache.delete(key);
  }

  /**
   * Clears all items from the cache.
   */
  public clear(): void {
    this.cache.clear();
  }

  /**
   * Gets the current size of the cache.
   */
  public get size(): number {
    return this.cache.size;
  }
}

// Example usage (optional)
// const cache = new ContextCache<string[]>();
// const docCtx: IDocumentContext = { uri: "doc1.txt", language: "en" };
// cache.set(docCtx, ["analysis result 1"]);
// console.log(cache.get(docCtx));