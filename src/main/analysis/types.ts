// src/main/analysis/types.ts

/**
 * Represents a segment of text to be analyzed.
 */
export interface TextSegment {
  id: string;
  text: string;
  metadata?: Record<string, any>;
}

/**
 * Represents an analysis result for a text segment.
 */
export interface AnalysisResult {
  segmentId: string;
  engine: string; // Name of the analysis engine
  findings: Finding[];
  error?: string; // Optional error message if analysis failed
}

/**
 * Represents a specific finding within an analysis.
 */
export interface Finding {
  type: string; // e.g., 'grammar', 'style', 'sentiment'
  message: string;
  severity: 'info' | 'warning' | 'error';
  suggestion?: string; // Optional suggestion for improvement
  confidence?: number; // 0-1 confidence score
  offset?: number; // Character offset in the original text
  length?: number; // Length of the text segment related to the finding
}

/**
 * Interface for any analysis engine.
 */
export interface IAnalysisEngine {
  readonly name: string;
  analyze(segment: TextSegment): Promise<AnalysisResult>;
}

/**
 * Configuration for the Analysis Pipeline.
 */
export interface AnalysisPipelineConfig {
  engines: IAnalysisEngine[];
  // Add other pipeline-specific configurations as needed
}

/**
 * Represents extracted features from a text segment.
 */
export interface ExtractedFeatures {
  wordCount: number;
  sentenceCount: number;
  keywords: string[];
  // Add more features as they are defined
}