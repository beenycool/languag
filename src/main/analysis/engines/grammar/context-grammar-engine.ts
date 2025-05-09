// src/main/analysis/engines/grammar/context-grammar-engine.ts

/**
 * @file Context-aware grammar analysis engine.
 */

import { ContextAwareEngine } from '../context-aware-engine';
import { IDocumentSegment, IDocumentContext } from '../../context/document-context';
import { AnalysisResult, ExtractedFeatures, Finding } from '../../types';
import { LlmService } from '../../../services/llm-service';
import * as winston from 'winston';
import appLogger from '../../../services/logger';
import { sanitizePrompts, addInstructionFencing, sanitizeLlmOutput } from '../../../../shared/utils/llm-security';
import { sanitizeError } from '../../../../shared/utils/sanitization';

import { applyBaseGrammarRules } from './grammar-rules/base-rules';
import { applyContextGrammarRules } from './grammar-rules/context-rules';
import { applyGenreGrammarRules } from './grammar-rules/genre-rules';

// Placeholder for a function that would parse LLM responses into Findings
// eslint-disable-next-line @typescript-eslint/no-unused-vars
function parseLLMGrammarResponse(llmResponse: string, _segment: IDocumentSegment): Finding[] {
  // In a real implementation, this would parse the LLM's structured output.
  // For now, returning an empty array.
  appLogger.debug('[ContextAwareGrammarEngine] LLM Response (raw in parseLLMGrammarResponse):', { response: llmResponse });
  return [];
}

export class ContextAwareGrammarEngine extends ContextAwareEngine {
  public readonly name = 'ContextAwareGrammarEngine';
  private static readonly MAX_SEGMENT_LENGTH = 10000; // Max characters for a segment

  constructor(llmService?: LlmService, logger?: winston.Logger) {
    const engineLogger = logger || appLogger.child({ engineName: 'ContextAwareGrammarEngine' });
    super(llmService, engineLogger);
    // Initialize rule sets here if needed
  }

  /**
   * Analyzes a document segment for grammar issues, leveraging context.
   * - Enhanced grammar rule processing with context
   * - Multi-paragraph analysis support (handled by segmenting, engine focuses on one segment)
   * - Genre-specific rule application
   *
   * @param segment - The document segment to analyze.
   * @param documentContext - Optional context of the entire document.
   * @param features - Optional pre-extracted features for this segment.
   * @returns A promise that resolves to an AnalysisResult.
   */
  public async analyze(
    segment: IDocumentSegment,
    documentContext?: IDocumentContext,
    features?: ExtractedFeatures,
  ): Promise<AnalysisResult> {
    this.logger.info(`[${this.name}] Analyzing segment: ${segment.id}`, { segmentId: segment.id, documentUri: documentContext?.uri });

    if (segment.text.length > ContextAwareGrammarEngine.MAX_SEGMENT_LENGTH) {
      const errorMsg = `Segment text exceeds maximum length of ${ContextAwareGrammarEngine.MAX_SEGMENT_LENGTH} characters.`;
      this.logger.warn(`[${this.name}] ${errorMsg}`, { segmentId: segment.id, length: segment.text.length });
      return this.createErrorResult(segment.id, errorMsg);
    }

    let findings: Finding[] = [];
    let errorMessages: string = '';

    try {
      // 1. Apply base grammar rules
      const baseFindings = applyBaseGrammarRules(segment, documentContext);
      findings = findings.concat(baseFindings);

      // 2. Apply context-specific grammar rules
      if (documentContext) {
        const contextFindings = applyContextGrammarRules(segment, documentContext);
        findings = findings.concat(contextFindings);
      }

      // 3. Apply genre-specific grammar rules
      // Genre might be part of documentContext.metadata or ExtractedFeatures
      const genreFindings = applyGenreGrammarRules(segment, documentContext, features);
      findings = findings.concat(genreFindings);
      
      // 4. Optional: LLM for complex cases or nuanced understanding if rules are insufficient
      // This part would require careful prompt engineering and deciding when to invoke LLM.
      // For now, let's make the condition simpler as 'complexity' is not in ExtractedFeatures.
      // We can refine this condition later if 'complexity' or a similar metric is added.
      const shouldUseLLM = this.llmService && !findings.length; // Example: Use LLM if no rule-based findings and LLM service is available.
      if (shouldUseLLM) {
        const instructions = this.buildContextualPromptPrefix(segment, documentContext) +
                             " Review the following text for subtle grammatical errors, awkward phrasing, or style issues not caught by standard rules. Provide specific suggestions.";
        const userData = segment.text;

        // Sanitize and fence the prompt
        const fencedPrompt = addInstructionFencing(instructions, userData);
        // Note: sanitizePrompts is called within addInstructionFencing for both parts.
        // If buildContextualPromptPrefix or segment.text could be extremely long, consider individual sanitization/truncation first.

        this.logger.debug(`[${this.name}] Using LLM for nuanced grammar check. Fenced prompt (first 100 chars): ${fencedPrompt.substring(0,100)}...`);
        try {
          const rawLlmResponse = await this.queryLLM(fencedPrompt, segment, documentContext);
          const sanitizedLlmResponse = sanitizeLlmOutput(rawLlmResponse);

          if (sanitizedLlmResponse) {
            const llmFindings = parseLLMGrammarResponse(sanitizedLlmResponse, segment);
            findings = findings.concat(llmFindings);
          } else {
            this.logger.info(`[${this.name}] LLM response was empty after sanitization.`);
          }
        } catch (llmError) {
          const rawMessage = llmError instanceof Error ? llmError.message : String(llmError);
          // Log the raw error internally with full details
          this.logger.warn(`[${this.name}] LLM query for grammar refinement failed raw: ${rawMessage}`, { error: llmError, segmentId: segment.id });
          // User-facing or less detailed log can use a sanitized version if needed, but warn usually is for internal dev/ops
          // For this specific log, keeping it detailed for now. Sanitize if this message were to be exposed externally.
          // Not a fatal error for the engine, proceed with rule-based findings
        }
      }


      // Remove duplicate findings if any (e.g., based on offset, length, and type)
      findings = findings.filter((finding, index, self) =>
        index === self.findIndex((f) => (
          f.offset === finding.offset && f.length === finding.length && f.type === finding.type && f.message === finding.message
        ))
      );

      if (findings.length > 0) {
        return this.createSuccessResult(segment.id, findings);
      }
      return this.createSuccessResult(segment.id, []);

    } catch (error) {
      const rawErrorMessage = error instanceof Error ? error.message : 'Unknown error during grammar analysis';
      // Log the full error internally
      this.logger.error(`[${this.name}] Raw error during analysis for segment ${segment.id} (doc: ${documentContext?.uri}): ${rawErrorMessage}`, { error, segmentId: segment.id, documentUri: documentContext?.uri });
      
      // Sanitize the error message for external reporting (e.g., in AnalysisResult.error)
      const sanitizedErrorMessage = sanitizeError(rawErrorMessage, `${this.name} analysis`);
      errorMessages = sanitizedErrorMessage; // Store sanitized for the result object
      return this.createErrorResult(segment.id, sanitizedErrorMessage, error); // Pass original error for potential internal use by createErrorResult
    }
  }

  // Additional methods for rule loading, genre detection, etc. can be added here.
}