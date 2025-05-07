import logger from './logger';
import { CacheKey, CachedResponse, LLMRequest, ModelResponse, RequestOptions, ChatMessage } from '../../shared/types/llm';
import { LLMCacheConfig, AppConfig } from '../../shared/types/config';
import { configManager } from './config-manager';
import * as crypto from 'crypto';
// import * as vectorSimilarity from 'vector-similarity'; // Stubbed due to install issues

const DEFAULT_ENCRYPTION_ALGORITHM = 'aes-256-gcm';
const DEFAULT_IV_LENGTH = 12; // bytes for GCM
const DEFAULT_AUTH_TAG_LENGTH = 16; // bytes for GCM


interface CacheEntry<T> {
  data: string | T; // Data can be string (encrypted) or original type
  timestamp: number; // Creation timestamp
  expiry: number;    // Expiry timestamp (absolute)
  lastAccessed: number;
  embedding?: number[]; // For semantic search
  isEncrypted?: boolean;
}

const DEFAULT_CACHE_MAX_SIZE_MB = 256;
const DEFAULT_CACHE_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours
const DEFAULT_MAX_TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7 days
const DEFAULT_SEMANTIC_THRESHOLD = 0.9;
const DEFAULT_CLEANUP_INTERVAL_MS = 5 * 60 * 1000; // 5 minutes

export class CacheService {
  protected cache: Map<string, CacheEntry<any>> = new Map();
  protected currentSize = 0; // Approximate size in bytes for basic eviction
  protected maxSize: number; // Max size in bytes
  protected encryptionConfig?: LLMCacheConfig['encryption'];
  protected maxTTL: number;

  constructor(
    maxSizeBytes: number = DEFAULT_CACHE_MAX_SIZE_MB * 1024 * 1024,
    cacheConfig?: LLMCacheConfig
  ) {
    this.maxSize = maxSizeBytes;
    this.encryptionConfig = cacheConfig?.encryption;
    this.maxTTL = cacheConfig?.maxTTLMs || DEFAULT_MAX_TTL_MS;

    if (this.encryptionConfig?.enabled && !this.encryptionConfig.key) {
        logger.error('Cache encryption is enabled but no key is provided. Disabling encryption.');
        this.encryptionConfig.enabled = false;
    } else if (this.encryptionConfig?.enabled) {
        logger.info('Cache encryption enabled.');
        // Ensure key is of sufficient length if a specific algorithm demands it (e.g. AES-256 needs 32 bytes)
        // For simplicity, we assume the key is correctly formatted for now.
        // A production system would validate this rigorously.
    }

    logger.info(`CacheService initialized with max size: ${this.maxSize / 1024 / 1024}MB, Max TTL: ${this.maxTTL / (1000 * 60 * 60 * 24)} days.`);
    setInterval(() => this.cleanExpiredEntries(), DEFAULT_CLEANUP_INTERVAL_MS);
  }

  private getEncryptionKey(): Buffer {
    // In a real app, derive a fixed-length key from the config key, e.g., using SHA-256
    // For AES-256, the key must be 32 bytes.
    const keyString = this.encryptionConfig?.key || "default-fallback-key-should-not-happen";
    return crypto.createHash('sha256').update(String(keyString)).digest();
  }

  protected encrypt(data: any): string | null {
    if (!this.encryptionConfig?.enabled || !data) return JSON.stringify(data); // Store as JSON if not encrypting

    try {
      const text = JSON.stringify(data);
      const iv = crypto.randomBytes(this.encryptionConfig.ivLength || DEFAULT_IV_LENGTH);
      const algorithm = this.encryptionConfig.algorithm || DEFAULT_ENCRYPTION_ALGORITHM;
      const key = this.getEncryptionKey();

      const cipher = crypto.createCipheriv(algorithm, key, iv) as crypto.CipherGCM; // Cast to CipherGCM
      let encrypted = cipher.update(text, 'utf8', 'hex');
      encrypted += cipher.final('hex');
      const authTag = cipher.getAuthTag();

      // Prepend IV and AuthTag to the encrypted data for decryption
      return `${iv.toString('hex')}:${authTag.toString('hex')}:${encrypted}`;
    } catch (error: any) {
      logger.error(`Encryption failed: ${error.message}. Storing data unencrypted.`);
      return JSON.stringify(data); // Fallback to unencrypted if error
    }
  }

