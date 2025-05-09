// src/main/analysis/feature-extractor.ts

import { IDocumentSegment, IDocumentContext } from '../../shared/types/context';
import { ExtractedFeatures } from './types';
import { sanitizeInput } from '../../shared/utils/sanitization';

/**
 * The FeatureExtractor class is responsible for extracting
 * relevant features from text segments. These features can be used
 * by analysis engines or for metadata.
 */
export class FeatureExtractor {
  private readonly maxSegmentSize: number;
  private readonly maxKeywordsInputLength: number;
  private readonly sanitizeKeywords: boolean;

  constructor(
    maxSegmentSize: number = 10000, // Default to 10k chars
    maxKeywordsInputLength: number = 5000, // Default to 5k chars for keyword extraction
    sanitizeKeywords: boolean = true // Default to true
  ) {
    this.maxSegmentSize = maxSegmentSize;
    this.maxKeywordsInputLength = maxKeywordsInputLength;
    this.sanitizeKeywords = sanitizeKeywords;
  }

  /**
   * Extracts a set of predefined features from a text segment.
   *
   * @param segment The IDocumentSegment to analyze.
   * @param docContext Optional context of the entire document.
   * @returns An ExtractedFeatures object.
   * @throws Error if segment.text exceeds the configured maxSegmentSize.
   */
  extractFeatures(segment: IDocumentSegment, docContext?: IDocumentContext): ExtractedFeatures {
    if (segment.text.length > this.maxSegmentSize) {
      throw new Error(
        `Segment text size (${segment.text.length} characters) exceeds the configured limit of ${this.maxSegmentSize} characters.`
      );
    }
    const text = segment.text;

    // docContext can be used here to influence feature extraction if needed.
    // For example, language-specific stop words or analysis.
    // if (docContext?.language === 'es') { /* use Spanish stop words */ }

    // Basic word count (splits by space and filters empty strings)
    const wordCount = text.split(/\s+/).filter(Boolean).length;

    // Basic sentence count (splits by common sentence terminators)
    // This is a simplistic approach and might not be accurate for all cases.
    const sentenceCount = text.split(/[.!?]+/).filter(Boolean).length;

    // Basic keyword extraction (e.g., most frequent words, excluding common stop words)
    // This is a placeholder for a more sophisticated keyword extraction logic.
    const keywords = this.extractKeywords(text.substring(0, this.maxKeywordsInputLength));

    return {
      wordCount,
      sentenceCount,
      keywords,
    };
  }

  /**
   * A simple keyword extraction method.
   * This should be replaced or enhanced with a more robust NLP approach.
   *
   * @param text The text to extract keywords from.
   * @returns An array of potential keywords.
   */
  private extractKeywords(text: string): string[] {
    if (!text) {
      return [];
    }

    // Limit input string length for keyword extraction to prevent performance issues.
    const processedText = text.length > this.maxKeywordsInputLength
      ? text.substring(0, this.maxKeywordsInputLength)
      : text;


    // Example: Convert to lowercase, split by non-alphanumeric, filter short words and common stop words.
    // This is highly simplistic.
    const commonStopWords = new Set(['the', 'a', 'is', 'in', 'it', 'of', 'and', 'to', 'for', 'on', 'with']);
    const words = processedText
      .toLowerCase()
      .split(/[^a-z0-9]+/)
      .filter(word => word.length > 2 && !commonStopWords.has(word));

    // Count word frequencies
    const wordFrequencies: Record<string, number> = {};
    for (const word of words) {
      wordFrequencies[word] = (wordFrequencies[word] || 0) + 1;
    }

    // Sort by frequency and take top N (e.g., top 5)
    let sortedKeywords = Object.entries(wordFrequencies)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 5)
      .map(([word]) => word);

    if (this.sanitizeKeywords) {
      sortedKeywords = sortedKeywords.map(keyword => sanitizeInput(keyword));
      // Potentially exclude sensitive terms if a list is available
      // For example: sortedKeywords = sortedKeywords.filter(kw => !isSensitive(kw));
    }

    return sortedKeywords;
  }
}