export class EdgeCacheManager {
  private cache = new Map<string, { value: any; expires: number }>();
  private maxSize: number;
  private defaultTTL: number;

  constructor(maxSize = 1000, ttl = 300_000) {
    this.maxSize = maxSize;
    this.defaultTTL = ttl;
  }

  get<T>(key: string): T | null {
    const entry = this.cache.get(key);
    if (!entry || Date.now() > entry.expires) {
      this.cache.delete(key);
      return null;
    }
    return entry.value as T;
  }

  set(key: string, value: any, ttl?: number): void {
    if (this.cache.size >= this.maxSize) {
      this.evictExpiredEntries();
      if (this.cache.size >= this.maxSize) {
        const oldestKey = this.cache.keys().next().value;
        if (oldestKey) {
          this.cache.delete(oldestKey);
        }
      }
    }
    
    this.cache.set(key, {
      value,
      expires: Date.now() + (ttl || this.defaultTTL)
    });
  }

  private evictExpiredEntries() {
    const now = Date.now();
    for (const [key, entry] of this.cache) {
      if (entry.expires <= now) this.cache.delete(key);
    }
  }
}