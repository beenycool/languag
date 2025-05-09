// src/main/analysis/engines/context-aware-engine.ts

/**
 * @file Base class for analysis engines that are inherently context-aware.
 */

import { BaseEngine } from './base-engine';
import { IDocumentSegment, IDocumentContext } from '../context/document-context';
import { AnalysisResult, ExtractedFeatures, Finding } from '../types';
import { LlmService } from '../../services/llm-service';
import * as winston from 'winston';
import appLogger from '../../services/logger';

/**
 * Abstract base class for analysis engines designed to leverage document and segment context.
 * It extends the general BaseEngine.
 */
export abstract class ContextAwareEngine extends BaseEngine {
  // The 'name' property will be implemented by concrete subclasses.

  constructor(llmService?: LlmService, logger?: winston.Logger) {
    // If a specific logger isn't provided, create a child logger for this engine.
    const engineLogger = logger || appLogger.child({ engineName: 'ContextAwareEngine' }); // Placeholder, name will be overridden
    super(llmService, engineLogger);
    // Ensure the logger reflects the actual engine name once known by the subclass.
    // This might be better handled if subclasses explicitly set `this.logger` after calling super
    // or if BaseEngine's constructor took the name and created the child logger.
    // For now, subclasses should ideally create their own specific child logger.
  }

  /**
   * Abstract method for performing context-aware analysis on a document segment.
   * Concrete engines must implement this method.
   *
   * @param segment - The document segment to analyze.
   * @param documentContext - Optional context of the entire document.
   * @param features - Optional pre-extracted features for this segment.
   * @returns A promise that resolves to an AnalysisResult.
   */
  abstract analyze(
    segment: IDocumentSegment,
    documentContext?: IDocumentContext,
    features?: ExtractedFeatures,
  ): Promise<AnalysisResult>;

  // Helper methods from BaseEngine (createSuccessResult, createErrorResult, queryLLM)
  // are inherited and can be used directly.

  // Example of a new helper method that might be useful in a context-aware engine:
  /**
   * Builds a context-rich prompt prefix that can be used by various analysis tasks.
   * @param segment - The current document segment.
   * @param documentContext - The overall document context.
   * @returns A string to be prepended to a more specific task prompt.
   */
  protected buildContextualPromptPrefix(
    segment: IDocumentSegment,
    documentContext?: IDocumentContext,
  ): string {
    let prefix = "";
    if (documentContext?.language) {
      prefix += `The document language is ${documentContext.language}. `;
    }
    if (documentContext?.metadata?.title) {
      prefix += `The document title is "${documentContext.metadata.title}". `;
    }
    // Add more contextual information as needed, e.g., surrounding paragraphs, document type.
    // Be mindful of prompt length.

    // Information about the current segment's position could also be useful.
    // prefix += `Analyzing segment starting at character ${segment.range.start}.`;

    return prefix.trim();
  }
}