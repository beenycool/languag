// src/main/analysis/engines/tone/emotional-analyzer.ts

/**
 * @file Module for analyzing emotional tone.
 */

import { IDocumentSegment, IDocumentContext } from '../../context/document-context';
import { LlmService } from '../../../services/llm-service';
import * as winston from 'winston';
import appLogger from '../../../services/logger';
import { sanitizePrompts, addInstructionFencing, sanitizeLlmOutput } from '../../../../shared/utils/llm-security';
import { sanitizeError } from '../../../../shared/utils/sanitization';

export type Emotion = 'joy' | 'sadness' | 'anger' | 'fear' | 'surprise' | 'disgust' | 'neutral' | 'mixed';

export interface EmotionalProfile {
  primaryEmotion: Emotion;
  primaryEmotionScore?: number; // Confidence or intensity 0-1
  secondaryEmotions?: Emotion[];
  sentiment?: { // Overall positive/negative/neutral
    score: number; // e.g., -1 to 1
    label: 'positive' | 'negative' | 'neutral';
  };
  details?: Record<string, any>; // e.g., specific words contributing to an emotion
}

export class EmotionalAnalyzer {
  private llmService?: LlmService;
  private logger: winston.Logger;

  constructor(llmService?: LlmService, logger?: winston.Logger) {
    this.llmService = llmService;
    this.logger = logger || appLogger.child({ module: 'EmotionalAnalyzer' });
    this.logger.info('EmotionalAnalyzer initialized.');
  }

  /**
   * Analyzes the emotional tone of a given text segment.
   * This is a placeholder and would typically involve sophisticated NLP or LLM interaction.
   * @param segment - The document segment to analyze.
   * @param documentContext - Optional context of the entire document.
   * @returns A promise that resolves to an EmotionalProfile object.
   */
  public async analyze(
    segment: IDocumentSegment,
    documentContext?: IDocumentContext,
  ): Promise<EmotionalProfile> {
    this.logger.debug(`Analyzing emotions for segment: ${segment.id}`, { documentUri: documentContext?.uri });

    // Simple rule-based placeholder
    const text = segment.text.toLowerCase();
    if (text.includes('happy') || text.includes('joyful') || text.includes('excited')) {
      return { primaryEmotion: 'joy', primaryEmotionScore: 0.8, sentiment: { score: 0.7, label: 'positive' } };
    }
    if (text.includes('sad') || text.includes('cry') || text.includes('unhappy')) {
      return { primaryEmotion: 'sadness', primaryEmotionScore: 0.75, sentiment: { score: -0.6, label: 'negative' } };
    }
    if (text.includes('angry') || text.includes('furious') || text.includes('outrage')) {
      return { primaryEmotion: 'anger', primaryEmotionScore: 0.85, sentiment: { score: -0.8, label: 'negative' } };
    }

    // Fallback or LLM-based analysis
    if (this.llmService) {
      try {
        const instructions = `Analyze the emotional tone of the following text. Identify the primary emotion (joy, sadness, anger, fear, surprise, disgust, neutral) and its intensity (0.0-1.0). Also provide an overall sentiment score (-1.0 to 1.0) and label (positive, negative, neutral).\n\nResponse format: PRIMARY_EMOTION: [emotion], INTENSITY: [score], SENTIMENT_SCORE: [score], SENTIMENT_LABEL: [label]`;
        const userData = segment.text;
        const fencedPrompt = addInstructionFencing(instructions, userData);
        this.logger.debug(`[EmotionalAnalyzer] LLM prompt (fenced, first 100): ${fencedPrompt.substring(0,100)}...`);

        // const rawLlmResponse = await this.llmService.process({ type: 'generate', input: fencedPrompt });
        // Simulate response for now
        const simulatedRawResponse = `PRIMARY_EMOTION: joy, INTENSITY: 0.8, SENTIMENT_SCORE: 0.7, SENTIMENT_LABEL: positive`;
        const sanitizedLlmResponse = sanitizeLlmOutput(simulatedRawResponse);
        
        if (sanitizedLlmResponse) {
          this.logger.debug(`[EmotionalAnalyzer] Sanitized LLM Response: ${sanitizedLlmResponse}`);
          const emotionMatch = sanitizedLlmResponse.match(/PRIMARY_EMOTION:\s*(\w+)/i);
          const intensityMatch = sanitizedLlmResponse.match(/INTENSITY:\s*([0-9.]+)/i);
          const sentimentScoreMatch = sanitizedLlmResponse.match(/SENTIMENT_SCORE:\s*(-?[0-9.]+)/i);
          const sentimentLabelMatch = sanitizedLlmResponse.match(/SENTIMENT_LABEL:\s*(\w+)/i);

          if (emotionMatch && intensityMatch && sentimentScoreMatch && sentimentLabelMatch) {
            return {
              primaryEmotion: emotionMatch[1].toLowerCase() as Emotion,
              primaryEmotionScore: parseFloat(intensityMatch[1]),
              sentiment: {
                score: parseFloat(sentimentScoreMatch[1]),
                label: sentimentLabelMatch[1].toLowerCase() as 'positive' | 'negative' | 'neutral',
              },
            };
          }
          this.logger.warn(`LLM emotion analysis for segment ${segment.id} did not return expected format after sanitization. Response: ${sanitizedLlmResponse}. Falling back.`);
        } else {
          this.logger.warn(`LLM emotion analysis for segment ${segment.id} resulted in empty content after sanitization. Falling back.`);
        }
      } catch (error) {
        const rawErrorMessage = error instanceof Error ? error.message : String(error);
        const sanitizedErrorMessage = sanitizeError(rawErrorMessage, 'LLM emotion analysis');
        this.logger.error(`Error during LLM emotion analysis for segment ${segment.id}: ${sanitizedErrorMessage}`, { originalError: rawErrorMessage, segmentId: segment.id });
      }
    }

    return { primaryEmotion: 'neutral', primaryEmotionScore: 0.5, sentiment: { score: 0, label: 'neutral' }, details: { reason: 'Default fallback' } };
  }

  // public async dispose(): Promise<void> {
  //   this.logger.info('EmotionalAnalyzer disposed.');
  // }
}