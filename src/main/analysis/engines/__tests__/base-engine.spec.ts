import { BaseEngine } from '../base-engine';
import { IDocumentSegment, IDocumentContext } from '../../context/document-context';
import { AnalysisResult, Finding, ExtractedFeatures } from '../../types';
import { LlmService } from '../../../services/llm-service';
import { ModelResponse, LLMRequest, GenerationOptions } from '../../../../shared/types/llm';
import appLogger from '../../../services/logger'; // Import the actual appLogger for spy
import winston from 'winston';
import { sanitizeInput, sanitizeError } from '../../../../shared/utils/sanitization';

// Mocks
jest.mock('../../../services/llm-service');
jest.mock('../../../../shared/utils/sanitization', () => ({
  sanitizeInput: jest.fn(input => input), // Mock to return input by default
  sanitizeError: jest.fn((msg, _ctx) => `sanitized: ${msg}`), // Mock to prefix
}));


// A concrete implementation for testing BaseEngine
class TestableBaseEngine extends BaseEngine {
  readonly name: string = 'TestableBaseEngine';

  constructor(llmService?: LlmService, logger?: winston.Logger) {
    super(llmService, logger);
  }

  // Dummy analyze method to satisfy the abstract requirement
  async analyze(
    segment: IDocumentSegment,
    docContext?: IDocumentContext,
    features?: ExtractedFeatures
  ): Promise<AnalysisResult> {
    if (segment.text === 'force-llm-call') {
        // Make a dummy call to test queryLLM if needed
        try {
            // BaseEngine.queryLLM expects segmentText and options.
            // The testQueryLLM signature includes docContext and features for consistency
            // with how derived engines might use them before calling super.queryLLM or their own LLM logic.
            // Assuming BaseEngine.queryLLM now takes IDocumentSegment as its second argument
            // BaseEngine.queryLLM expects (prompt, segment, docContext, options)
            await this.queryLLM('Test prompt', segment, docContext, undefined);
        } catch (e) {
            return this.createErrorResult(segment.id, (e as Error).message);
        }
    }
    return this.createSuccessResult(segment.id, []);
  }

  // Expose protected methods for testing
  public testCreateSuccessResult(segmentId: string, findings: Finding[]): AnalysisResult {
    return this.createSuccessResult(segmentId, findings);
  }

  public testCreateErrorResult(segmentId: string, errorMessage: string, internalError?: any): AnalysisResult {
    return this.createErrorResult(segmentId, errorMessage, internalError);
  }

  public async testQueryLLM(
    prompt: string,
    segment: IDocumentSegment,
    docContext?: IDocumentContext,
    features?: ExtractedFeatures,
    options?: GenerationOptions
  ): Promise<string> {
    // BaseEngine.queryLLM expects segmentText and options.
    // The testQueryLLM signature includes docContext and features for consistency.
    // Here, we pass segment.text and the actual 'options' to the superclass method.
    // Assuming BaseEngine.queryLLM now takes IDocumentSegment as its second argument
    // BaseEngine.queryLLM expects (prompt, segment, docContext, options)
    // The 'features' param in testQueryLLM is for testing derived engines that might use it.
    return this.queryLLM(prompt, segment, docContext, options);
  }

  public getLogger(): winston.Logger {
    return this.logger;
  }
}

