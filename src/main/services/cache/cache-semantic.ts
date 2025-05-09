import * as crypto from 'crypto';
import * as winston from 'winston';
import { CacheKey, CachedResponse } from '../../../shared/types/llm';
import { LLMCacheConfig } from '../../../shared/types/config';
// import * as vectorSimilarity from 'vector-similarity'; // Stubbed

// Assuming CacheService and LLMCache might be needed for context or interaction
// For now, let's make it self-contained, requiring necessary services/config in constructor.
import { LlmService } from '../llm-service'; // Assuming LlmService is needed for embeddings

interface SemanticIndexEntry {
    embedding: number[];
    originalKey: CacheKey;
    // Add timestamp or other metadata if needed for index pruning
}

export class CacheSemanticSearch {
    private semanticIndex: Map<string, SemanticIndexEntry> = new Map(); // Maps embedding hash to entry
    private config: LLMCacheConfig;
    private logger: winston.Logger;
    private llmService?: LlmService; // Needed for calculating embeddings

    constructor(config: LLMCacheConfig, logger: winston.Logger, llmService?: LlmService) {
        this.config = config;
        this.logger = logger.child({ module: 'CacheSemanticSearch' });
        this.llmService = llmService;
        this.logger.info('CacheSemanticSearch initialized.');
        if (!this.llmService) {
            this.logger.warn('LlmService not provided; semantic search features requiring new embeddings will be disabled.');
        }
    }

    // --- Semantic Search Features ---

    public async calculateEmbedding(text: string): Promise<number[] | undefined> {
        if (!this.llmService) {
            this.logger.warn('Cannot calculate embedding: LlmService not available.');
            return undefined;
        }
        this.logger.debug(`Calculating embedding for text hash: ${crypto.createHash('sha256').update(text).digest('hex')}`);
        try {
            // Replace with actual call to LlmService embedding endpoint
            // const embeddingResponse = await this.llmService.embed(text);
            // if (embeddingResponse?.embedding) {
            //     return embeddingResponse.embedding;
            // }
            this.logger.warn('LlmService.embed call is stubbed/not implemented.');
            return undefined; // Or a random vector for testing: Array.from({ length: 128 }, () => Math.random());
        } catch (error) {
            this.logger.error('Error calculating embedding:', { error });
            return undefined;
        }
    }

    public updateSemanticIndex(key: CacheKey, embedding: number[]): void {
        if (!embedding || embedding.length === 0) {
            this.logger.warn('Attempted to update semantic index with empty embedding.', { key });
            return;
        }
        this.logger.debug(`Updating semantic index for key: ${JSON.stringify(key)}`);
        // Use a hash of the original key as the map key for easier lookup/pruning? Or embedding hash?
        // Using original key hash seems more robust for pruning based on main cache.
        const keyString = this.createCacheKeyString(key); // Reuse hashing logic if possible
        this.semanticIndex.set(keyString, { embedding, originalKey: key });
        // Prune semantic index if it grows too large, similar to cache eviction (e.g., based on size or count)
        this.pruneIndex();
    }

    public async findSimilarEntriesByKey(key: CacheKey, limit: number = 1): Promise<SemanticIndexEntry[]> {
        const keyString = this.createCacheKeyString(key);
        const currentEntry = this.semanticIndex.get(keyString);
        const inputEmbedding = currentEntry?.embedding; // Use existing embedding if available

        if (!inputEmbedding) {
             this.logger.debug(`No embedding found for key ${keyString} in semantic index. Cannot perform similarity search.`);
             // Optionally, calculate embedding on the fly if input text is available?
             // This would require passing the input text or having access to it.
             return [];
        }

        return this.findSimilarEntriesByEmbedding(inputEmbedding, limit, keyString); // Exclude self
    }

     public async findSimilarEntriesByEmbedding(
        inputEmbedding: number[],
        limit: number = 1,
        excludeKeyString?: string // Optional key string to exclude (e.g., the input key itself)
    ): Promise<SemanticIndexEntry[]> {
        this.logger.debug(`Finding similar entries for embedding...`);
        if (!inputEmbedding || inputEmbedding.length === 0) return [];

        const candidates: (SemanticIndexEntry & { similarity: number })[] = [];
        for (const [keyStr, entry] of this.semanticIndex.entries()) {
            if (keyStr === excludeKeyString) continue; // Skip self
            if (entry.embedding && entry.embedding.length === inputEmbedding.length) {
                // const similarity = vectorSimilarity.cosine(inputEmbedding, entry.embedding); // Stubbed
                const similarity = this.calculateCosineSimilarity(inputEmbedding, entry.embedding); // Manual calculation
                if (similarity >= (this.config.semanticThreshold || 0)) { // Use threshold from config
                    candidates.push({ ...entry, similarity });
                }
            }
        }

        if (candidates.length === 0) return [];

        candidates.sort((a, b) => b.similarity - a.similarity); // Sort descending by similarity

        return candidates.slice(0, limit);
    }

    // Simple cosine similarity calculation (replace with library if available)
    private calculateCosineSimilarity(vecA: number[], vecB: number[]): number {
        if (vecA.length !== vecB.length || vecA.length === 0) {
            return 0;
        }
        let dotProduct = 0;
        let magnitudeA = 0;
        let magnitudeB = 0;
        for (let i = 0; i < vecA.length; i++) {
            dotProduct += vecA[i] * vecB[i];
            magnitudeA += vecA[i] * vecA[i];
            magnitudeB += vecB[i] * vecB[i];
        }
        magnitudeA = Math.sqrt(magnitudeA);
        magnitudeB = Math.sqrt(magnitudeB);
        if (magnitudeA === 0 || magnitudeB === 0) {
            return 0;
        }
        return dotProduct / (magnitudeA * magnitudeB);
    }


    public removeIndexEntry(key: CacheKey): void {
        const keyString = this.createCacheKeyString(key);
        const deleted = this.semanticIndex.delete(keyString);
        if (deleted) {
            this.logger.debug(`Removed semantic index entry for key: ${keyString}`);
        }
    }

    public clearIndex(): void {
        this.semanticIndex.clear();
        this.logger.info('Semantic index cleared.');
    }

    private pruneIndex(): void {
        // Implement pruning logic if needed (e.g., based on size or LRU)
        const maxSize = this.config.semanticIndexMaxSize || 10000; // Example max size
        if (this.semanticIndex.size > maxSize) {
            // Simple: remove a portion of the oldest entries (requires tracking insertion time)
            // Or remove entries associated with keys no longer in the main cache (requires coordination)
            this.logger.warn(`Semantic index size (${this.semanticIndex.size}) exceeds limit (${maxSize}). Pruning needed (logic not fully implemented).`);
            // Example: Convert map to array, sort by timestamp (if added), splice
        }
    }

     // Helper to recreate the key string logic (should ideally be shared)
    private createCacheKeyString(key: string | object): string {
        if (typeof key === 'string') return key;
        // Ensure consistent serialization for hashing
        const sortedKey = Object.keys(key as object).sort().reduce((acc, k) => {
            acc[k] = (key as any)[k];
            return acc;
        }, {} as any);
        return crypto.createHash('sha256').update(JSON.stringify(sortedKey)).digest('hex');
    }
}