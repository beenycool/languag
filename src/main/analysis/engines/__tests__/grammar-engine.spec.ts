import { GrammarEngine } from '../grammar-engine';
import { IDocumentSegment, IDocumentContext } from '../../context/document-context';
import { AnalysisResult, ExtractedFeatures } from '../../types';
import { LlmService } from '../../../services/llm-service';
import { GenerationOptions, LLMRequest, ModelResponse } from '../../../../shared/types/llm';
import winston from 'winston';

// Mocks
jest.mock('../../../services/llm-service');
jest.mock('../../../services/logger', () => ({
  child: jest.fn().mockReturnValue({
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
  }),
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
  debug: jest.fn(),
}));

describe('GrammarEngine', () => {
  let grammarEngine: GrammarEngine;
  let mockLlmService: jest.Mocked<LlmService>;
  let mockLogger: jest.Mocked<winston.Logger>;

  const mockSegment: IDocumentSegment = {
    id: 'test-segment-1',
    text: 'This is a test sentence.',
    range: { start: 0, end: 24 }, // Added range
  };
  const mockDocContext: IDocumentContext = { uri: 'doc1.txt', language: 'en' };
  const mockFeatures: ExtractedFeatures = { wordCount: 5, sentenceCount: 1, keywords: ['test', 'sentence'] };


  beforeEach(() => {
    // Create a new mock for LlmService before each test
    mockLlmService = {
      process: jest.fn(),
      // getProviderName is not directly used by BaseEngine's queryLLM,
      // LlmService internal config is used.
    } as unknown as jest.Mocked<LlmService>;

    // Create a new mock for the logger
    mockLogger = {
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
      debug: jest.fn(),
      child: jest.fn().mockReturnThis(), // Ensure child() returns the mock itself
    } as unknown as jest.Mocked<winston.Logger>;

    grammarEngine = new GrammarEngine(mockLlmService, mockLogger);

    // Mock the queryLLM method from BaseEngine, which GrammarEngine uses
    // We need to access it via the prototype if it's not directly on the instance
    // or ensure BaseEngine's constructor correctly sets it up for mocking.
    // For simplicity, let's assume queryLLM is a public or protected method
    // that can be spied upon or mocked directly if BaseEngine is structured for it.
    // Since queryLLM is in BaseEngine, we'll mock it on the prototype for now,
    // or more cleanly, ensure the LlmService.generate call it makes is what we check.
    // The current GrammarEngine calls `this.queryLLM`, which is inherited.
    // So we mock the LlmService's generate method that queryLLM will call.
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(grammarEngine).toBeDefined();
  });

  it('should have the correct name', () => {
    expect(grammarEngine.name).toBe('GrammarEngine');
  });

  describe('analyze', () => {
    it('should return findings when LLM provides valid JSON array', async () => {
      const llmResponse = JSON.stringify([
        {
          description: 'Incorrect subject-verb agreement.',
          incorrectPhrase: 'The dogs barks loudly.',
          suggestion: 'The dogs bark loudly.',
          severity: 'error',
        },
        {
          description: 'Missing comma.',
          incorrectPhrase: 'However he came.',
          suggestion: 'However, he came.',
          severity: 'warning',
        },
      ]);
      // Mock the behavior of llmService.process, which is called by BaseEngine's queryLLM
      const mockModelResponse: ModelResponse = { success: true, content: llmResponse };
      (mockLlmService.process as jest.Mock).mockResolvedValue(mockModelResponse);

      const result = await grammarEngine.analyze(mockSegment, mockDocContext, mockFeatures);

      expect(mockLlmService.process).toHaveBeenCalledTimes(1);
      const processCallArgs = (mockLlmService.process as jest.Mock).mock.calls[0]![0] as LLMRequest;

      expect(processCallArgs.input).toContain('Analyze the following text for grammatical errors.');
      expect(processCallArgs.input).toContain(`Text to analyze:\n"${mockSegment.text}"`);
      expect(processCallArgs.options?.temperature).toBe(0.3);
      expect(processCallArgs.options?.maxTokens).toBe(300);

      expect(result.error).toBeUndefined();
      expect(result.findings).toHaveLength(2);
      expect(result.findings[0].type).toBe('grammar');
      expect(result.findings[0].message).toBe('Incorrect subject-verb agreement.');
      expect(result.findings[0].severity).toBe('error');
      expect(result.findings[0].suggestion).toBe('The dogs bark loudly.');
      expect(result.findings[1].type).toBe('grammar');
      expect(result.findings[1].message).toBe('Missing comma.');
      expect(result.findings[1].severity).toBe('warning');
      expect(result.findings[1].suggestion).toBe('However, he came.');
      expect(mockLogger.info).toHaveBeenCalledWith(`[GrammarEngine] Analyzing segment: ${mockSegment.id}`);
      expect(mockLogger.debug).toHaveBeenCalledWith(expect.stringContaining(`LLM response for segment ${mockSegment.id}`));
    });

    it('should return empty findings when LLM provides an empty JSON array', async () => {
      const llmResponse = JSON.stringify([]);
      const mockModelResponse: ModelResponse = { success: true, content: llmResponse };
      (mockLlmService.process as jest.Mock).mockResolvedValue(mockModelResponse);

      const result = await grammarEngine.analyze(mockSegment, mockDocContext, mockFeatures);

      expect(result.error).toBeUndefined();
      expect(result.findings).toEqual([]);
    });

    it('should create a warning finding if LLM response is not valid JSON', async () => {
      const llmResponse = 'This is not JSON. {error: true';
      const mockModelResponse: ModelResponse = { success: true, content: llmResponse };
      (mockLlmService.process as jest.Mock).mockResolvedValue(mockModelResponse);

      const result = await grammarEngine.analyze(mockSegment, mockDocContext, mockFeatures);

      expect(result.error).toBeUndefined();
      expect(result.findings).toHaveLength(1);
      expect(result.findings[0].type).toBe('grammar');
      expect(result.findings[0].message).toContain('Could not parse LLM analysis. Raw response:');
      expect(result.findings[0].severity).toBe('warning');
      expect(mockLogger.error).toHaveBeenCalledWith(
        expect.stringContaining(`Failed to parse LLM response for segment ${mockSegment.id}`),
        expect.any(String) // The raw response string
      );
    });

    it('should create a warning finding if LLM response is valid JSON but not an array', async () => {
      const llmResponse = JSON.stringify({ message: 'Not an array' });
      const mockModelResponse: ModelResponse = { success: true, content: llmResponse };
      (mockLlmService.process as jest.Mock).mockResolvedValue(mockModelResponse);

      const result = await grammarEngine.analyze(mockSegment, mockDocContext, mockFeatures);

      expect(result.error).toBeUndefined();
      expect(result.findings).toEqual([]);
      expect(mockLogger.warn).toHaveBeenCalledWith(
        expect.stringContaining(`LLM response was not a JSON array for segment ${mockSegment.id}`)
      );
    });

    it('should handle default values for missing fields in LLM finding objects', async () => {
        const llmResponse = JSON.stringify([
          {
            // description is missing
            incorrectPhrase: 'She go to store.',
            suggestion: 'She goes to the store.',
            // severity is missing
          },
        ]);
        const mockModelResponse: ModelResponse = { success: true, content: llmResponse };
        (mockLlmService.process as jest.Mock).mockResolvedValue(mockModelResponse);

        const result = await grammarEngine.analyze(mockSegment, mockDocContext, mockFeatures);
        expect(result.error).toBeUndefined();
        expect(result.findings).toHaveLength(1);
        expect(result.findings[0].message).toBe('Grammar issue detected.'); // Default message
        expect(result.findings[0].severity).toBe('error'); // Default severity
        expect(result.findings[0].suggestion).toBe('She goes to the store.');
    });

    it('should return an error result if llmService.process returns success:false', async () => {
      const errorMessage = 'LLM processing failed internally';
      const mockModelResponse: ModelResponse = { success: false, error: errorMessage };
      (mockLlmService.process as jest.Mock).mockResolvedValue(mockModelResponse);

      const result = await grammarEngine.analyze(mockSegment, mockDocContext, mockFeatures);

      expect(result.error).toBe(`Failed to analyze grammar: LLM query failed: ${errorMessage}`);
      expect(result.findings).toEqual([]);
      expect(mockLogger.error).toHaveBeenCalledWith(
        `[GrammarEngine] Error analyzing segment ${mockSegment.id}: LLM query failed: ${errorMessage}`,
        { error: expect.any(Error) }
      );
    });

    it('should return an error result if llmService.process throws an error', async () => {
      const errorMessage = 'LLM service unavailable';
      (mockLlmService.process as jest.Mock).mockRejectedValue(new Error(errorMessage));

      const result = await grammarEngine.analyze(mockSegment, mockDocContext, mockFeatures);

      expect(result.error).toBe(`Failed to analyze grammar: LLM query invocation failed: ${errorMessage}`);
      expect(result.findings).toEqual([]);
      expect(mockLogger.error).toHaveBeenCalledWith(
        `[GrammarEngine] Error analyzing segment ${mockSegment.id}: ${errorMessage}`,
        { error: expect.any(Error) }
      );
    });
  });
});