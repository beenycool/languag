// src/main/analysis/context/document-context.ts

/**
 * @file Core context data structures and types for document analysis.
 */

/**
 * Represents the overall context of a document.
 */
export interface IDocumentContext {
  uri: string; // Unique identifier for the document
  language?: string; // Detected or specified language of the document
  metadata?: Record<string, any>; // Additional metadata
  // Add other core context properties as needed
}

/**
 * Represents a segment of the document, e.g., a paragraph or section.
 */
export interface IDocumentSegment {
  id: string; // Unique identifier for the segment
  text: string; // The text content of the segment
  range: { start: number; end: number }; // Character offsets in the original document
  context?: Partial<IDocumentContext>; // Segment-specific context overrides
}

// Add other context-related types and interfaces as needed