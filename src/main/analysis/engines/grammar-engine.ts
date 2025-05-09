// src/main/analysis/engines/grammar-engine.ts

import { ContextAwareEngine } from './context-aware-engine'; // Changed from BaseEngine
import { IDocumentSegment, IDocumentContext } from '../context/document-context'; // Added
import { AnalysisResult, Finding, ExtractedFeatures } from '../types'; // Added ExtractedFeatures
import { LlmService, getLlmService } from '../../services/llm-service';
import appLogger from '../../services/logger';
import * as winston from 'winston';
import { GenerationOptions } from '../../../shared/types/llm';

export class GrammarEngine extends ContextAwareEngine { // Changed from BaseEngine
  readonly name: string = 'GrammarEngine';

  constructor(llmService?: LlmService, logger?: winston.Logger) {
    // Pass the specific child logger to the super constructor
    super(llmService || getLlmService(), logger || appLogger.child({ engineName: 'GrammarEngine' }));
  }

  async analyze(
    segment: IDocumentSegment, // Changed from TextSegment
    documentContext?: IDocumentContext, // Added
    features?: ExtractedFeatures // Added
  ): Promise<AnalysisResult> {
    this.logger.info(`[${this.name}] Analyzing segment: ${segment.id}`);
    // Example of using documentContext to enrich the prompt, if desired
    const contextualPrefix = this.buildContextualPromptPrefix(segment, documentContext);
    
    try {
      const prompt = `
        ${contextualPrefix ? contextualPrefix + '\n\n' : ''}Analyze the following text for grammatical errors.
        Identify any mistakes in grammar, punctuation, and syntax.
        For each error, provide:
        1. A brief description of the error.
        2. The incorrect phrase or sentence.
        3. A suggestion for correction.
        4. Severity (error, warning).

        Format your response as a JSON array of objects, where each object has 'description', 'incorrectPhrase', 'suggestion', and 'severity' fields.
        If no errors are found, return an empty array.

        Example of an error object:
        {
          "description": "Incorrect subject-verb agreement.",
          "incorrectPhrase": "The dogs barks loudly.",
          "suggestion": "The dogs bark loudly.",
          "severity": "error"
        }

        Text to analyze:
      `;

      const llmOptions: GenerationOptions = {
        temperature: 0.3, // Lower temperature for more factual/deterministic output
        maxTokens: 300, // Adjust as needed based on expected output size
      };

      // Pass segment, docContext, and llmOptions to queryLLM
      // BaseEngine.queryLLM expects (prompt, segment, docContext, options)
      const llmResponse = await this.queryLLM(prompt, segment, documentContext, llmOptions);
      this.logger.debug(`[${this.name}] LLM response for segment ${segment.id}: ${llmResponse}`);

      let findings: Finding[] = [];
      try {
        const parsedResponse = JSON.parse(llmResponse);
        if (Array.isArray(parsedResponse)) {
          findings = parsedResponse.map((item: any) => ({
            type: 'grammar',
            message: item.description || 'Grammar issue detected.',
            severity: item.severity === 'warning' ? 'warning' : 'error',
            suggestion: item.suggestion,
            // Optional: Attempt to find offset and length if incorrectPhrase is provided
            // This would require more sophisticated string matching.
            // For now, we'll keep it simple.
          }));
        } else {
          this.logger.warn(`[${this.name}] LLM response was not a JSON array for segment ${segment.id}. Response: ${llmResponse}`);
        }
      } catch (parseError: any) {
        this.logger.error(`[${this.name}] Failed to parse LLM response for segment ${segment.id}: ${parseError.message}. Response: ${llmResponse}`);
        // Optionally, create a generic finding if parsing fails but response might still be useful textually
        findings.push({
          type: 'grammar',
          message: `Could not parse LLM analysis. Raw response: ${llmResponse.substring(0, 200)}...`,
          severity: 'warning',
        });
      }

      return this.createSuccessResult(segment.id, findings);
    } catch (error: any) {
      this.logger.error(`[${this.name}] Error analyzing segment ${segment.id}: ${error.message}`, { error });
      return this.createErrorResult(segment.id, `Failed to analyze grammar: ${error.message}`);
    }
  }
}