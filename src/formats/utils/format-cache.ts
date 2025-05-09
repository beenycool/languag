export class FormatCache {
  private readonly cache: Map<string, { 
    content: unknown;
    timestamp: number;
    ttl?: number;
  }> = new Map();

  set(key: string, content: unknown, ttl?: number): void {
    this.cache.set(key, {
      content,
      timestamp: Date.now(),
      ttl
    });
  }

  get<T>(key: string): T | undefined {
    const entry = this.cache.get(key);
    if (!entry) return undefined;

    // Check if entry has expired
    if (entry.ttl && Date.now() > entry.timestamp + entry.ttl) {
      this.cache.delete(key);
      return undefined;
    }

    return entry.content as T;
  }

  delete(key: string): boolean {
    return this.cache.delete(key);
  }

  clear(): void {
    this.cache.clear();
  }

  has(key: string): boolean {
    return this.cache.has(key) && 
      !(this.cache.get(key)?.ttl && 
        Date.now() > (this.cache.get(key)?.timestamp || 0) + (this.cache.get(key)?.ttl || 0));
  }
}