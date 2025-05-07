// src/main/analysis/feature-extractor.ts

import { TextSegment, ExtractedFeatures } from './types';

/**
 * The FeatureExtractor class is responsible for extracting
 * relevant features from text segments. These features can be used
 * by analysis engines or for metadata.
 */
export class FeatureExtractor {
  /**
   * Extracts a set of predefined features from a text segment.
   *
   * @param segment The TextSegment to analyze.
   * @returns An ExtractedFeatures object.
   */
  extractFeatures(segment: TextSegment): ExtractedFeatures {
    const text = segment.text;

    // Basic word count (splits by space and filters empty strings)
    const wordCount = text.split(/\s+/).filter(Boolean).length;

    // Basic sentence count (splits by common sentence terminators)
    // This is a simplistic approach and might not be accurate for all cases.
    const sentenceCount = text.split(/[.!?]+/).filter(Boolean).length;

    // Basic keyword extraction (e.g., most frequent words, excluding common stop words)
    // This is a placeholder for a more sophisticated keyword extraction logic.
    const keywords = this.extractKeywords(text);

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

    // Example: Convert to lowercase, split by non-alphanumeric, filter short words and common stop words.
    // This is highly simplistic.
    const commonStopWords = new Set(['the', 'a', 'is', 'in', 'it', 'of', 'and', 'to', 'for', 'on', 'with']);
    const words = text
      .toLowerCase()
      .split(/[^a-z0-9]+/)
      .filter(word => word.length > 2 && !commonStopWords.has(word));

    // Count word frequencies
    const wordFrequencies: Record<string, number> = {};
    for (const word of words) {
      wordFrequencies[word] = (wordFrequencies[word] || 0) + 1;
    }

    // Sort by frequency and take top N (e.g., top 5)
    const sortedKeywords = Object.entries(wordFrequencies)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 5)
      .map(([word]) => word);

    return sortedKeywords;
  }
}