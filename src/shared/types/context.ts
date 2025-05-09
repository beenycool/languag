// src/shared/types/context.ts

/**
 * @file Shared types related to document context for analysis.
 */

/**
 * Represents the overall context of a document.
 * This interface is shared and can be used by various parts of the application.
 */
export interface IDocumentContext {
  uri: string; // Unique identifier for the document (e.g., file path, URL)
  language?: string; // Detected or specified language of the document (e.g., 'en', 'es')
  metadata?: Record<string, any>; // Additional metadata (e.g., author, creationDate, custom tags)
  // Consider adding other relevant top-level context properties:
  // documentType?: 'email' | 'article' | 'report' | 'code';
  // domain?: string; // e.g., 'technical', 'legal', 'medical'
}

/**
 * Represents a segment of the document, such as a paragraph, sentence, or section.
 * This interface is shared.
 */
export interface IDocumentSegment {
  id: string; // Unique identifier for the segment (e.g., UUID)
  text: string; // The raw text content of the segment
  range: { start: number; end: number }; // Character offsets in the original document
  context?: Partial<IDocumentContext>; // Segment-specific context overrides or additions
  // Consider adding other segment-specific properties:
  // segmentType?: 'paragraph' | 'sentence' | 'heading1' | 'listItem';
  // parentSegmentId?: string; // For hierarchical segmentation
}

/**
 * Optional: Represents more detailed range information if needed.
 */
export interface ITextRange {
  startLine: number;
  startColumn: number;
  endLine: number;
  endColumn: number;
  startOffset: number; // Character offset from the beginning of the document
  endOffset: number;   // Character offset from the beginning of the document
}