// src/main/analysis/engines/base-engine.ts

import { IAnalysisEngine, TextSegment, AnalysisResult, Finding } from '../types';
import { LLMService } from '../../services/llm-service'; // Assuming LLMService path
import { Logger } from '../../services/logger'; // Assuming Logger path

/**
 * Abstract base class for analysis engines.
 * Provides common functionality like LLM interaction and error handling.
 */
export abstract class BaseEngine implements IAnalysisEngine {
  abstract readonly name: string;
  protected llmService: LLMService | undefined;
  protected logger: Logger;

  constructor(llmService?: LLMService, logger?: Logger) {
    this.llmService = llmService;
    this.logger = logger || new Logger('BaseEngine'); // Default logger if not provided
  }

  /**
   * Abstract method to be implemented by concrete engine classes.
   * @param segment The text segment to analyze.
   * @returns A promise that resolves to an AnalysisResult.
   */
  abstract analyze(segment: TextSegment): Promise<AnalysisResult>;

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
  protected createErrorResult(segmentId: string, errorMessage: string): AnalysisResult {
    this.logger.error(`Engine '${this.name}' failed for segment '${segmentId}': ${errorMessage}`);
    return {
      segmentId,
      engine: this.name,
      findings: [],
      error: errorMessage,
    };
  }

  /**
   * Placeholder for interacting with an LLM.
   * Concrete engines can use this or override it for more specific LLM calls.
   * @param prompt The prompt to send to the LLM.
   * @param segmentText The text of the segment, for context.
   * @returns A promise that resolves to the LLM's response string.
   * @throws Error if LLMService is not available or if the LLM call fails.
   */
  protected async queryLLM(prompt: string, segmentText: string): Promise<string> {
    if (!this.llmService) {
      throw new Error('LLMService is not configured for this engine.');
    }
    try {
      // Example: Construct a more specific prompt if needed
      const fullPrompt = `${prompt}\n\nText to analyze:\n"${segmentText}"`;
      const response = await this.llmService.generateText(fullPrompt, {
        // Add any specific LLM parameters here, e.g., temperature, max_tokens
        // These might come from a configuration service
      });
      return response;
    } catch (error: any) {
      this.logger.error(`LLM query failed for engine '${this.name}': ${error.message}`);
      throw new Error(`LLM query failed: ${error.message}`);
    }
  }
}