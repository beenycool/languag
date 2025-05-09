// src/main/analysis/context/__tests__/context-cache.spec.ts

import { ContextCache, IContextCacheConfig } from '../context-cache';
import { IDocumentContext, IDocumentSegment } from '../document-context';

describe('ContextCache', () => {
  let cache: ContextCache<string>;
  const mockDocContext: IDocumentContext = { uri: 'doc1.txt', language: 'en' };
  const mockSegmentContext: IDocumentSegment = {
    id: 'seg1',
    text: 'segment text',
    range: { start: 0, end: 10 },
    context: { uri: 'doc1.txt' },
  };
  const mockData = 'cached data';

  beforeEach(() => {
    // Reset Date.now() mock before each test
    jest.useFakeTimers();
    jest.setSystemTime(new Date('2023-01-01T00:00:00.000Z'));
    cache = new ContextCache<string>();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  describe('Constructor and Configuration', () => {
    it('should initialize with default config', () => {
      expect(cache.size).toBe(0);
      // Access private config for testing or test behaviorally
      // e.g. test default TTL by setting and getting after time passes
    });

    it('should initialize with provided config', () => {
      const config: IContextCacheConfig = { maxSize: 50, defaultTTL: 30 * 60 * 1000 };
      const configuredCache = new ContextCache<string>(config);
      expect(configuredCache.size).toBe(0);
      // Test behavior related to maxSize and defaultTTL
    });
  });

  describe('generateCacheKey (private method testing via public interface)', () => {
    it('should generate different keys for doc and segment contexts', () => {
      cache.set(mockDocContext, 'docData');
      cache.set(mockSegmentContext, 'segmentData');
      expect(cache.get(mockDocContext)).toBe('docData');
      expect(cache.get(mockSegmentContext)).toBe('segmentData');
      // This indirectly tests that keys are different enough not to collide for these inputs
    });

    it('should generate consistent key for the same document context', () => {
      const key1 = (cache as any).generateCacheKey(mockDocContext);
      const key2 = (cache as any).generateCacheKey({ ...mockDocContext });
      expect(key1).toBe(key2);
    });

    it('should generate consistent key for the same segment context', () => {
      const key1 = (cache as any).generateCacheKey(mockSegmentContext);
      const key2 = (cache as any).generateCacheKey({ ...mockSegmentContext });
      expect(key1).toBe(key2);
    });
  });

  describe('set and get', () => {
    it('should set and get an item', () => {
      cache.set(mockDocContext, mockData);
      expect(cache.get(mockDocContext)).toBe(mockData);
      expect(cache.size).toBe(1);
    });

    it('should return undefined for a non-existent item', () => {
      expect(cache.get(mockDocContext)).toBeUndefined();
    });

    it('should overwrite an existing item with the same key', () => {
      const newData = 'new data';
      cache.set(mockDocContext, mockData);
      cache.set(mockDocContext, newData);
      expect(cache.get(mockDocContext)).toBe(newData);
      expect(cache.size).toBe(1);
    });
  });

  describe('Expiration (TTL)', () => {
    it('should return undefined for an expired item (default TTL)', () => {
      const config: IContextCacheConfig = { defaultTTL: 1000 }; // 1 second
      cache = new ContextCache<string>(config);
      cache.set(mockDocContext, mockData);
      
      jest.advanceTimersByTime(500); // Halfway
      expect(cache.get(mockDocContext)).toBe(mockData);

      jest.advanceTimersByTime(501); // Just past expiration
      expect(cache.get(mockDocContext)).toBeUndefined();
      expect(cache.size).toBe(0); // Entry should be deleted
    });

    it('should return undefined for an expired item (specific TTL)', () => {
      cache.set(mockDocContext, mockData, 500); // 0.5 second TTL
      
      jest.advanceTimersByTime(250);
      expect(cache.get(mockDocContext)).toBe(mockData);

      jest.advanceTimersByTime(251);
      expect(cache.get(mockDocContext)).toBeUndefined();
      expect(cache.size).toBe(0);
    });

    it('should not expire an item if TTL is not set and defaultTTL is undefined/0', () => {
      cache = new ContextCache<string>({ defaultTTL: 0 }); // No default expiration
      cache.set(mockDocContext, mockData); // No specific TTL
      
      jest.advanceTimersByTime(1000 * 60 * 60 * 24); // Advance by a day
      expect(cache.get(mockDocContext)).toBe(mockData);
      expect(cache.size).toBe(1);
    });
  });

  describe('Eviction (maxSize)', () => {
    it('should evict the oldest item when maxSize is reached', () => {
      const config: IContextCacheConfig = { maxSize: 2 };
      cache = new ContextCache<string>(config);
      const docContext1: IDocumentContext = { uri: 'doc1.txt' };
      const docContext2: IDocumentContext = { uri: 'doc2.txt' };
      const docContext3: IDocumentContext = { uri: 'doc3.txt' };

      cache.set(docContext1, 'data1'); // Oldest
      jest.advanceTimersByTime(10);
      cache.set(docContext2, 'data2');
      jest.advanceTimersByTime(10);
      
      expect(cache.size).toBe(2);
      
      cache.set(docContext3, 'data3'); // This should evict doc1
      
      expect(cache.size).toBe(2);
      expect(cache.get(docContext1)).toBeUndefined();
      expect(cache.get(docContext2)).toBe('data2');
      expect(cache.get(docContext3)).toBe('data3');
    });
  });

  describe('delete', () => {
    it('should remove an item from the cache', () => {
      cache.set(mockDocContext, mockData);
      expect(cache.size).toBe(1);
      cache.delete(mockDocContext);
      expect(cache.get(mockDocContext)).toBeUndefined();
      expect(cache.size).toBe(0);
    });

    it('should do nothing if item to delete does not exist', () => {
      cache.delete(mockDocContext);
      expect(cache.size).toBe(0);
    });
  });

  describe('clear', () => {
    it('should remove all items from the cache', () => {
      cache.set(mockDocContext, 'data1');
      cache.set(mockSegmentContext, 'data2');
      expect(cache.size).toBe(2);
      cache.clear();
      expect(cache.size).toBe(0);
      expect(cache.get(mockDocContext)).toBeUndefined();
      expect(cache.get(mockSegmentContext)).toBeUndefined();
    });
  });

  describe('size', () => {
    it('should return the current number of items in the cache', () => {
      expect(cache.size).toBe(0);
      cache.set(mockDocContext, 'data1');
      expect(cache.size).toBe(1);
      cache.set(mockSegmentContext, 'data2');
      expect(cache.size).toBe(2);
      cache.delete(mockDocContext);
      expect(cache.size).toBe(1);
      cache.clear();
      expect(cache.size).toBe(0);
    });
  });
});