import logger from './logger';
import { CacheKey, CachedResponse, LLMRequest, ModelResponse, RequestOptions, ChatMessage } from '../../shared/types/llm';
import { LLMCacheConfig } from '../../shared/types/config';
import { configManager } from './config-manager';
import * as crypto from 'crypto';
import * as winston from 'winston'; // Add winston import
import { CacheEncryption } from './cache/cache-encryption';
import { CacheSemanticSearch } from './cache/cache-semantic';
import { CacheEntry } from './cache/cache-types';
import { LlmService } from './llm-service'; // Needed for semantic handler

// Constants moved to respective modules or remain here if general
const DEFAULT_CACHE_MAX_SIZE_MB = 256;
const DEFAULT_CACHE_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours
const DEFAULT_MAX_TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7 days
// const DEFAULT_SEMANTIC_THRESHOLD = 0.9; // Moved to semantic handler config default
const DEFAULT_CLEANUP_INTERVAL_MS = 5 * 60 * 1000; // 5 minutes

export class CacheService {
  protected cache: Map<string, CacheEntry<any>> = new Map();
  protected currentSize = 0; // Approximate size in bytes for basic eviction
  protected maxSize: number; // Max size in bytes
  protected encryptionHandler: CacheEncryption;
  protected maxTTL: number;
  protected logger: winston.Logger; // Make logger protected for subclass access

  constructor(
    maxSizeBytes: number = DEFAULT_CACHE_MAX_SIZE_MB * 1024 * 1024,
    cacheConfig?: LLMCacheConfig // Keep config for maxTTL etc.
  ) {
    this.logger = logger.child({ service: 'CacheService' }); // Initialize logger here
    this.maxSize = maxSizeBytes;
    this.maxTTL = cacheConfig?.maxTTLMs || DEFAULT_MAX_TTL_MS;
    this.encryptionHandler = new CacheEncryption(cacheConfig?.encryption, this.logger); // Pass logger

    this.logger.info(`CacheService initialized with max size: ${this.maxSize / 1024 / 1024}MB, Max TTL: ${this.maxTTL / (1000 * 60 * 60 * 24)} days.`);
    setInterval(() => this.cleanExpiredEntries(), DEFAULT_CLEANUP_INTERVAL_MS);
  }

  // Encryption methods removed, delegated to this.encryptionHandler

  protected createCacheKeyString(key: string | object): string {
    if (typeof key === 'string') return key;
     // Ensure consistent serialization for hashing
     const sortedKey = Object.keys(key as object).sort().reduce((acc, k) => {
        acc[k] = (key as any)[k];
        return acc;
    }, {} as any);
    return crypto.createHash('sha256').update(JSON.stringify(sortedKey)).digest('hex');
  }

  public set(key: string | object, value: any, ttlMsInput: number): void {
    const keyString = this.createCacheKeyString(key);
    const now = Date.now();

    // Enforce maxTTL
    const ttlMs = Math.min(ttlMsInput, this.maxTTL);
    if (ttlMsInput > this.maxTTL) {
        this.logger.warn(`Requested TTL ${ttlMsInput}ms for key ${keyString} exceeds max TTL of ${this.maxTTL}ms. Using max TTL.`);
    }

    const isEncrypted = this.encryptionHandler.getIsEnabled();
    const dataToStore = this.encryptionHandler.encrypt(value); // Handles stringification if not encrypting

    if (dataToStore === null) {
      // Encryption/Stringification failed
      this.logger.error(`Failed to prepare data for key: ${keyString}. Item will not be cached.`);
      return;
    }

    const entrySize = Buffer.byteLength(dataToStore, 'utf8');

    // Evict if necessary
    if (this.cache.has(keyString)) {
        const oldEntry = this.cache.get(keyString);
        // Ensure oldEntry.data is treated as string for byteLength calculation
        if (oldEntry) this.currentSize -= Buffer.byteLength(oldEntry.data || "", 'utf8');
    }

    if (this.currentSize + entrySize > this.maxSize && entrySize <= this.maxSize) {
      this.evictOldest(this.currentSize + entrySize - this.maxSize);
    } else if (entrySize > this.maxSize) {
      this.logger.warn(`Item with key ${keyString} (size: ${entrySize} bytes) is too large to fit in cache (max: ${this.maxSize} bytes). Not caching.`);
      return;
    }

    this.cache.set(keyString, {
      data: dataToStore,
      timestamp: now,
      expiry: now + ttlMs,
      lastAccessed: now,
      isEncrypted, // Store the flag
    });
    this.currentSize += entrySize;
    this.logger.debug(`Caching data for key: ${keyString}, expiry: ${new Date(now + ttlMs).toISOString()}, size: ${entrySize} bytes, encrypted: ${isEncrypted}`);
  }

