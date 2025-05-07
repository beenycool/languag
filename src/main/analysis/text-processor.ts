// src/main/analysis/text-processor.ts

import { TextSegment } from './types';

/**
 * The TextProcessor class is responsible for breaking down raw text
 * into manageable segments for analysis. It can also perform
 * initial cleaning or normalization if required.
 */
export class TextProcessor {
  /**
   * Segments a given raw text into an array of TextSegment objects.
   * The segmentation strategy can be simple (e.g., by paragraph) or more complex.
   * For now, we'll assume a simple paragraph-based segmentation.
   *
   * @param rawText The raw text input.
   * @param documentId An identifier for the document or source of the text.
   * @returns An array of TextSegment objects.
   */
  segmentText(rawText: string, documentId: string): TextSegment[] {
    if (!rawText || rawText.trim() === '') {
      return [];
    }

    // Simple segmentation by paragraphs (double line breaks)
    // More sophisticated segmentation might be needed for different text types.
    const paragraphs = rawText.split(/\n\s*\n/);

    return paragraphs.map((paragraph, index) => ({
      id: `${documentId}-p${index + 1}`,
      text: paragraph.trim(),
      metadata: {
        documentId,
        paragraphNumber: index + 1,
      },
    }));
  }

  /**
   * Cleans and normalizes a text segment.
   * This could include removing extra whitespace, converting to a specific case, etc.
   * For now, it's a placeholder for potential future enhancements.
   *
   * @param segment The TextSegment to clean.
   * @returns The cleaned TextSegment.
   */
  normalizeSegment(segment: TextSegment): TextSegment {
    // Placeholder for normalization logic
    // e.g., segment.text = segment.text.replace(/\s+/g, ' ').trim();
    return segment;
  }
}