// src/main/analysis/engines/engine-coordinator.ts

/**
 * @file Manages inter-engine communication and coordination, if needed.
 * For now, this will be a placeholder, as direct inter-engine communication
 * is often complex and might be better handled by a higher-level orchestrator
 * or by passing context/results through the pipeline.
 */

import { IAnalysisEngine } from '../types'; // Assuming IAnalysisEngine will be context-aware
import { IDocumentContext, IDocumentSegment } from '../context/document-context';
import appLogger from '../../services/logger';
import * as winston from 'winston';

export interface IEngineCoordinatorConfig {
  // Configuration for how engines might interact or share data.
  // e.g., shared blacklists, whitelists, or intermediate results.
  enableCaching?: boolean; // Example: Caching results shared between engines
  maxCacheSize?: number;
}

/**
 * Coordinates communication or shared state between different analysis engines.
 *
 * Note: Direct inter-engine communication can increase coupling.
 * Consider whether context passing through the pipeline or a central
 * orchestrator (like EnhancedAnalysisPipeline or PipelineCoordinator)
 * might be more appropriate for managing dependencies between analysis steps.
 */
export class EngineCoordinator {
  private registeredEngines: Map<string, IAnalysisEngine>;
  private sharedDataCache: Map<string, any>; // Generic cache for inter-engine data
  private config: IEngineCoordinatorConfig;
  private logger: winston.Logger;

  constructor(config: IEngineCoordinatorConfig = {}, parentLogger?: winston.Logger) {
    this.registeredEngines = new Map<string, IAnalysisEngine>();
    this.sharedDataCache = new Map<string, any>();
    this.config = {
      enableCaching: config.enableCaching || false,
      maxCacheSize: config.maxCacheSize || 100,
    };
    this.logger = parentLogger ? parentLogger.child({ service: 'EngineCoordinator' }) : appLogger.child({ service: 'EngineCoordinator' });
    this.logger.info(`EngineCoordinator initialized with config: ${JSON.stringify(this.config)}`);
  }

  /**
   * Registers an engine with the coordinator.
   * @param engine - The analysis engine instance.
   */
  public registerEngine(engine: IAnalysisEngine): void {
    if (this.registeredEngines.has(engine.name)) {
      this.logger.warn(`Engine '${engine.name}' is already registered.`);
      return;
    }
    this.registeredEngines.set(engine.name, engine);
    this.logger.info(`Engine '${engine.name}' registered with coordinator.`);
  }

  /**
   * Unregisters an engine from the coordinator.
   * @param engineName - The name of the engine to unregister.
   */
  public unregisterEngine(engineName: string): void {
    if (this.registeredEngines.delete(engineName)) {
      this.logger.info(`Engine '${engineName}' unregistered from coordinator.`);
    } else {
      this.logger.warn(`Engine '${engineName}' not found for unregistration.`);
    }
  }

  /**
   * Allows one engine to request data or a sub-analysis from another registered engine.
   * This is a simplified example and would need careful design for real-world use.
   * @param requestingEngineName - The name of the engine making the request.
   * @param targetEngineName - The name of the engine to query.
   * @param segment - The segment to analyze (if applicable).
   * @param documentContext - The document context (if applicable).
   * @param queryParams - Specific parameters for the query.
   * @returns A Promise with the result from the target engine, or undefined.
   */
  public async queryEngine(
    requestingEngineName: string,
    targetEngineName: string,
    segment: IDocumentSegment, // These would be context-aware types
    documentContext?: IDocumentContext,
    queryParams?: any,
  ): Promise<any | undefined> {
    const targetEngine = this.registeredEngines.get(targetEngineName);
    if (!targetEngine) {
      this.logger.error(`Target engine '${targetEngineName}' not found for query by '${requestingEngineName}'.`);
      return undefined;
    }

    this.logger.info(`Engine '${requestingEngineName}' querying '${targetEngineName}'.`);

    // Example: Directly calling analyze. This assumes engines conform to a common interface.
    // More sophisticated interaction might involve custom methods on engines.
    try {
      // This is a simplification. The actual method and parameters would depend on
      // the agreed-upon inter-engine API.
      // The 'analyze' method might not be the right one for all inter-engine queries.
      if (typeof (targetEngine as any).analyze === 'function') {
         // Casting to `any` because the `analyze` method on `IAnalysisEngine` might not match this signature exactly
         // This will be resolved when IAnalysisEngine is updated for context.
        return await (targetEngine as any).analyze(segment, documentContext, queryParams?.features);
      } else {
        this.logger.warn(`Target engine '${targetEngineName}' does not have a standard 'analyze' method for querying.`);
        return undefined;
      }
    } catch (error: any) {
      this.logger.error(`Error during query from '${requestingEngineName}' to '${targetEngineName}': ${error.message}`, { error });
      return undefined;
    }
  }

  /**
   * Stores data in the shared cache for other engines to access.
   * @param key - The cache key.
   * @param data - The data to store.
   * @param ttl - Optional time-to-live in milliseconds.
   */
  public setSharedData(key: string, data: any, ttl?: number): void {
    if (!this.config.enableCaching) return;

    if (this.sharedDataCache.size >= this.config.maxCacheSize!) {
      // Simple eviction: remove the oldest (first inserted for Map)
      const oldestKey = this.sharedDataCache.keys().next().value;
      if (oldestKey) this.sharedDataCache.delete(oldestKey);
    }
    // TODO: Implement TTL logic if needed
    this.sharedDataCache.set(key, data);
    this.logger.debug(`Data stored in shared cache with key: ${key}`);
  }

  /**
   * Retrieves data from the shared cache.
   * @param key - The cache key.
   * @returns The cached data or undefined if not found.
   */
  public getSharedData(key: string): any | undefined {
    if (!this.config.enableCaching) return undefined;
    // TODO: Check TTL if implemented
    return this.sharedDataCache.get(key);
  }

  public clearSharedCache(): void {
    this.sharedDataCache.clear();
    this.logger.info('Shared data cache cleared.');
  }
}

// Example (Conceptual)
// const coord = new EngineCoordinator({ enableCaching: true });
// const grammarEngine = new SomeGrammarEngine(); // Assume these are IAnalysisEngine compatible
// const styleEngine = new SomeStyleEngine();
// coord.registerEngine(grammarEngine);
// coord.registerEngine(styleEngine);
//
// In StyleEngine:
// const grammarHints = await this.coordinator.queryEngine(
//   this.name,
//   'SomeGrammarEngine',
//   currentSegment,
//   currentDocContext
// );
// if (grammarHints) { /* use hints */ }