// src/shared/types/analysis.ts

/**
 * @file Shared types related to analysis results and findings.
 */

// We might need IDocumentSegment if types here directly reference it,
// but for now, AnalysisResult uses segmentId which is a string.
// import { IDocumentSegment } from './context';

/**
 * Represents an analysis result for a document segment.
 * The `segmentId` should correspond to `IDocumentSegment.id`.
 */
export interface AnalysisResult {
  segmentId: string; // Corresponds to IDocumentSegment.id
  engine: string; // Name of the analysis engine
  findings: Finding[];
  error?: string; // Optional error message if analysis failed
  // Potentially add a reference to the full document context if needed at result level
  // documentUri?: string;
}

/**
 * Represents a specific finding within an analysis.
 */
export interface Finding {
  type: string; // e.g., 'grammar', 'style', 'sentiment', 'security'
  message: string;
  severity: 'info' | 'warning' | 'error' | 'critical'; // Added 'critical' for security
  suggestion?: string; // Optional suggestion for improvement
  confidence?: number; // 0-1 confidence score
  offset?: number; // Character offset in the original segment's text
  length?: number; // Length of the text sub-segment related to the finding
  // Consider adding:
  // ruleId?: string; // Identifier for the rule that triggered the finding
  // data?: Record<string, any>; // Additional data specific to the finding type
}

/**
 * Represents extracted features from a text segment.
 * This can be used by various engines or components.
 */
export interface ExtractedFeatures {
  wordCount: number;
  sentenceCount: number;
  keywords: string[];
  // language?: string; // Detected language of the segment
  // sentiment?: { score: number; label: string }; // Overall sentiment
  // Add more features as they are defined, e.g.,
  // namedEntities?: Array<{text: string, type: string, offset: number, length: number}>;
  // readabilityScore?: Record<string, number>; // e.g., { fleschKincaid: 75 }
}