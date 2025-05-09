/**
 * @file Defines types used by the cache service modules.
 */

export interface CacheEntry<T> {
  data: string; // Data is always stored as string (JSON or encrypted)
  timestamp: number; // Creation timestamp
  expiry: number;    // Expiry timestamp (absolute)
  lastAccessed: number;
  embedding?: number[]; // For semantic search (optional)
  isEncrypted: boolean; // Flag indicating if data is encrypted
}

// Add other cache-related types here if needed