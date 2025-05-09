// src/main/analysis/engines/tone/formality-detector.ts

/**
 * @file Module for detecting formality level.
 */

import { IDocumentSegment, IDocumentContext } from '../../context/document-context';
import { LlmService } from '../../../services/llm-service';
import * as winston from 'winston';
import appLogger from '../../../services/logger';
import { sanitizePrompts, addInstructionFencing, sanitizeLlmOutput } from '../../../../shared/utils/llm-security';
import { sanitizeError } from '../../../../shared/utils/sanitization';

export type Formality = 'formal' | 'neutral' | 'informal';

export interface FormalityLevel {
  level: Formality;
  confidence: number; // 0-1
  details?: Record<string, any>; // e.g., specific words or phrases indicating formality
}

export class FormalityDetector {
  private llmService?: LlmService;
  private logger: winston.Logger;

  constructor(llmService?: LlmService, logger?: winston.Logger) {
    this.llmService = llmService;
    this.logger = logger || appLogger.child({ module: 'FormalityDetector' });
    this.logger.info('FormalityDetector initialized.');
  }

  /**
   * Detects the formality level of a given text segment.
   * This is a placeholder and would typically involve NLP or LLM interaction.
   * @param segment - The document segment to analyze.
   * @param documentContext - Optional context of the entire document.
   * @returns A promise that resolves to a FormalityLevel object.
   */
  public async detect(
    segment: IDocumentSegment,
    documentContext?: IDocumentContext,
  ): Promise<FormalityLevel> {
    this.logger.debug(`Detecting formality for segment: ${segment.id}`, { documentUri: documentContext?.uri });

    // Simple rule-based placeholder
    const text = segment.text; // Case sensitive might be important for some formal/informal cues
    if (text.match(/\b(gonna|wanna|ain't|dude|lol|BTW|FYI)\b/)) {
      return { level: 'informal', confidence: 0.85, details: { reason: 'Informal slang/abbreviations' } };
    }
    if (text.match(/\b(heretofore|shall|henceforth|pursuant to|esteemed)\b/i) || text.includes("To Whom It May Concern:")) {
      return { level: 'formal', confidence: 0.9, details: { reason: 'Formal lexicon/phrasing' } };
    }
    // Check for contractions (often less formal, but not always a strong indicator alone)
    if (text.match(/\b(I'm|you're|he's|she's|it's|we're|they're|don't|can't|won't)\b/)) {
        // If no strong formal indicators, contractions might suggest neutral to informal
        // This is a weak rule and needs context.
        // For now, let's not make a strong claim based on contractions alone without LLM.
    }


    // Fallback or LLM-based analysis
    if (this.llmService) {
      try {
        const instructions = `Assess the formality level of the following text (formal, neutral, informal) and provide a confidence score (0.0-1.0).\n\nResponse format: LEVEL: [formality_level], CONFIDENCE: [score]`;
        const userData = segment.text;
        const fencedPrompt = addInstructionFencing(instructions, userData);
        this.logger.debug(`[FormalityDetector] LLM prompt (fenced, first 100): ${fencedPrompt.substring(0,100)}...`);

        // const rawLlmResponse = await this.llmService.process({ type: 'generate', input: fencedPrompt });
        // Simulate response for now
        const simulatedRawResponse = `LEVEL: neutral, CONFIDENCE: 0.6`;
        const sanitizedLlmResponse = sanitizeLlmOutput(simulatedRawResponse);

        if (sanitizedLlmResponse) {
          this.logger.debug(`[FormalityDetector] Sanitized LLM Response: ${sanitizedLlmResponse}`);
          const levelMatch = sanitizedLlmResponse.match(/LEVEL:\s*(\w+)/i);
          const confidenceMatch = sanitizedLlmResponse.match(/CONFIDENCE:\s*([0-9.]+)/i);

          if (levelMatch && confidenceMatch) {
            return {
              level: levelMatch[1].toLowerCase() as Formality,
              confidence: parseFloat(confidenceMatch[1]),
            };
          }
          this.logger.warn(`LLM formality detection for segment ${segment.id} did not return expected format after sanitization. Response: ${sanitizedLlmResponse}. Falling back.`);
        } else {
           this.logger.warn(`LLM formality detection for segment ${segment.id} resulted in empty content after sanitization. Falling back.`);
        }
      } catch (error) {
        const rawErrorMessage = error instanceof Error ? error.message : String(error);
        const sanitizedErrorMessage = sanitizeError(rawErrorMessage, 'LLM formality detection');
        this.logger.error(`Error during LLM formality detection for segment ${segment.id}: ${sanitizedErrorMessage}`, { originalError: rawErrorMessage, segmentId: segment.id });
      }
    }

    // Default fallback, could be influenced by documentContext if available (e.g. document type)
    if (documentContext?.metadata?.documentType === 'legal_document' || documentContext?.metadata?.documentType === 'academic_paper') {
        return { level: 'formal', confidence: 0.6, details: { reason: 'Inferred from document type (fallback)'} };
    }
    if (documentContext?.metadata?.documentType === 'chat_log' || documentContext?.metadata?.documentType === 'social_media_post') {
        return { level: 'informal', confidence: 0.6, details: { reason: 'Inferred from document type (fallback)'} };
    }

    return { level: 'neutral', confidence: 0.4, details: { reason: 'Default fallback' } };
  }

  // public async dispose(): Promise<void> {
  //   this.logger.info('FormalityDetector disposed.');
  // }
}