  protected decrypt<T>(data: string): T | undefined { // Return T | undefined
    if (!this.encryptionConfig?.enabled || !data) {
        try { return JSON.parse(data) as T; } catch { return undefined; } // Assume JSON if not encrypted
    }

    try {
      const parts = data.split(':');
      if (parts.length !== 3) {
        logger.warn('Encrypted data format is invalid. Attempting to parse as JSON.');
        try { return JSON.parse(data) as T; } catch { return undefined; } // Fallback
      }
      const [ivHex, authTagHex, encryptedText] = parts;
      const iv = Buffer.from(ivHex, 'hex');
      const authTag = Buffer.from(authTagHex, 'hex');
      const algorithm = this.encryptionConfig.algorithm || DEFAULT_ENCRYPTION_ALGORITHM;
      const key = this.getEncryptionKey();

      const decipher = crypto.createDecipheriv(algorithm, key, iv) as crypto.DecipherGCM; // Cast to DecipherGCM
      decipher.setAuthTag(authTag);
      let decrypted = decipher.update(encryptedText, 'hex', 'utf8');
      decrypted += decipher.final('utf8');
      return JSON.parse(decrypted) as T;
    } catch (error: any) {
      logger.error(`Decryption failed: ${error.message}. Returning undefined.`);
      return undefined; // Return undefined on failure
    }
  }


  protected createCacheKeyString(key: string | object): string {
    if (typeof key === 'string') return key;
    return crypto.createHash('sha256').update(JSON.stringify(key)).digest('hex');
  }

  public set(key: string | object, value: any, ttlMsInput: number): void {
    const keyString = this.createCacheKeyString(key);
    const now = Date.now();

    // Enforce maxTTL
    const ttlMs = Math.min(ttlMsInput, this.maxTTL);
    if (ttlMsInput > this.maxTTL) {
        logger.warn(`Requested TTL ${ttlMsInput}ms for key ${keyString} exceeds max TTL of ${this.maxTTL}ms. Using max TTL.`);
    }


    const isEncrypted = this.encryptionConfig?.enabled || false;
    const dataToStore = isEncrypted ? this.encrypt(value) : JSON.stringify(value);

    if (dataToStore === null && isEncrypted) { // Encryption failed, value is already stringified JSON
        // Handled inside encrypt by returning JSON.stringify(value)
    }
    
    const entrySize = Buffer.byteLength(dataToStore || "", 'utf8');

    // Evict if necessary
    if (this.cache.has(keyString)) { // If key exists, subtract its old size first
        const oldEntry = this.cache.get(keyString);
        if (oldEntry) this.currentSize -= Buffer.byteLength(JSON.stringify(oldEntry.data), 'utf8');
    }

    if (this.currentSize + entrySize > this.maxSize && entrySize <= this.maxSize) {
      this.evictOldest(this.currentSize + entrySize - this.maxSize);
    } else if (entrySize > this.maxSize) {
      logger.warn(`Item with key ${keyString} (size: ${entrySize} bytes) is too large to fit in cache (max: ${this.maxSize} bytes). Not caching.`);
      return;
    }

    this.cache.set(keyString, {
      data: dataToStore,
      timestamp: now,
      expiry: now + ttlMs,
      lastAccessed: now,
      isEncrypted,
    });
    this.currentSize += entrySize;
    logger.debug(`Caching data for key: ${keyString}, expiry: ${new Date(now + ttlMs).toISOString()}, size: ${entrySize} bytes, encrypted: ${isEncrypted}`);
  }