  public get<T>(key: string | object): T | undefined {
    const keyString = this.createCacheKeyString(key);
    const entry = this.cache.get(keyString);

    if (entry) {
      const now = Date.now();
      if (now > entry.expiry) {
        this.logger.debug(`Cache entry for key ${keyString} expired. Removing.`);
        this.currentSize -= Buffer.byteLength(entry.data || "", 'utf8');
        this.cache.delete(keyString);
        return undefined;
      }
      entry.lastAccessed = now;
      this.cache.set(keyString, entry); // Update LRU position

      // Use encryptionHandler to decrypt if needed
      const decryptedData = this.encryptionHandler.decrypt<T>(entry.data);

      if (decryptedData === undefined && entry.isEncrypted) {
        // Decryption failed
        this.logger.error(`Failed to decrypt data for key ${keyString}. Removing entry.`);
        this.currentSize -= Buffer.byteLength(entry.data || "", 'utf8');
        this.cache.delete(keyString);
        return undefined;
      }
       if (decryptedData === undefined && !entry.isEncrypted) {
         // JSON parsing failed for non-encrypted data
         this.logger.error(`Failed to parse non-encrypted JSON data for key ${keyString}. Removing entry.`);
         this.currentSize -= Buffer.byteLength(entry.data || "", 'utf8');
         this.cache.delete(keyString);
         return undefined;
       }

      this.logger.debug(`Cache hit for key: ${keyString}, encrypted: ${entry.isEncrypted}`);
      return decryptedData;
    }
    this.logger.debug(`Cache miss for key: ${keyString}`);
    return undefined;
  }

  public delete(key: string | object): boolean {
    const keyString = this.createCacheKeyString(key);
    const entry = this.cache.get(keyString);
    if (entry) {
        this.currentSize -= Buffer.byteLength(entry.data || "", 'utf8');
    }
    const deleted = this.cache.delete(keyString);
    if (deleted) {
      this.logger.debug(`Cache entry for key ${keyString} securely deleted (in-memory).`);
    }
    return deleted;
  }

  public clear(): void {
    this.cache.clear();
    this.currentSize = 0;
    this.logger.info('Cache cleared.');
  }

  protected cleanExpiredEntries(): void {
    let cleanedCount = 0;
    let freedSize = 0;
    const now = Date.now();
    for (const [key, entry] of this.cache.entries()) {
      if (now > entry.expiry) {
        const entrySize = Buffer.byteLength(entry.data || "", 'utf8');
        this.cache.delete(key);
        this.currentSize -= entrySize;
        freedSize += entrySize;
        cleanedCount++;
      }
    }
    if (cleanedCount > 0) {
      this.logger.info(`Cleaned ${cleanedCount} expired cache entries, freed ${freedSize} bytes.`);
    }
  }

  protected evictOldest(bytesToFree: number): void {
    if (this.cache.size === 0 || bytesToFree <=0) return;
    this.logger.warn(`Cache size limit exceeded. Attempting to evict ${bytesToFree} bytes.`);
    let freedBytes = 0;
    const entries = Array.from(this.cache.entries());
    entries.sort((a, b) => a[1].lastAccessed - b[1].lastAccessed); // Sort by last accessed (LRU)

    for (const [key, entry] of entries) {
        if (freedBytes >= bytesToFree) break;
        const entrySize = Buffer.byteLength(entry.data || "", 'utf8');
        this.cache.delete(key);
        this.currentSize -= entrySize;
        freedBytes += entrySize;
        this.logger.debug(`Evicted entry ${key} (size: ${entrySize} bytes) due to cache pressure.`);
    }
     this.logger.info(`Evicted ${freedBytes} bytes to manage cache size.`);
  }
}


