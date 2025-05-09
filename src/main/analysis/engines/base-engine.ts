// src/main/analysis/engines/base-engine.ts

import { IAnalysisEngine, AnalysisResult, Finding, ExtractedFeatures } from '../types';
import { IDocumentContext, IDocumentSegment } from '../context/document-context';
import { LlmService } from '../../services/llm-service';
import appLogger from '../../services/logger'; // Default import
import * as winston from 'winston'; // For winston.Logger type
import { LLMRequest, GenerationOptions } from '../../../shared/types/llm';
import { sanitizeInput, sanitizeError } from '../../../shared/utils/sanitization';

/**
 * Abstract base class for analysis engines.
 * Provides common functionality like LLM interaction and error handling.
 */
export abstract class BaseEngine implements IAnalysisEngine {
  abstract readonly name: string;
  protected llmService: LlmService | undefined;
  protected logger: winston.Logger;

  constructor(llmService?: LlmService, logger?: winston.Logger) {
    this.llmService = llmService;
    this.logger = logger || appLogger; // Use imported appLogger if no specific logger is provided
    // If a specific logger isn't provided, the concrete engine can create a child logger
    // e.g., this.logger = appLogger.child({ engineName: this.name }); in its own constructor
  }

  /**
   * Abstract method to be implemented by concrete engine classes.
   * @param segment The document segment to analyze.
   * @param documentContext Optional context of the entire document.
   * @param features Optional pre-extracted features for this segment.
   * @returns A promise that resolves to an AnalysisResult.
   */
  abstract analyze(
    segment: IDocumentSegment,
    documentContext?: IDocumentContext,
    features?: ExtractedFeatures
  ): Promise<AnalysisResult>;

  /**
   * Helper method to create a successful AnalysisResult.
   * @param segmentId The ID of the text segment.
   * @param findings An array of findings.
   * @returns An AnalysisResult object.
   */
  protected createSuccessResult(segmentId: string, findings: Finding[]): AnalysisResult {
    return {
      segmentId,
      engine: this.name,
      findings,
    };
  }

  /**
   * Helper method to create an error AnalysisResult.
   * @param segmentId The ID of the text segment.
   * @param errorMessage The error message.
   * @returns An AnalysisResult object with an error.
   */
  protected createErrorResult(segmentId: string, errorMessage: string, internalError?: any): AnalysisResult {
    const sanitizedErrorMessage = sanitizeError(errorMessage, `engine ${this.name}`);
    // Log the detailed internal error if provided, but only return the sanitized one.
    if (internalError) {
      this.logger.error(`Engine '${this.name}' failed for segment '${segmentId}': ${errorMessage}`, { internalError, segmentId });
    } else {
      this.logger.error(`Engine '${this.name}' failed for segment '${segmentId}': ${errorMessage}`, { segmentId });
    }
    return {
      segmentId,
      engine: this.name,
      findings: [],
      error: sanitizedErrorMessage, // Use sanitized error for the result
    };
  }

  /**
   * Helper method to interact with an LLM.
   * Concrete engines can use this or override it for more specific LLM calls.
   * @param basePrompt The base prompt to send to the LLM.
   * @param segment The document segment being analyzed.
   * @param documentContext Optional context of the entire document.
   * @param options Optional generation options for the LLM.
   * @returns A promise that resolves to the LLM's response string.
   * @throws Error if LLMService is not available or if the LLM call fails.
   */
  protected async queryLLM(
    basePrompt: string,
    segment: IDocumentSegment,
    documentContext?: IDocumentContext,
    options?: GenerationOptions
  ): Promise<string> {
    if (!this.llmService) {
      this.logger.error(`LLMService is not configured for engine '${this.name}'.`);
      throw new Error('LLMService is not configured for this engine.');
    }

    const sanitizedSegmentText = sanitizeInput(segment.text);
    
    // Construct a more context-rich prompt
    let fullPrompt = basePrompt;
    if (documentContext?.language) {
      fullPrompt += `\nDocument Language: ${documentContext.language}`;
    }
    if (documentContext?.metadata) {
      // Include relevant metadata, be selective to avoid overly long prompts
      // fullPrompt += `\nDocument Metadata: ${JSON.stringify(documentContext.metadata)}`;
    }
    fullPrompt += `\n\n<user_text>\n${sanitizedSegmentText}\n</user_text>`;
    
    const segmentIdForLog = segment.id || 'unknown_segment';
    const docUriForLog = documentContext?.uri || 'unknown_document';

    this.logger.debug(
      `Querying LLM for engine '${this.name}' on segment '${segmentIdForLog}' of doc '${docUriForLog}'. Prompt (start): "${basePrompt.substring(0,100)}". Segment (start): "${sanitizedSegmentText.substring(0, 50)}"`,
    );


    const request: LLMRequest = {
      type: 'generate',
      input: fullPrompt,
      options: {
        temperature: 0.7, // Default temperature
        maxTokens: 500,  // Default max tokens
        ...(options || {}), // Override with provided options
      },
      // model: this.llmService.getConfiguredModel() // Or get from config
    };

    try {
      const response = await this.llmService.process(request);
      if (response.success && response.content) {
        return response.content;
      } else if (response.error) {
        this.logger.error(`LLM query failed for engine '${this.name}' (segment: ${segmentIdForLog}, doc: ${docUriForLog}): ${response.error}`, { segmentStart: sanitizedSegmentText.substring(0,50) });
        throw new Error('LLM query failed.');
      } else {
        this.logger.error(`LLM query returned an unexpected response for engine '${this.name}' (segment: ${segmentIdForLog}, doc: ${docUriForLog}).`, { segmentStart: sanitizedSegmentText.substring(0,50) });
        throw new Error('LLM query returned an unexpected response.');
      }
    } catch (error: any) {
      this.logger.error(`LLM query invocation failed for engine '${this.name}' (segment: ${segmentIdForLog}, doc: ${docUriForLog}): ${error.message}`, { error, segmentStart: sanitizedSegmentText.substring(0,50) });
      throw new Error(`LLM query invocation failed. Please check logs.`);
    }
  }

  /**
   * Optional method for engines to implement if they manage explicit resources
   * that need to be cleaned up (e.g., network connections, file handles).
   */
  public dispose(): Promise<void> {
    // Default implementation does nothing.
    // Concrete engines should override this if they have resources to release.
    this.logger.info(`Disposing engine ${this.name}.`);
    return Promise.resolve();
  }
}