// src/main/analysis/pipeline.ts

import { AnalysisResult, IAnalysisEngine, AnalysisPipelineConfig } from './types';
import { IDocumentContext, IDocumentSegment } from './context/document-context';
import { TextProcessor } from './text-processor'; // This will likely need to be context-aware or replaced
import { FeatureExtractor } from './feature-extractor'; // This will also need to be context-aware
import appLogger from '../services/logger';
import { ParallelProcessor } from './utils/parallel-processor'; // Assuming path
import * as winston from 'winston';

/**
 * The AnalysisPipeline class orchestrates the flow of text analysis.
 * It takes raw text, segments it, and then passes segments through
 * a series of analysis engines.
 */
export class AnalysisPipeline {
  private textProcessor: TextProcessor;
  private featureExtractor: FeatureExtractor;
  private engines: IAnalysisEngine[];
  private parallelProcessor: ParallelProcessor<AnalysisResult>;
  private logger: winston.Logger;
  private textProcessorConfig?: { maxInputSize?: number }; // Optional config for TextProcessor
  private featureExtractorConfig?: { maxSegmentSize?: number, maxKeywordsInputLength?: number, sanitizeKeywords?: boolean }; // Optional config for FeatureExtractor
  private maxSegmentsToProcess: number;


  constructor(config: AnalysisPipelineConfig, parentLogger?: winston.Logger) {
    this.logger = parentLogger ? parentLogger : appLogger.child({ service: 'AnalysisPipeline' });
    
    this.textProcessorConfig = config.textProcessorConfig;
    this.featureExtractorConfig = config.featureExtractorConfig;
    this.maxSegmentsToProcess = config.maxSegmentsToProcess ?? 100; // Default to 100 segments

    this.textProcessor = new TextProcessor(this.textProcessorConfig?.maxInputSize);
    this.featureExtractor = new FeatureExtractor(
        this.featureExtractorConfig?.maxSegmentSize,
        this.featureExtractorConfig?.maxKeywordsInputLength,
        this.featureExtractorConfig?.sanitizeKeywords
    );
    this.engines = config.engines;
    this.parallelProcessor = new ParallelProcessor();

    if (!this.engines || this.engines.length === 0) {
      this.logger.warn('AnalysisPipeline initialized with no analysis engines.');
    } else {
      this.logger.info(`AnalysisPipeline initialized with engines: ${this.engines.map(e => e.name).join(', ')}`);
    }
  }