  public get<T>(key: string | object): T | undefined {
    const keyString = this.createCacheKeyString(key);
    const entry = this.cache.get(keyString);

    if (entry) {
      const now = Date.now();
      if (now > entry.expiry) {
        logger.debug(`Cache entry for key ${keyString} expired. Removing.`);
        this.currentSize -= Buffer.byteLength(entry.data.toString(), 'utf8'); // entry.data is string (JSON or encrypted)
        this.cache.delete(keyString);
        return undefined;
      }
      entry.lastAccessed = now;
      this.cache.set(keyString, entry); // Update LRU position

      const decryptedData = entry.isEncrypted ? this.decrypt<T>(entry.data as string) : JSON.parse(entry.data as string) as T;

      if (decryptedData === undefined && entry.isEncrypted) { // Decryption failed (now checks for undefined)
        logger.error(`Failed to decrypt data for key ${keyString}. Removing entry.`);
        this.currentSize -= Buffer.byteLength(entry.data.toString(), 'utf8');
        this.cache.delete(keyString);
        return undefined;
      }
      logger.debug(`Cache hit for key: ${keyString}, encrypted: ${entry.isEncrypted}`);
      return decryptedData;
    }
    logger.debug(`Cache miss for key: ${keyString}`);
    return undefined;
  }

  // Secure cache invalidation: delete should securely wipe if needed.
  // For in-memory, `delete` is enough. If persisting, would need secure file deletion.
  public delete(key: string | object): boolean {
    const keyString = this.createCacheKeyString(key);
    const entry = this.cache.get(keyString);
    if (entry) {
        this.currentSize -= Buffer.byteLength(entry.data.toString(), 'utf8');
    }
    const deleted = this.cache.delete(keyString);
    if (deleted) {
      logger.debug(`Cache entry for key ${keyString} securely deleted (in-memory).`);
    }
    return deleted;
  }

  public clear(): void {
    this.cache.clear();
    this.currentSize = 0;
    logger.info('Cache cleared.');
  }

  protected cleanExpiredEntries(): void {
    let cleanedCount = 0;
    let freedSize = 0;
    const now = Date.now();
    for (const [key, entry] of this.cache.entries()) {
      if (now > entry.expiry) {
        const entrySize = Buffer.byteLength(entry.data.toString(), 'utf8');
        this.cache.delete(key);
        this.currentSize -= entrySize;
        freedSize += entrySize;
        cleanedCount++;
      }
    }
    if (cleanedCount > 0) {
      logger.info(`Cleaned ${cleanedCount} expired cache entries, freed ${freedSize} bytes.`);
    }
  }

  protected evictOldest(bytesToFree: number): void {
    if (this.cache.size === 0 || bytesToFree <=0) return;
    logger.warn(`Cache size limit exceeded. Attempting to evict ${bytesToFree} bytes.`);
    // Simple eviction: oldest by insertion time (Map preserves insertion order)
    // For LRU, would need to sort by lastAccessed or use a different data structure
    let freedBytes = 0;
    const entries = Array.from(this.cache.entries());
    entries.sort((a, b) => a[1].lastAccessed - b[1].lastAccessed); // Sort by last accessed (LRU)

    for (const [key, entry] of entries) {
        if (freedBytes >= bytesToFree) break;
        const entrySize = Buffer.byteLength(entry.data.toString(), 'utf8');
        this.cache.delete(key);
        this.currentSize -= entrySize;
        freedBytes += entrySize;
        logger.debug(`Evicted entry ${key} (size: ${entrySize} bytes) due to cache pressure.`);
    }
     logger.info(`Evicted ${freedBytes} bytes to manage cache size.`);
  }
}


export class LLMCache extends CacheService {
  private semanticIndex: Map<string, { embedding: number[], originalKey: CacheKey }> = new Map(); // Maps embedding hash to embedding and original CacheKey
  private config: LLMCacheConfig;

  constructor() {
    const cacheConfig = configManager.get<LLMCacheConfig | undefined>('llmCache');
    const resolvedConfig: LLMCacheConfig = {
        maxSizeMB: cacheConfig?.maxSizeMB || DEFAULT_CACHE_MAX_SIZE_MB,
        defaultTTL: cacheConfig?.defaultTTL || DEFAULT_CACHE_TTL_MS,
        semanticThreshold: cacheConfig?.semanticThreshold || DEFAULT_SEMANTIC_THRESHOLD,
        maxTTLMs: cacheConfig?.maxTTLMs || DEFAULT_MAX_TTL_MS,
        encryption: cacheConfig?.encryption // Pass full encryption config
    };
    super(resolvedConfig.maxSizeMB * 1024 * 1024, resolvedConfig); // Pass resolvedConfig to super
    this.config = resolvedConfig; // Keep a local copy too
    // Super constructor logs its details, LLMCache can log its specific additions
    logger.info(`LLMCache specific settings: Default TTL: ${this.config.defaultTTL}ms, Semantic Threshold: ${this.config.semanticThreshold}`);
  }