describe('BaseEngine', () => {
  let engine: TestableBaseEngine;
  let mockLlmService: jest.Mocked<LlmService>;
  let mockLogger: jest.Mocked<winston.Logger>;
  let appLoggerSpy: jest.SpyInstance;

  const segmentId = 'seg-base-1';

  beforeEach(() => {
    mockLlmService = {
      process: jest.fn(),
      getProviderName: jest.fn().mockReturnValue('mockProvider'),
    } as unknown as jest.Mocked<LlmService>;

    mockLogger = {
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
      debug: jest.fn(),
      child: jest.fn().mockReturnThis(),
    } as unknown as jest.Mocked<winston.Logger>;
    
    // Spy on appLogger itself for the case where no logger is provided
    // and BaseEngine falls back to the default appLogger.
    // Note: If BaseEngine creates a child, this spy won't catch child's calls directly.
    // However, the constructor logic is `this.logger = logger || appLogger;`
    // So if logger is undefined, this.logger becomes appLogger.
    appLoggerSpy = jest.spyOn(appLogger, 'error'); // Spy on a method to check if appLogger was used
  });

  afterEach(() => {
    jest.clearAllMocks();
    appLoggerSpy.mockRestore();
    (sanitizeInput as jest.Mock).mockClear();
    (sanitizeError as jest.Mock).mockClear();
  });

  describe('Constructor and Logger', () => {
    it('should use the provided logger if available', () => {
      engine = new TestableBaseEngine(mockLlmService, mockLogger);
      expect(engine.getLogger()).toBe(mockLogger);
      engine.testCreateErrorResult(segmentId, 'test error');
      expect(mockLogger.error).toHaveBeenCalled(); // Check if the provided logger was used
      expect(appLoggerSpy).not.toHaveBeenCalled(); // Ensure default appLogger wasn't
    });

    it('should use the default appLogger if no logger is provided', () => {
      // To test this, we need BaseEngine to NOT call .child() if logger is undefined.
      // The current BaseEngine constructor: this.logger = logger || appLogger;
      // Concrete engines are expected to call .child() if they want a specific child logger.
      engine = new TestableBaseEngine(mockLlmService, undefined); // Pass undefined for logger
      expect(engine.getLogger()).toBe(appLogger); // It should directly use appLogger
      
      // Trigger an error log to see which logger is used
      engine.testCreateErrorResult(segmentId, 'test error with default logger');
      // sanitizeError will be called by createErrorResult
      expect(sanitizeError).toHaveBeenCalledWith('test error with default logger', 'engine TestableBaseEngine');
      expect(appLoggerSpy).toHaveBeenCalledWith(
        expect.stringContaining("Engine 'TestableBaseEngine' failed for segment 'seg-base-1': test error with default logger"),
        expect.objectContaining({ segmentId: 'seg-base-1' }) // Check for structured log context
      );
      expect(mockLogger.error).not.toHaveBeenCalled();
    });
  });

  describe('createSuccessResult', () => {
    it('should create a success result with correct structure', () => {
      engine = new TestableBaseEngine(mockLlmService, mockLogger);
      const findings: Finding[] = [{ type: 'test', message: 'Test finding', severity: 'info' }];
      const result = engine.testCreateSuccessResult(segmentId, findings);

      expect(result.segmentId).toBe(segmentId);
      expect(result.engine).toBe('TestableBaseEngine');
      expect(result.findings).toEqual(findings);
      expect(result.error).toBeUndefined();
    });
  });

  describe('createErrorResult', () => {
    it('should create an error result with correct structure and log the error', () => {
      engine = new TestableBaseEngine(mockLlmService, mockLogger);
      const errorMessage = 'A test error occurred.';
      const internalErrorDetail = new Error("Internal details");
      const result = engine.testCreateErrorResult(segmentId, errorMessage, internalErrorDetail);

      expect(result.segmentId).toBe(segmentId);
      expect(result.engine).toBe('TestableBaseEngine');
      expect(result.findings).toEqual([]);
      expect(result.error).toBe(`sanitized: ${errorMessage}`); // Check that error message is sanitized
      expect(sanitizeError).toHaveBeenCalledWith(errorMessage, 'engine TestableBaseEngine');
      expect(mockLogger.error).toHaveBeenCalledWith(
        `Engine 'TestableBaseEngine' failed for segment '${segmentId}': ${errorMessage}`,
        expect.objectContaining({ internalError: internalErrorDetail, segmentId })
      );
    });
  });

  describe('queryLLM', () => {
    const testPrompt = 'Test prompt';
    const mockSegment: IDocumentSegment = {
      id: 'seg-llm-1',
      text: 'User input <script>alert("xss")</script>',
      range: { start: 0, end: 36 },
    };
    const sanitizedTestSegmentText = mockSegment.text; // sanitizeInput mock returns as is

    beforeEach(() => {
        (sanitizeInput as jest.Mock).mockImplementation(input => input); // Default mock
    });
    it('should throw an error if LLMService is not configured', async () => {
      engine = new TestableBaseEngine(undefined, mockLogger); // No LLM service
      await expect(engine.testQueryLLM('prompt', { id: 's1', text: 'text', range: {start:0, end:4} })).rejects.toThrow(
        'LLMService is not configured for this engine.'
      );
      expect(mockLogger.error).toHaveBeenCalledWith(
        "LLMService is not configured for engine 'TestableBaseEngine'."
      );
    });

    it('should call llmService.process with correct parameters and defaults', async () => {
      engine = new TestableBaseEngine(mockLlmService, mockLogger);
      const mockLLMResponse: ModelResponse = { success: true, content: 'LLM response' };
      (mockLlmService.process as jest.Mock).mockResolvedValue(mockLLMResponse);

      await engine.testQueryLLM(testPrompt, mockSegment);

      expect(sanitizeInput).toHaveBeenCalledWith(mockSegment.text);
      expect(mockLlmService.process).toHaveBeenCalledTimes(1);
      const requestArg = (mockLlmService.process as jest.Mock).mock.calls[0]![0] as LLMRequest;
      expect(requestArg.input).toBe(`${testPrompt}\n\n<user_text>\n${sanitizedTestSegmentText}\n</user_text>`);
      expect(requestArg.options?.temperature).toBe(0.7);
      expect(requestArg.options?.maxTokens).toBe(500);
      expect(mockLogger.debug).toHaveBeenCalledWith(
        `Querying LLM for engine 'TestableBaseEngine' with prompt: "${testPrompt}" and segment (first 50 chars): "${sanitizedTestSegmentText.substring(0, 50)}"`
      );
    });

    it('should override default LLM options if provided', async () => {
      engine = new TestableBaseEngine(mockLlmService, mockLogger);
      const mockLLMResponse: ModelResponse = { success: true, content: 'LLM response' };
      (mockLlmService.process as jest.Mock).mockResolvedValue(mockLLMResponse);

      const options: GenerationOptions = { temperature: 0.2, maxTokens: 100 };
      await engine.testQueryLLM(testPrompt, mockSegment, undefined, undefined, options);

      const requestArg = (mockLlmService.process as jest.Mock).mock.calls[0]![0] as LLMRequest;
      expect(requestArg.options?.temperature).toBe(0.2);
      expect(requestArg.options?.maxTokens).toBe(100);
    });

    it('should return content on successful LLMService.process call', async () => {
      engine = new TestableBaseEngine(mockLlmService, mockLogger);
      const llmContent = 'Successful response from LLM.';
      const mockLLMResponse: ModelResponse = { success: true, content: llmContent };
      (mockLlmService.process as jest.Mock).mockResolvedValue(mockLLMResponse);

      const response = await engine.testQueryLLM(testPrompt, mockSegment);
      expect(response).toBe(llmContent);
    });

    it('should throw generic error if LLMService.process returns success:false', async () => {
      engine = new TestableBaseEngine(mockLlmService, mockLogger);
      const llmError = 'LLM failed processing.';
      const mockLLMResponse: ModelResponse = { success: false, error: llmError };
      (mockLlmService.process as jest.Mock).mockResolvedValue(mockLLMResponse);

      await expect(engine.testQueryLLM(testPrompt, mockSegment)).rejects.toThrow(
        'LLM query failed.' // Generic message
      );
      expect(mockLogger.error).toHaveBeenCalledWith(
        `LLM query failed for engine 'TestableBaseEngine': ${llmError}`,
        expect.objectContaining({ segmentStart: sanitizedTestSegmentText.substring(0,50) })
      );
    });

    it('should throw generic error if LLMService.process returns success:true but no content', async () => {
        engine = new TestableBaseEngine(mockLlmService, mockLogger);
        const mockLLMResponse: ModelResponse = { success: true, content: undefined };
        (mockLlmService.process as jest.Mock).mockResolvedValue(mockLLMResponse);
  
        await expect(engine.testQueryLLM(testPrompt, mockSegment)).rejects.toThrow(
          'LLM query returned an unexpected response.' // Generic message
        );
        expect(mockLogger.error).toHaveBeenCalledWith(
          "LLM query returned an unexpected response for engine 'TestableBaseEngine'.",
          expect.objectContaining({ segmentStart: sanitizedTestSegmentText.substring(0,50) })
        );
      });

    it('should throw generic error if LLMService.process itself throws', async () => {
      engine = new TestableBaseEngine(mockLlmService, mockLogger);
      const thrownError = new Error('Network issue');
      (mockLlmService.process as jest.Mock).mockRejectedValue(thrownError);

      await expect(engine.testQueryLLM(testPrompt, mockSegment)).rejects.toThrow(
        `LLM query invocation failed. Please check logs.` // Generic message
      );
      expect(mockLogger.error).toHaveBeenCalledWith(
        `LLM query invocation failed for engine 'TestableBaseEngine': ${thrownError.message}`,
        expect.objectContaining({ error: thrownError, segmentStart: sanitizedTestSegmentText.substring(0,50) })
      );
    });
  });

  describe('dispose', () => {
    it('should log when disposing', async () => {
        engine = new TestableBaseEngine(mockLlmService, mockLogger);
        await engine.dispose();
        expect(mockLogger.info).toHaveBeenCalledWith('Disposing engine TestableBaseEngine.');
    });
  });
});