export class LLMCache extends CacheService {
  private semanticSearchHandler: CacheSemanticSearch;
  private config: LLMCacheConfig;
  private llmService?: LlmService; // Keep reference if needed by semantic handler

  constructor(llmService?: LlmService) { // Accept LlmService
    const cacheConfig = configManager.get<LLMCacheConfig | undefined>('llmCache');
    const resolvedConfig: LLMCacheConfig = {
        maxSizeMB: cacheConfig?.maxSizeMB || DEFAULT_CACHE_MAX_SIZE_MB,
        defaultTTL: cacheConfig?.defaultTTL || DEFAULT_CACHE_TTL_MS,
        semanticThreshold: cacheConfig?.semanticThreshold || 0.9, // Use default if not set
        maxTTLMs: cacheConfig?.maxTTLMs || DEFAULT_MAX_TTL_MS,
        encryption: cacheConfig?.encryption,
        semanticIndexMaxSize: cacheConfig?.semanticIndexMaxSize || 10000 // Use default
    };
    super(resolvedConfig.maxSizeMB * 1024 * 1024, resolvedConfig);
    this.config = resolvedConfig;
    this.llmService = llmService; // Store LlmService reference
    // Pass logger from CacheService (which is initialized in super)
    this.semanticSearchHandler = new CacheSemanticSearch(resolvedConfig, this.logger, this.llmService);
    this.logger.info(`LLMCache specific settings: Default TTL: ${this.config.defaultTTL}ms, Semantic Threshold: ${this.config.semanticThreshold}`);
  }


  private generateInputHash(input: string | ChatMessage[]): string {
    const content = typeof input === 'string' ? input : JSON.stringify(input.map(m => `${m.role}:${m.content}`).join('|'));
    return crypto.createHash('sha256').update(content).digest('hex');
  }

  public buildCacheKey(request: LLMRequest, providerName: string, modelId: string): CacheKey {
    const relevantOptions: Partial<RequestOptions> = {};
    if (request.options) {
        const { temperature, maxTokens, topP, topK } = request.options;
        if (temperature !== undefined) relevantOptions.temperature = temperature;
        if (maxTokens !== undefined) relevantOptions.maxTokens = maxTokens;
        if (topP !== undefined) relevantOptions.topP = topP;
        if (topK !== undefined) relevantOptions.topK = topK;
    }

    return {
      inputHash: this.generateInputHash(request.input),
      options: relevantOptions,
      model: modelId,
      provider: providerName,
    };
  }

  public async getLlmEntry(key: CacheKey): Promise<CachedResponse | undefined> {
    const keyString = this.createCacheKeyString(key);
    const cachedData = super.get<CachedResponse>(keyString);
    if (cachedData) {
        return cachedData;
    }

    // Semantic search fallback
    if (this.config.semanticThreshold > 0) {
      const similar = await this.semanticSearchHandler.findSimilarEntriesByKey(key);
      if (similar.length > 0) {
        const similarKeyString = this.createCacheKeyString(similar[0].originalKey);
        this.logger.info(`Semantic cache hit for key ${keyString} based on similarity to ${similarKeyString}.`);
        // Retrieve the data associated with the similar key
        return super.get<CachedResponse>(similarKeyString);
      }
    }
    return undefined;
  }

