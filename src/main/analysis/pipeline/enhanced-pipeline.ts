// src/main/analysis/pipeline/enhanced-pipeline.ts

/**
 * @file New pipeline implementation with integrated context support.
 */

import { IDocumentContext, IDocumentSegment } from '../context/document-context';
import { ContextExtractor, IContextExtractorConfig } from '../context/context-extractor';
import { ParagraphSegmenter, IParagraphSegmenterConfig } from '../context/paragraph-segmenter';
import { ContextCache, IContextCacheConfig } from '../context/context-cache';
// Assuming IAnalysisEngine and AnalysisResult will be updated for context
// For now, let's import existing ones and adapt.
import { IAnalysisEngine, AnalysisResult, ExtractedFeatures } from '../types';
import { FeatureExtractor } from '../feature-extractor'; // This will need to become context-aware
import appLogger from '../../services/logger';
import * as winston from 'winston';
// import { PipelineCoordinator } from './pipeline-coordinator'; // To be created
// import { ResultMerger } from './result-merger'; // To be created

export interface IEnhancedPipelineConfig {
  engines: IAnalysisEngine[]; // These engines should be context-aware
  contextExtractorConfig?: IContextExtractorConfig;
  paragraphSegmenterConfig?: IParagraphSegmenterConfig;
  featureExtractorConfig?: any; // Define specific config for context-aware feature extractor
  contextCacheConfig?: IContextCacheConfig; // Cache results per document/segment context
  maxSegmentsToProcess?: number;
  // coordinatorConfig?: any; // Config for PipelineCoordinator
}

export class EnhancedAnalysisPipeline {
  private engines: IAnalysisEngine[];
  private contextExtractor: ContextExtractor;
  private paragraphSegmenter: ParagraphSegmenter;
  private featureExtractor: FeatureExtractor; // Should become a context-aware version
  private resultCache?: ContextCache<AnalysisResult[]>;
  // private coordinator: PipelineCoordinator; // For parallel processing management
  // private resultMerger: ResultMerger; // For combining results
  private logger: winston.Logger;
  private maxSegmentsToProcess: number;

  constructor(config: IEnhancedPipelineConfig, parentLogger?: winston.Logger) {
    this.logger = parentLogger ? parentLogger.child({ service: 'EnhancedAnalysisPipeline' }) : appLogger.child({ service: 'EnhancedAnalysisPipeline' });

    this.engines = config.engines;
    this.contextExtractor = new ContextExtractor(config.contextExtractorConfig);
    this.paragraphSegmenter = new ParagraphSegmenter(config.paragraphSegmenterConfig);
    // TODO: Instantiate a context-aware FeatureExtractor
    this.featureExtractor = new FeatureExtractor(
        config.featureExtractorConfig?.maxSegmentSize,
        config.featureExtractorConfig?.maxKeywordsInputLength,
        config.featureExtractorConfig?.sanitizeKeywords
    );

    if (config.contextCacheConfig) {
      this.resultCache = new ContextCache<AnalysisResult[]>(config.contextCacheConfig);
    }

    // this.coordinator = new PipelineCoordinator(config.coordinatorConfig);
    // this.resultMerger = new ResultMerger();

    this.maxSegmentsToProcess = config.maxSegmentsToProcess ?? 100;

    if (!this.engines || this.engines.length === 0) {
      this.logger.warn('EnhancedAnalysisPipeline initialized with no analysis engines.');
    } else {
      this.logger.info(`EnhancedAnalysisPipeline initialized with engines: ${this.engines.map(e => e.name).join(', ')}`);
    }
  }

