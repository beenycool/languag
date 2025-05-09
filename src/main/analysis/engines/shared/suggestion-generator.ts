// src/main/analysis/engines/shared/suggestion-generator.ts

/**
 * @file Generates context-aware suggestions for analysis findings.
 */

import { Finding } from '../../types';
import { IDocumentSegment, IDocumentContext } from '../../context/document-context';
import { LlmService } from '../../../services/llm-service'; // Optional: for LLM-powered suggestions
import * as winston from 'winston';
import appLogger from '../../../services/logger';

export interface SuggestionContext {
  finding: Finding;
  segment: IDocumentSegment;
  documentContext?: IDocumentContext;
  // Potentially add ExtractedFeatures if useful for suggestions
}

/**
 * Represents a generated suggestion.
 * This could be a simple string or a more complex object with actions.
 */
export interface GeneratedSuggestion {
  description: string; // The text of the suggestion
  action?: 'replace' | 'remove' | 'informational'; // Type of action suggested
  replacementText?: string; // Text to replace with, if action is 'replace'
  confidence?: number; // Confidence in the suggestion (0-1)
}

export class SuggestionGenerator {
  private llmService?: LlmService;
  private logger: winston.Logger;

  constructor(llmService?: LlmService, logger?: winston.Logger) {
    this.llmService = llmService;
    this.logger = logger || appLogger.child({ module: 'SuggestionGenerator' });
    this.logger.info('SuggestionGenerator initialized.');
  }

  /**
   * Generates a suggestion for a given finding and its context.
   * @param context - The SuggestionContext containing the finding and relevant document/segment info.
   * @returns A promise that resolves to a GeneratedSuggestion or null if no suggestion can be made.
   */
  public async generate(context: SuggestionContext): Promise<GeneratedSuggestion | null> {
    this.logger.debug(`Generating suggestion for finding type: ${context.finding.type}`, { findingMsg: context.finding.message });

    // Rule-based or simple suggestions first
    if (context.finding.suggestion) { // If finding already has a simple string suggestion
        // Attempt to make it more actionable if possible
        if (context.finding.type === 'GrammarRuleViolation' && context.finding.message.toLowerCase().includes('consider rephrasing')) {
            return { description: context.finding.suggestion, action: 'replace' }; // Generic replace action
        }
        return { description: context.finding.suggestion, action: 'informational' };
    }

    // Example: Specific suggestion logic based on finding type
    if (context.finding.type === 'StyleSuggestion' && context.finding.message.includes("'utilize'")) {
      return {
        description: "Replace 'utilize' with 'use' for better clarity with a general audience.",
        action: 'replace',
        replacementText: 'use',
        confidence: 0.9,
      };
    }

    if (context.finding.type === 'CulturalSensitivity' && context.finding.message.includes("'You guys'")) {
        return {
            description: "Replace 'you guys' with a more inclusive term like 'everyone', 'folks', or 'team'.",
            action: 'replace', // Could also be informational if multiple options are complex
            // replacementText: 'everyone', // Could pick one, or leave it to user
            confidence: 0.85,
        };
    }


    // LLM-powered suggestions for more complex cases
    if (this.llmService) {
      try {
        const textExcerpt = context.segment.text.substring(
          Math.max(0, (context.finding.offset || 0) - 20),
          Math.min(context.segment.text.length, (context.finding.offset || 0) + (context.finding.length || 0) + 20)
        );

        const prompt = `Given the following text excerpt and an identified issue, provide a concise, actionable suggestion.
        Issue: "${context.finding.message}"
        Text Excerpt (issue is within this part): "${textExcerpt}"
        Original full text segment (for broader context if needed): "${context.segment.text}"
        
        If a direct replacement is appropriate, suggest it. Otherwise, provide guidance.
        Suggestion format: DESCRIPTION: [Your suggestion text] (Optional: ACTION: [replace/remove/informational], REPLACEMENT: [text_if_replace])`;

        // const response = await this.llmService.process({ type: 'generate', input: prompt, options: {maxTokens: 100} });
        // if (response.success && response.content) {
        //   // Parse LLM response
        //   const descMatch = response.content.match(/DESCRIPTION:\s*(.+?)(?:\s*ACTION:|$)/i);
        //   const actionMatch = response.content.match(/ACTION:\s*(\w+)/i);
        //   const replacementMatch = response.content.match(/REPLACEMENT:\s*(.+)/i);

        //   if (descMatch) {
        //     return {
        //       description: descMatch[1].trim(),
        //       action: actionMatch ? actionMatch[1].toLowerCase() as GeneratedSuggestion['action'] : 'informational',
        //       replacementText: replacementMatch ? replacementMatch[1].trim() : undefined,
        //       confidence: 0.7, // LLM suggestions might have varying confidence
        //     };
        //   }
        // }
        this.logger.warn(`LLM suggestion generation for finding "${context.finding.message}" did not return expected format or failed.`);
      } catch (error) {
        this.logger.error(`Error during LLM suggestion generation: ${error instanceof Error ? error.message : error}`);
      }
    }

    this.logger.debug(`No specific suggestion generated for finding type: ${context.finding.type}`);
    return null; // No suggestion could be generated
  }

  // public async dispose(): Promise<void> {
  //   this.logger.info('SuggestionGenerator disposed.');
  // }
}