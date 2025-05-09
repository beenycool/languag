// src/main/analysis/engines/style/readability-scorer.ts

/**
 * @file Module for calculating readability scores.
 */

import { ExtractedFeatures } from '../../types'; // ExtractedFeatures might provide word/sentence counts
import * as winston from 'winston';
import appLogger from '../../../services/logger';

export interface ReadabilityScores {
  fleschReadingEase?: number;
  fleschKincaidGradeLevel?: number;
  // Add other scores like Gunning Fog, SMOG, etc.
}

export class ReadabilityScorer {
  private logger: winston.Logger;

  constructor(logger?: winston.Logger) {
    this.logger = logger || appLogger.child({ module: 'ReadabilityScorer' });
    this.logger.info('ReadabilityScorer initialized.');
  }

  /**
   * Calculates various readability scores for a given text.
   * @param text - The text to score.
   * @param features - Optional pre-extracted features (e.g., word count, sentence count).
   * @returns A ReadabilityScores object.
   */
  public score(text: string, features?: ExtractedFeatures): ReadabilityScores {
    this.logger.debug('Calculating readability scores.');

    const scores: ReadabilityScores = {};

    // Use pre-extracted features if available, otherwise calculate them.
    const sentences = features?.sentenceCount || this.countSentences(text);
    const words = features?.wordCount || this.countWords(text);
    const syllables = this.countSyllables(text); // Syllable counting is complex

    if (sentences > 0 && words > 0) {
      // Flesch Reading Ease
      // Formula: 206.835 - 1.015 * (total words / total sentences) - 84.6 * (total syllables / total words)
      scores.fleschReadingEase = 206.835 - 1.015 * (words / sentences) - 84.6 * (syllables / words);

      // Flesch-Kincaid Grade Level
      // Formula: 0.39 * (total words / total sentences) + 11.8 * (total syllables / total words) - 15.59
      scores.fleschKincaidGradeLevel = 0.39 * (words / sentences) + 11.8 * (syllables / words) - 15.59;

      // Clamp scores to reasonable ranges if necessary
      scores.fleschReadingEase = Math.max(0, Math.min(100, scores.fleschReadingEase)); // Typically 0-100
      scores.fleschKincaidGradeLevel = Math.max(0, scores.fleschKincaidGradeLevel); // Grade level
    } else {
      this.logger.warn('Cannot calculate readability: zero sentences or words.');
    }

    return scores;
  }

  private countWords(text: string): number {
    return text.split(/\s+/).filter(word => word.length > 0).length;
  }

  private countSentences(text: string): number {
    // Basic sentence counter, can be improved.
    const matches = text.match(/[.!?]+/g);
    return matches ? matches.length : (text.trim().length > 0 ? 1 : 0);
  }

  /**
   * Counts syllables in a given text. This is a very complex task.
   * This is a highly simplified placeholder. A proper implementation would use a dictionary
   * or more sophisticated linguistic rules.
   */
  private countSyllables(text: string): number {
    if (!text) return 0;
    const words = text.toLowerCase().split(/\s+/).filter(Boolean);
    let totalSyllables = 0;

    words.forEach(word => {
      if (word.length <= 3) {
        totalSyllables += 1;
        return;
      }
      // Remove non-alphabetic characters for syllable counting
      word = word.replace(/[^a-z]/gi, '');
      if (!word) return;

      word = word.replace(/(?:[^laeiouy]es|ed|[^laeiouy]e)$/, ''); // Remove common suffixes
      word = word.replace(/^y/, ''); // Handle 'y' at the start

      const vowelMatches = word.match(/[aeiouy]{1,2}/g); // Match one or two vowels
      totalSyllables += vowelMatches ? vowelMatches.length : 0;
    });
    return Math.max(1, totalSyllables); // Ensure at least 1 syllable for non-empty text
  }

  // public dispose(): Promise<void> {
  //   // Cleanup if necessary
  //   this.logger.info('ReadabilityScorer disposed.');
  //   return Promise.resolve();
  // }
}