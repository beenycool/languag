// src/main/analysis/text-processor.ts

import { IDocumentSegment, IDocumentContext } from '../../shared/types/context';
import { ParagraphSegmenter, IParagraphSegmenterConfig } from './context/paragraph-segmenter';

/**
 * The TextProcessor class is responsible for breaking down raw text
 * into manageable segments for analysis. It can also perform
 * initial cleaning or normalization if required.
 */
export class TextProcessor {
  private readonly maxInputSize: number;
  private paragraphSegmenter: ParagraphSegmenter;

  constructor(
    maxInputSize: number = 1000000, // Default to 1MB
    paragraphSegmenterConfig?: IParagraphSegmenterConfig
  ) {
    this.maxInputSize = maxInputSize;
    this.paragraphSegmenter = new ParagraphSegmenter(paragraphSegmenterConfig);
  }

  /**
   * Segments a given raw text into an array of TextSegment objects.
   * The segmentation strategy can be simple (e.g., by paragraph) or more complex.
   * For now, we'll assume a simple paragraph-based segmentation.
   *
   * @param rawText The raw text input.
   * @param docContext The document context.
   * @returns An array of IDocumentSegment objects.
   * @throws Error if rawText exceeds the configured maxInputSize.
   */
  segmentText(rawText: string, docContext: IDocumentContext): IDocumentSegment[] {
    if (rawText.length > this.maxInputSize) {
      throw new Error(
        `Input text size (${rawText.length} characters) exceeds the configured limit of ${this.maxInputSize} characters.`
      );
    }
    // ParagraphSegmenter handles empty text, so this check might be redundant
    // if (!rawText || rawText.trim() === '') {
    //   return [];
    // }

    // Delegate segmentation to ParagraphSegmenter
    return this.paragraphSegmenter.segment(rawText, docContext);
  }

  /**
   * Cleans and normalizes a text segment.
   * This could include removing extra whitespace, converting to a specific case, etc.
   * For now, it's a placeholder for potential future enhancements.
   *
   * @param segment The IDocumentSegment to clean.
   * @returns The cleaned IDocumentSegment.
   */
  normalizeSegment(segment: IDocumentSegment): IDocumentSegment {
    // Placeholder for normalization logic
    // e.g., segment.text = segment.text.replace(/\s+/g, ' ').trim();
    // Ensure the context is preserved if it exists
    const cleanedText = segment.text.replace(/\s+/g, ' ').trim();
    return {
      ...segment,
      text: cleanedText,
    };
  }
}