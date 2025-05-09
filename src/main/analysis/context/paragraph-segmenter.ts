// src/main/analysis/context/paragraph-segmenter.ts

/**
 * @file Supports multi-paragraph analysis by segmenting text into paragraphs.
 */

import { IDocumentSegment, IDocumentContext } from './document-context';
import { v4 as uuidv4 } from 'uuid'; // For generating unique segment IDs

/**
 * Configuration for the ParagraphSegmenter.
 */
export interface IParagraphSegmenterConfig {
  // Defines how paragraphs are delimited.
  // Default is one or more newline characters.
  delimiterRegex?: RegExp;
  minLength?: number; // Minimum length for a segment to be considered a paragraph
}

/**
 * Segments text into paragraphs for analysis.
 */
export class ParagraphSegmenter {
  private config: IParagraphSegmenterConfig;

  constructor(config: IParagraphSegmenterConfig = {}) {
    this.config = {
      delimiterRegex: config.delimiterRegex || /\n\s*\n+/, // Matches one or more blank lines
      minLength: config.minLength || 10, // Default minimum paragraph length
    };
  }

  /**
   * Segments the input text into an array of document segments (paragraphs).
   * @param text - The full text of the document.
   * @param documentContext - The context of the document to which these segments belong.
   * @returns An array of IDocumentSegment representing the paragraphs.
   */
  public segment(text: string, documentContext?: IDocumentContext): IDocumentSegment[] {
    const segments: IDocumentSegment[] = [];
    if (!text || text.trim().length === 0) {
      return segments;
    }

    const paragraphs = text.split(this.config.delimiterRegex!);
    let currentIndex = 0;

    for (const paraText of paragraphs) {
      const trimmedPara = paraText.trim();
      if (trimmedPara.length >= this.config.minLength!) {
        const startIndex = text.indexOf(paraText, currentIndex);
        const endIndex = startIndex + paraText.length;

        segments.push({
          id: uuidv4(),
          text: trimmedPara,
          range: { start: startIndex, end: endIndex },
          context: documentContext ? { ...documentContext } : undefined,
        });
        currentIndex = endIndex;
      } else if (paraText.length > 0) {
        // Handle shorter segments or merge them if necessary,
        // for now, we just update currentIndex
        const startIndex = text.indexOf(paraText, currentIndex);
        currentIndex = startIndex + paraText.length;
      }
    }
    return segments;
  }

  /**
   * A simpler segmentation strategy that splits by single newlines,
   * useful for different types of content.
   * @param text The text to segment.
   * @param documentContext Optional document context.
   * @returns An array of IDocumentSegment.
   */
  public segmentByLine(text: string, documentContext?: IDocumentContext): IDocumentSegment[] {
    const segments: IDocumentSegment[] = [];
    if (!text || text.trim().length === 0) {
      return segments;
    }

    const lines = text.split(/\n/);
    let currentIndex = 0;

    for (const lineText of lines) {
      const trimmedLine = lineText.trim();
      // For line-based segmentation, we might not enforce a minLength or a very small one.
      if (trimmedLine.length > 0) {
        const startIndex = text.indexOf(lineText, currentIndex);
        const endIndex = startIndex + lineText.length;
        segments.push({
          id: uuidv4(),
          text: trimmedLine,
          range: { start: startIndex, end: endIndex },
          context: documentContext ? { ...documentContext } : undefined,
        });
        currentIndex = endIndex;
      } else if (lineText.length === 0 && currentIndex < text.length -1) {
        // Account for the newline character itself if it's not the last char
         currentIndex +=1;
      }
    }
    return segments;
  }
}

// Example usage (optional)
// const segmenter = new ParagraphSegmenter();
// const sampleDocText = "This is the first paragraph.\n\nThis is the second one, a bit longer.\n\nShort.\n\nAnd a final paragraph.";
// const docCtx: IDocumentContext = { uri: "sample.txt" };
// const paragraphs = segmenter.segment(sampleDocText, docCtx);
// console.log(paragraphs);

// const lineSegmenter = new ParagraphSegmenter();
// const sampleLines = "First line.\nSecond line.\nThird line, also important.";
// const lines = lineSegmenter.segmentByLine(sampleLines, docCtx);
// console.log(lines);