  public async analyzeDocument(rawText: string, initialContext?: Partial<IDocumentContext>): Promise<AnalysisResult[]> {
    const documentUri = initialContext?.uri || `urn:uuid:${Date.now()}`; // Simple URI generation
    this.logger.info(`Starting enhanced analysis for document: ${documentUri}`);

    const documentContext = this.contextExtractor.extractDocumentContext(documentUri, rawText, initialContext);

    // Check cache first
    if (this.resultCache) {
      const cachedResults = this.resultCache.get(documentContext);
      if (cachedResults) {
        this.logger.info(`Returning cached results for document: ${documentUri}`);
        return cachedResults;
      }
    }

    let segments = this.paragraphSegmenter.segment(rawText, documentContext);

    if (segments.length === 0) {
      this.logger.info(`No segments found for document: ${documentUri}. Skipping analysis.`);
      return [];
    }

    if (segments.length > this.maxSegmentsToProcess) {
      this.logger.warn(`Document ${documentUri} has ${segments.length} segments, exceeding limit of ${this.maxSegmentsToProcess}. Truncating.`);
      segments = segments.slice(0, this.maxSegmentsToProcess);
    }
    this.logger.info(`Segmented document ${documentUri} into ${segments.length} segments.`);

    const allResults: AnalysisResult[] = [];

    // TODO: Integrate PipelineCoordinator for parallel processing of segments/engines
    for (const segment of segments) {
      let features: ExtractedFeatures | undefined;
      try {
        // TODO: Update FeatureExtractor to be context-aware
        // features = this.featureExtractor.extractFeatures(segment, documentContext);
        features = (this.featureExtractor as any).extractFeatures(segment); // Temporary cast
      } catch (error: any) {
        this.logger.error(`Feature extraction failed for segment ${segment.id} in document ${documentUri}: ${error.message}`, { error });
        this.engines.forEach(engine => {
          allResults.push({
            segmentId: segment.id, // Or a more context-aware ID
            engine: engine.name,
            findings: [],
            error: `Feature extraction failed: ${error.message}`,
          });
        });
        continue;
      }

      for (const engine of this.engines) {
        this.logger.debug(`Running engine '${engine.name}' on segment '${segment.id}' of document '${documentUri}'`);
        try {
          // TODO: Update IAnalysisEngine to accept IDocumentSegment and IDocumentContext
          // const result = await engine.analyze(segment, documentContext, features);
          const result = await (engine as any).analyze(segment, features); // Temporary cast
          if (result.error) {
            result.error = `Engine ${engine.name} reported an error. Check engine logs.`;
          }
          allResults.push(result);
        } catch (error: any) {
          this.logger.error(`Engine '${engine.name}' failed for segment '${segment.id}': ${error.message}`, { error });
          allResults.push({
            segmentId: segment.id,
            engine: engine.name,
            findings: [],
            error: `Engine ${engine.name} execution failed. Check engine logs.`,
          });
        }
      }
    }

    // TODO: Use ResultMerger if complex merging logic is needed
    // const finalResults = this.resultMerger.merge(allResults, documentContext);

    if (this.resultCache) {
      this.resultCache.set(documentContext, allResults /* or finalResults */);
    }

    this.logger.info(`Completed enhanced analysis for document: ${documentUri}. Total results: ${allResults.length}.`);
    return allResults; // or finalResults
  }

  public addEngine(engine: IAnalysisEngine): void {
    if (this.engines.find(e => e.name === engine.name)) {
      this.logger.warn(`Engine with name '${engine.name}' already exists. Not adding.`);
      return;
    }
    this.engines.push(engine);
    this.logger.info(`Added engine '${engine.name}'.`);
  }

  public removeEngine(engineName: string): void {
    const initialLength = this.engines.length;
    this.engines = this.engines.filter(e => e.name !== engineName);
    if (this.engines.length < initialLength) {
      this.logger.info(`Removed engine '${engineName}'.`);
    } else {
      this.logger.warn(`Engine '${engineName}' not found for removal.`);
    }
  }

  public async dispose(): Promise<void> {
    this.logger.info('Disposing EnhancedAnalysisPipeline and its engines...');
    const disposalPromises = this.engines.map(engine => {
      if (typeof (engine as any).dispose === 'function') {
        return (engine as any).dispose().catch((err: any) => {
          this.logger.error(`Error disposing engine ${engine.name}: ${err.message}`, { error: err });
        });
      }
      return Promise.resolve();
    });
    await Promise.allSettled(disposalPromises);
    this.engines = [];
    this.resultCache?.clear();
    this.logger.info('EnhancedAnalysisPipeline disposed.');
  }
}