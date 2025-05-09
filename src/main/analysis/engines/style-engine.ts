// src/main/analysis/engines/style-engine.ts

import { ContextAwareEngine } from './context-aware-engine'; // Changed from BaseEngine
import { IDocumentSegment, IDocumentContext } from '../context/document-context'; // Added
import { AnalysisResult, Finding, ExtractedFeatures } from '../types'; // Added ExtractedFeatures
import { LlmService, getLlmService } from '../../services/llm-service';
import appLogger from '../../services/logger';
import * as winston from 'winston';
import { GenerationOptions } from '../../../shared/types/llm';

export class StyleEngine extends ContextAwareEngine { // Changed from BaseEngine
  readonly name: string = 'StyleEngine';

  constructor(llmService?: LlmService, logger?: winston.Logger) {
    super(llmService || getLlmService(), logger || appLogger.child({ engineName: 'StyleEngine' }));
  }

  async analyze(
    segment: IDocumentSegment, // Changed from TextSegment
    documentContext?: IDocumentContext, // Added
    features?: ExtractedFeatures // Added
  ): Promise<AnalysisResult> {
    this.logger.info(`[${this.name}] Analyzing segment: ${segment.id}`);
    const contextualPrefix = this.buildContextualPromptPrefix(segment, documentContext);

    try {
      const prompt = `
        ${contextualPrefix ? contextualPrefix + '\n\n' : ''}Analyze the following text for writing style.
        Consider aspects like clarity, conciseness, tone, use of jargon, passive voice, and overall readability.
        For each identified style issue, provide:
        1. A brief description of the issue (e.g., "Overuse of passive voice", "Wordy phrase", "Inconsistent tone").
        2. The specific phrase or sentence exhibiting the issue.
        3. A suggestion for improvement or an alternative phrasing.
        4. Severity (info, warning).

        Format your response as a JSON array of objects, where each object has 'description', 'problematicPhrase', 'suggestion', and 'severity' fields.
        If no significant style issues are found, return an empty array.

        Example of a style issue object:
        {
          "description": "Passive voice used where active voice might be clearer.",
          "problematicPhrase": "The report was written by the team.",
          "suggestion": "The team wrote the report.",
          "severity": "info"
        }

        Text to analyze:
      `;

      const llmOptions: GenerationOptions = {
        temperature: 0.5, // Slightly higher temperature for more nuanced style suggestions
        maxTokens: 400,
      };

      // BaseEngine.queryLLM expects (prompt, segment, docContext, options)
      const llmResponse = await this.queryLLM(prompt, segment, documentContext, llmOptions);
      this.logger.debug(`[${this.name}] LLM response for segment ${segment.id}: ${llmResponse}`);

      let findings: Finding[] = [];
      try {
        const parsedResponse = JSON.parse(llmResponse);
        if (Array.isArray(parsedResponse)) {
          findings = parsedResponse.map((item: any) => ({
            type: 'style',
            message: item.description || 'Style issue detected.',
            severity: item.severity === 'warning' ? 'warning' : 'info', // Default to 'info' for style
            suggestion: item.suggestion,
            // Optional: Add problematicPhrase to metadata or attempt to find offset/length
          }));
        } else {
          this.logger.warn(`[${this.name}] LLM response was not a JSON array for segment ${segment.id}. Response: ${llmResponse}`);
        }
      } catch (parseError: any) {
        this.logger.error(`[${this.name}] Failed to parse LLM response for segment ${segment.id}: ${parseError.message}. Response: ${llmResponse}`);
        findings.push({
          type: 'style',
          message: `Could not parse style analysis. Raw response: ${llmResponse.substring(0, 200)}...`,
          severity: 'warning',
        });
      }

      return this.createSuccessResult(segment.id, findings);
    } catch (error: any) {
      this.logger.error(`[${this.name}] Error analyzing segment ${segment.id}: ${error.message}`, { error });
      return this.createErrorResult(segment.id, `Failed to analyze style: ${error.message}`);
    }
  }
}