  public async set(key: CacheKey, value: ModelResponse, ttlInput?: number): Promise<void> {
    const now = Date.now();
    const ttlToUse = ttlInput !== undefined ? Math.min(ttlInput, this.config.maxTTLMs || this.maxTTL) : Math.min(this.config.defaultTTL, this.config.maxTTLMs || this.maxTTL) ;

    if (ttlInput !== undefined && ttlInput > (this.config.maxTTLMs || this.maxTTL) ) {
        this.logger.warn(`LLMCache: Requested TTL ${ttlInput}ms for key ${JSON.stringify(key)} exceeds max TTL of ${this.config.maxTTLMs || this.maxTTL}ms. Using max TTL.`);
    }

    const cacheEntry: CachedResponse = {
      response: value,
      createdAt: now,
      lastAccessed: now,
      ttl: ttlToUse,
    };

    // Call super.set which handles encryption
    super.set(this.createCacheKeyString(key), cacheEntry, ttlToUse);

    // Update semantic index (if embedding can be calculated)
    // Requires input text to calculate embedding. Assuming key.inputHash relates to text.
    // This part needs refinement based on how embeddings are generated/accessed.
    // For now, we'll assume calculateEmbedding needs the original text, which isn't directly here.
    // Let's simulate getting an embedding if semantic search is enabled.
    if (this.config.semanticThreshold > 0) {
        // const inputText = ??? // Need the original text associated with key.inputHash
        // const embedding = await this.semanticSearchHandler.calculateEmbedding(inputText);
        const embedding = Array.from({ length: 128 }, () => Math.random()); // Placeholder embedding
        if (embedding) {
            this.semanticSearchHandler.updateSemanticIndex(key, embedding);
        }
    }
  }

  // Override delete to also remove from semantic index
  public delete(key: string | object): boolean {
      const deleted = super.delete(key);
      if (deleted && typeof key !== 'string') { // Only remove from index if it was a CacheKey
          this.semanticSearchHandler.removeIndexEntry(key as CacheKey);
      }
      return deleted;
  }

  // Override clear to also clear semantic index
  public clear(): void {
      super.clear();
      this.semanticSearchHandler.clearIndex();
  }

  // Override cleanExpiredEntries to coordinate with semantic index pruning if necessary
  protected cleanExpiredEntries(): void {
    const keysBefore = new Set(this.cache.keys());
    super.cleanExpiredEntries();
    const keysAfter = new Set(this.cache.keys());

    // Find keys that were removed and prune them from the semantic index
    for (const keyString of keysBefore) {
        if (!keysAfter.has(keyString)) {
            // Need to map keyString back to CacheKey to remove from index.
            // This requires storing the original CacheKey or finding it in the index.
            // For simplicity, we might need CacheSemanticSearch to handle pruning based on its own logic or timestamps.
            // Or, LLMCache could iterate semantic index and check if corresponding key exists in main cache.
            this.logger.debug(`Entry ${keyString} expired/removed, potentially prune from semantic index (logic needs refinement).`);
            // Example: Find original key in semantic index by keyString and remove if found.
            // This assumes createCacheKeyString is deterministic and used by semantic index.
             for(const entry of this.semanticSearchHandler['semanticIndex'].values()){ // Accessing private member for demo
                 if(this.createCacheKeyString(entry.originalKey) === keyString){
                     this.semanticSearchHandler.removeIndexEntry(entry.originalKey);
                     break;
                 }
             }
        }
    }
    this.logger.debug('LLMCache: Performed extended cleanup.');
  }

   // Expose semantic search capability if needed externally
   public async findSimilar(inputText: string, limit: number = 1): Promise<CachedResponse[]> {
       const inputEmbedding = await this.semanticSearchHandler.calculateEmbedding(inputText);
       if (!inputEmbedding) return [];

       const similarEntries = await this.semanticSearchHandler.findSimilarEntriesByEmbedding(inputEmbedding, limit);
       const results: CachedResponse[] = [];
       for (const entry of similarEntries) {
           const cached = await this.getLlmEntry(entry.originalKey);
           if (cached) {
               results.push(cached);
           }
       }
       return results;
   }
}


// Singleton instance for LLMCache
let llmCacheInstance: LLMCache | null = null;

// Modify singleton getter to potentially accept LlmService if needed for embeddings
export function getLlmCacheService(llmService?: LlmService): LLMCache {
  if (!llmCacheInstance) {
    // Pass LlmService instance if provided, needed by CacheSemanticSearch
    // This assumes LlmService is also likely a singleton or easily accessible.
    // If LlmService is not available here, semantic search needing embeddings won't work.
    llmCacheInstance = new LLMCache(llmService);
  }
  // If llmService is provided later, we might need a way to update the handler?
  // Or ensure LlmService is available during initial creation.
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