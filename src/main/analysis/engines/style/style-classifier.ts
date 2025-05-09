// src/main/analysis/engines/style/style-classifier.ts

/**
 * @file Module for style detection and classification.
 */

import { IDocumentSegment, IDocumentContext } from '../../context/document-context';
import { LlmService } from '../../../services/llm-service';
import * as winston from 'winston';
import appLogger from '../../../services/logger'; // Assuming appLogger is the main logger instance
import { sanitizePrompts, addInstructionFencing, sanitizeLlmOutput } from '../../../../shared/utils/llm-security';
import { sanitizeError } from '../../../../shared/utils/sanitization';

export interface StyleClassification {
  primaryStyle: string; // e.g., 'formal', 'informal', 'academic', 'technical', 'creative'
  secondaryStyles?: string[];
  confidence: number; // 0-1
  details?: Record<string, any>; // Additional details from classification
}

export class StyleClassifier {
  private llmService?: LlmService;
  private logger: winston.Logger;

  constructor(llmService?: LlmService, logger?: winston.Logger) {
    this.llmService = llmService;
    this.logger = logger || appLogger.child({ module: 'StyleClassifier' });
    this.logger.info('StyleClassifier initialized.');
  }

  /**
   * Classifies the style of a given text segment.
   * This is a placeholder and would typically involve more sophisticated NLP or LLM interaction.
   * @param segment - The document segment to classify.
   * @param documentContext - Optional context of the entire document.
   * @returns A promise that resolves to a StyleClassification object.
   */
  public async classify(
    segment: IDocumentSegment,
    documentContext?: IDocumentContext,
  ): Promise<StyleClassification> {
    this.logger.debug(`Classifying style for segment: ${segment.id}`, { documentUri: documentContext?.uri });

    // Simple rule-based placeholder
    if (segment.text.match(/\b(PhD|methodology|references|abstract)\b/i)) {
      return { primaryStyle: 'academic', confidence: 0.7, details: { reason: 'Keywords match' } };
    }
    if (segment.text.match(/\b(dude|gonna|awesome|lol)\b/i)) {
      return { primaryStyle: 'informal', confidence: 0.8, details: { reason: 'Slang detected' } };
    }
    if (segment.text.match(/\b(shall|heretofore|pursuant to)\b/i)) {
      return { primaryStyle: 'formal', confidence: 0.75, details: { reason: 'Formal lexicon' } };
    }

    // Fallback or LLM-based classification
    if (this.llmService) {
      try {
        const instructions = `Classify the primary writing style of the following text. Common styles include: formal, informal, academic, technical, creative, journalistic, business. Provide the primary style and a confidence score (0.0-1.0).\n\nResponse format: STYLE: [style_name], CONFIDENCE: [score]`;
        const userData = segment.text;

        const fencedPrompt = addInstructionFencing(instructions, userData);
        this.logger.debug(`[StyleClassifier] LLM prompt (fenced, first 100): ${fencedPrompt.substring(0,100)}...`);

        // const rawLlmResponse = await this.llmService.process({ type: 'generate', input: fencedPrompt });
        // Let's simulate a raw response for now as the actual call is commented out
        const rawLlmResponse = `STYLE: academic, CONFIDENCE: 0.85`; // Simulated raw response
        
        // if (rawLlmResponse.success && rawLlmResponse.content) { // Assuming llmService.process returns an object like this
        //   const sanitizedLlmResponse = sanitizeLlmOutput(rawLlmResponse.content);
        const sanitizedLlmResponse = sanitizeLlmOutput(rawLlmResponse); // Using simulated raw response directly

        if (sanitizedLlmResponse) {
          this.logger.debug(`[StyleClassifier] Sanitized LLM Response: ${sanitizedLlmResponse}`);
          // Parse sanitizedLlmResponse to extract style and confidence
          const styleMatch = sanitizedLlmResponse.match(/STYLE:\s*([\w\s-]+)/i); // Allow spaces and hyphens in style name
          const confidenceMatch = sanitizedLlmResponse.match(/CONFIDENCE:\s*([0-9.]+)/i);

          if (styleMatch && confidenceMatch) {
            return { primaryStyle: styleMatch[1].trim().toLowerCase(), confidence: parseFloat(confidenceMatch[1]) };
          }
          this.logger.warn(`LLM style classification for segment ${segment.id} did not return expected format after sanitization. Falling back. Response: ${sanitizedLlmResponse}`);
        } else {
          this.logger.warn(`LLM style classification for segment ${segment.id} resulted in empty content after sanitization. Falling back.`);
        }
        // } else {
        //   this.logger.warn(`LLM style classification for segment ${segment.id} failed or returned no content. Error: ${rawLlmResponse.error}`);
        // }
      } catch (error) {
        const rawErrorMessage = error instanceof Error ? error.message : String(error);
        const sanitizedErrorMessage = sanitizeError(rawErrorMessage, 'LLM style classification');
        this.logger.error(`Error during LLM style classification for segment ${segment.id}: ${sanitizedErrorMessage}`, { originalError: rawErrorMessage, segmentId: segment.id });
      }
    }

    // Default fallback
    return { primaryStyle: 'unknown', confidence: 0.3, details: { reason: 'Default fallback' } };
  }

  // public async dispose(): Promise<void> {
  //   // Cleanup if necessary
  //   this.logger.info('StyleClassifier disposed.');
  // }
}