  private generateInputHash(input: string | ChatMessage[]): string {
    const content = typeof input === 'string' ? input : JSON.stringify(input.map(m => `${m.role}:${m.content}`).join('|'));
    return crypto.createHash('sha256').update(content).digest('hex');
  }

  public buildCacheKey(request: LLMRequest, providerName: string, modelId: string): CacheKey {
    // Normalize options for consistent hashing: sort keys, include only relevant ones
    const relevantOptions: Partial<RequestOptions> = {};
    if (request.options) {
        const { temperature, maxTokens, topP, topK } = request.options;
        if (temperature !== undefined) relevantOptions.temperature = temperature;
        if (maxTokens !== undefined) relevantOptions.maxTokens = maxTokens;
        if (topP !== undefined) relevantOptions.topP = topP;
        if (topK !== undefined) relevantOptions.topK = topK;
        // Add other options that significantly affect output
    }

    return {
      inputHash: this.generateInputHash(request.input),
      options: relevantOptions,
      model: modelId,
      provider: providerName,
    };
  }

  // To resolve the signature mismatch, LLMCache's get method should either:
  // 1. Be renamed if its purpose/signature is fundamentally different.
  // 2. Align its signature (if feasible) or use the base class method more directly.
  // For now, let's assume LLMCache.get is a specialized version.
  // The error "Property 'get' in type 'LLMCache' is not assignable..."
  // often means the derived class method is not a valid subtype of the base class method.
  // Since LLMCache.get is async and returns a Promise, while CacheService.get is sync,
  // they are fundamentally different. Let's rename LLMCache.get to getLlmEntry.

  public async getLlmEntry(key: CacheKey): Promise<CachedResponse | undefined> { // Renamed and return type adjusted
    // LLMCache.get needs to call the generic CacheService.get which handles decryption
    const cachedData = super.get<CachedResponse>(this.createCacheKeyString(key));
    if (cachedData) {
        return cachedData; // This is already a CachedResponse | undefined from super.get
    }

    // Semantic search fallback (stubbed) - this part remains largely conceptual
    // if (this.config.semanticThreshold > 0 && typeof key.inputHash === 'string') {
    //   const similar = await this.findSimilarEntriesByHash(key.inputHash);
    //   if (similar.length > 0) {
    //     logger.info(`Semantic cache hit for key based on hash ${key.inputHash}. Original key: ${JSON.stringify(similar[0].originalKey)}`);
    //     return super.get<CachedResponse>(this.createCacheKeyString(similar[0].originalKey));
    //   }
    // }
    return undefined; // Explicitly return undefined if not found
  }

  public async set(key: CacheKey, value: ModelResponse, ttlInput?: number): Promise<void> {
    const now = Date.now();
    const ttlToUse = ttlInput !== undefined ? Math.min(ttlInput, this.config.maxTTLMs || this.maxTTL) : Math.min(this.config.defaultTTL, this.config.maxTTLMs || this.maxTTL) ;

    if (ttlInput !== undefined && ttlInput > (this.config.maxTTLMs || this.maxTTL) ) {
        logger.warn(`LLMCache: Requested TTL ${ttlInput}ms for key ${JSON.stringify(key)} exceeds max TTL of ${this.config.maxTTLMs || this.maxTTL}ms. Using max TTL.`);
    }


    const cacheEntry: CachedResponse = {
      response: value, // This will be stringified/encrypted by super.set
      createdAt: now,
      lastAccessed: now,
      ttl: ttlToUse,
      // embedding: await this.calculateEmbedding(key.inputHash) // Stubbed
    };

    // super.set handles encryption based on the config passed to its constructor
    super.set(this.createCacheKeyString(key), cacheEntry, ttlToUse);

    // Update semantic index (stubbed)
    // if (cacheEntry.embedding) {
    //   this.updateSemanticIndex(key, cacheEntry.embedding);
    // }
  }

