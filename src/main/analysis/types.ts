// src/main/analysis/types.ts

import { IDocumentSegment, IDocumentContext } from '../../shared/types/context';

// TextSegment is now replaced by IDocumentSegment from shared types.

import { AnalysisResult, Finding, ExtractedFeatures } from '../../shared/types/analysis';

// AnalysisResult, Finding, and ExtractedFeatures are now imported from shared types.

/**
 * Interface for any analysis engine.
 */
export interface IAnalysisEngine {
  readonly name: string;
  /**
   * Analyzes a given document segment, optionally using document context and pre-extracted features.
   * @param segment The document segment to analyze.
   * @param documentContext Optional context of the entire document.
   * @param features Optional pre-extracted features for this segment.
   * @returns A promise that resolves to an AnalysisResult.
   */
  analyze(
    segment: IDocumentSegment,
    documentContext?: IDocumentContext,
    features?: ExtractedFeatures,
  ): Promise<AnalysisResult>;
  dispose?(): Promise<void>; // Optional dispose method for cleanup
}

/**
 * Configuration for the Analysis Pipeline.
 */
export interface AnalysisPipelineConfig {
  engines: IAnalysisEngine[];
  textProcessorConfig?: {
    maxInputSize?: number;
  };
  featureExtractorConfig?: {
    maxSegmentSize?: number;
    maxKeywordsInputLength?: number;
    sanitizeKeywords?: boolean;
  };
  maxSegmentsToProcess?: number;
  // Add other pipeline-specific configurations as needed
}

// ExtractedFeatures is now imported from shared types.

// Re-export for local convenience if needed, or update direct imports elsewhere.
export type { AnalysisResult, Finding, ExtractedFeatures };