  /**
   * Processes a raw text string through the entire analysis pipeline.
   *
   * @param rawText The raw text to analyze.
   * @param documentId A unique identifier for the document or text source.
   * @returns A promise that resolves to an array of AnalysisResult objects,
   *          one for each engine per segment.
   */
  async analyzeText(rawText: string, documentContext: IDocumentContext): Promise<AnalysisResult[]> {
    const documentId = documentContext.uri;
    this.logger.info(`Starting analysis for document: ${documentId}`);

    let segments: IDocumentSegment[]; // Changed from TextSegment
    try {
      // Assuming TextProcessor is updated or can be adapted to use documentContext and return IDocumentSegment[]
      // For now, we'll cast, but this implies TextProcessor needs changes.
      // Or, this is where ParagraphSegmenter would be used.
      // This part needs careful consideration based on how TextProcessor is meant to evolve.
      // Let's assume textProcessor.segmentText is adapted to take context and return IDocumentSegment[]
      segments = this.textProcessor.segmentText(rawText, documentId, documentContext) as unknown as IDocumentSegment[];
    } catch (error: any) {
      this.logger.error(`Failed to segment text for document ${documentId}: ${error.message}`, { error });
      return [{
        segmentId: `${documentId}-segmentation-error`, // This segmentId might need to align with IDocumentSegment structure
        engine: 'TextProcessor',
        findings: [],
        error: `Text segmentation failed: ${error.message}`,
      }];
    }

    if (segments.length === 0) {
      this.logger.info(`No segments found for document: ${documentId}. Skipping analysis.`);
      return [];
    }
    
    if (segments.length > this.maxSegmentsToProcess) {
        this.logger.warn(`Document ${documentId} has ${segments.length} segments, exceeding the limit of ${this.maxSegmentsToProcess}. Truncating.`);
        segments = segments.slice(0, this.maxSegmentsToProcess);
    }
    this.logger.info(`Segmented document ${documentId} into ${segments.length} segments (max ${this.maxSegmentsToProcess}).`);


    const allResults: AnalysisResult[] = [];

    for (const segment of segments) {
      let features;
      try {
        // Extract features per segment. FeatureExtractor now has its own input size limits.
        // Assuming FeatureExtractor is updated to accept IDocumentSegment and optionally IDocumentContext
        features = this.featureExtractor.extractFeatures(segment, documentContext);
        // this.logger.debug(`Features for segment ${segment.id}:`, features); // Potentially verbose
      } catch (error: any) {
          this.logger.error(`Feature extraction failed for segment ${segment.id} in document ${documentId}: ${error.message}`, { error });
          // Add an error result for this segment for all engines, as analysis cannot proceed reliably.
          this.engines.forEach(engine => {
            allResults.push({
              segmentId: segment.id,
              engine: engine.name,
              findings: [],
              error: `Feature extraction failed: ${error.message}`,
            });
          });
          continue; // Skip to next segment
      }


      const segmentAnalysisTasks = this.engines.map(engine => {
        return async () => {
          this.logger.debug(`Running engine '${engine.name}' on segment '${segment.id}'`);
          try {
            // Pass extracted features to the engine if its interface supports it
            // Assuming analyze method is updated to take IDocumentSegment and optionally IDocumentContext
            const result = await engine.analyze(segment, documentContext /*, features */);
            this.logger.info(`Engine '${engine.name}' completed for segment '${segment.id}' in document ${documentId} with ${result.findings.length} findings.`);
            // Sanitize/generalize error messages from engine failures
            if (result.error) {
                result.error = `Engine ${engine.name} reported an error. Check engine logs.`; // Generic message
            }
            return result;
          } catch (error: any) {
            this.logger.error(`Engine '${engine.name}' failed for segment '${segment.id}': ${error.message}`, { error });
            return {
              segmentId: segment.id,
              engine: engine.name,
              findings: [],
              error: `Engine ${engine.name} execution failed. Check engine logs.`, // Generic message
            };
          }
        };
      });

      // Process engines in parallel for the current segment
      try {
        const segmentResults = await this.parallelProcessor.process(segmentAnalysisTasks);
        allResults.push(...segmentResults);
      } catch (error: any) {
        // This catch is for errors in parallelProcessor itself, though tasks handle their own errors.
        this.logger.error(`Error processing segment ${segment.id} with parallelProcessor: ${error.message}`, { error });
        // Add error results for all engines for this segment if parallel processing itself fails
        this.engines.forEach(engine => {
          allResults.push({
            segmentId: segment.id,
            engine: engine.name,
            findings: [],
            error: `Parallel processing failed for segment. Check pipeline logs.`, // Generic message
          });
        });
      }
    }

    this.logger.info(`Completed analysis for document: ${documentId}. Total results: ${allResults.length}. Processed ${segments.length} segments.`);
    return allResults;
  }

  /**
   * Adds a new analysis engine to the pipeline dynamically.
   * @param engine The IAnalysisEngine instance to add.
   */
  addEngine(engine: IAnalysisEngine): void {
    if (this.engines.find(e => e.name === engine.name)) {
      this.logger.warn(`Engine with name '${engine.name}' already exists in the pipeline. Not adding.`);
      return;
    }
    this.engines.push(engine);
    this.logger.info(`Added engine '${engine.name}' to the pipeline.`);
  }

  /**
   * Removes an analysis engine from the pipeline by its name.
   * @param engineName The name of the engine to remove.
   */
  removeEngine(engineName: string): void {
    const initialLength = this.engines.length;
    this.engines = this.engines.filter(e => e.name !== engineName);
    if (this.engines.length < initialLength) {
      this.logger.info(`Removed engine '${engineName}' from the pipeline.`);
    } else {
      this.logger.warn(`Engine '${engineName}' not found in the pipeline for removal.`);
    }
  }

  /**
   * Gets the list of currently configured engine names.
   */
  getEngineNames(): string[] {
    return this.engines.map(e => e.name);
  }

  /**
   * Disposes of resources held by the pipeline and its engines.
   */
  async dispose(): Promise<void> {
    this.logger.info('Disposing AnalysisPipeline and its engines...');
    const disposalPromises = this.engines.map(engine => {
      if (typeof (engine as any).dispose === 'function') {
        return (engine as any).dispose().catch((err: any) => {
          this.logger.error(`Error disposing engine ${engine.name}: ${err.message}`, { error: err });
        });
      }
      return Promise.resolve();
    });
    await Promise.allSettled(disposalPromises);
    this.engines = []; // Clear engines
    this.logger.info('AnalysisPipeline disposed.');
  }
}