  // Stubbed: Semantic Search Features
  private async calculateEmbedding(text: string): Promise<number[] | undefined> {
    logger.debug(`Stubbed: Calculating embedding for text hash: ${text}`);
    // In a real implementation, use an embedding model via LlmService
    // For now, return a dummy embedding or undefined
    // Example: const embeddingResponse = await llmService.embed(text); return embeddingResponse.embedding;
    return undefined; // Or a random vector for testing: Array.from({ length: 128 }, () => Math.random());
  }

  private updateSemanticIndex(key: CacheKey, embedding: number[]): void {
    logger.debug(`Stubbed: Updating semantic index for key: ${JSON.stringify(key)}`);
    // const embeddingHash = crypto.createHash('sha256').update(JSON.stringify(embedding)).digest('hex');
    // this.semanticIndex.set(embeddingHash, { embedding, originalKey: key });
    // Prune semantic index if it grows too large, similar to cache eviction
  }

  public async findSimilarEntriesByHash(inputHash: string, limit: number = 1): Promise<{ embedding: number[], originalKey: CacheKey }[]> {
    logger.debug(`Stubbed: Finding similar entries for input hash: ${inputHash}`);
    // const inputEmbedding = await this.calculateEmbedding(inputHash);
    // if (!inputEmbedding) return [];
    //
    // const candidates = Array.from(this.semanticIndex.values());
    // if (candidates.length === 0) return [];
    //
    // candidates.sort((a, b) => {
    //   const simA = vectorSimilarity.cosine(inputEmbedding, a.embedding);
    //   const simB = vectorSimilarity.cosine(inputEmbedding, b.embedding);
    //   return simB - simA; // Sort descending by similarity
    // });
    //
    // return candidates
    //   .filter(c => vectorSimilarity.cosine(inputEmbedding, c.embedding) >= this.config.semanticThreshold)
    //   .slice(0, limit);
    return [];
  }

  public async findSimilarEntries(inputText: string, limit: number = 1): Promise<CachedResponse[]> {
      const inputHash = this.generateInputHash(inputText);
      const similarKeys = await this.findSimilarEntriesByHash(inputHash, limit);
      const results: CachedResponse[] = [];
      for (const entry of similarKeys) {
          const cached = await this.getLlmEntry(entry.originalKey); // Use renamed method
          if (cached) {
              results.push(cached);
          }
      }
      return results;
  }


  // Override cleanExpiredEntries to also manage semanticIndex if needed
  protected cleanExpiredEntries(): void {
    super.cleanExpiredEntries();
    // Additionally, prune semanticIndex for entries whose original keys are no longer in the main cache
    // const validCacheKeys = new Set(Array.from(this.cache.keys()));
    // for (const [embedHash, semanticEntry] of this.semanticIndex.entries()) {
    //   if (!validCacheKeys.has(this.createCacheKeyString(semanticEntry.originalKey))) {
    //     this.semanticIndex.delete(embedHash);
    //     logger.debug(`Removed stale semantic index entry for: ${JSON.stringify(semanticEntry.originalKey)}`);
    //   }
    // }
    logger.debug('LLMCache: Performed extended cleanup including semantic index (stubbed).');
  }
}


// Singleton instance for LLMCache
let llmCacheInstance: LLMCache | null = null;

export function getLlmCacheService(): LLMCache {
  if (!llmCacheInstance) {
    llmCacheInstance = new LLMCache();
  }
  return llmCacheInstance;
}

// Keep the generic CacheService available if needed elsewhere, or decide to remove/deprecate
let genericCacheServiceInstance: CacheService | null = null;
export function getGenericCacheService(): CacheService {
  if (!genericCacheServiceInstance) {
    genericCacheServiceInstance = new CacheService();
  }
  return genericCacheServiceInstance;
}