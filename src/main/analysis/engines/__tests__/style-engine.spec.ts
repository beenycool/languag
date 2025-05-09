import { StyleEngine } from '../style-engine';
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

describe('StyleEngine', () => {
  let styleEngine: StyleEngine;
  let mockLlmService: jest.Mocked<LlmService>;
  let mockLogger: jest.Mocked<winston.Logger>;

  const mockSegment: IDocumentSegment = {
    id: 'test-segment-style-1',
    text: 'The report was meticulously prepared by the dedicated team members.',
    range: { start: 0, end: 68 }, // Added range
  };
  const mockDocContext: IDocumentContext = { uri: 'docStyle1.txt', language: 'en' };
  const mockFeatures: ExtractedFeatures = { wordCount: 10, sentenceCount: 1, keywords: ['report', 'team'] };

  beforeEach(() => {
    mockLlmService = {
      process: jest.fn(),
    } as unknown as jest.Mocked<LlmService>;

    mockLogger = {
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
      debug: jest.fn(),
      child: jest.fn().mockReturnThis(),
    } as unknown as jest.Mocked<winston.Logger>;

    styleEngine = new StyleEngine(mockLlmService, mockLogger);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(styleEngine).toBeDefined();
  });

  it('should have the correct name', () => {
    expect(styleEngine.name).toBe('StyleEngine');
  });

  describe('analyze', () => {
    it('should return findings when LLM provides valid JSON array for style issues', async () => {
      const llmResponse = JSON.stringify([
        {
          description: 'Passive voice used where active voice might be clearer.',
          problematicPhrase: 'The report was meticulously prepared by the dedicated team members.',
          suggestion: 'The dedicated team members meticulously prepared the report.',
          severity: 'info',
        },
        {
          description: 'Wordy phrase.',
          problematicPhrase: 'dedicated team members',
          suggestion: 'team',
          severity: 'warning',
        },
      ]);
      const mockModelResponse: ModelResponse = { success: true, content: llmResponse };
      (mockLlmService.process as jest.Mock).mockResolvedValue(mockModelResponse);

      const result = await styleEngine.analyze(mockSegment, mockDocContext, mockFeatures);

      expect(mockLlmService.process).toHaveBeenCalledTimes(1);
      const processCallArgs = (mockLlmService.process as jest.Mock).mock.calls[0]![0] as LLMRequest;

      expect(processCallArgs.input).toContain('Analyze the following text for writing style.');
      expect(processCallArgs.input).toContain(`Text to analyze:\n"${mockSegment.text}"`);
      expect(processCallArgs.options?.temperature).toBe(0.5);
      expect(processCallArgs.options?.maxTokens).toBe(400);

      expect(result.error).toBeUndefined();
      expect(result.findings).toHaveLength(2);
      expect(result.findings[0].type).toBe('style');
      expect(result.findings[0].message).toBe('Passive voice used where active voice might be clearer.');
      expect(result.findings[0].severity).toBe('info');
      expect(result.findings[0].suggestion).toBe('The dedicated team members meticulously prepared the report.');
      expect(result.findings[1].type).toBe('style');
      expect(result.findings[1].message).toBe('Wordy phrase.');
      expect(result.findings[1].severity).toBe('warning');
      expect(result.findings[1].suggestion).toBe('team');
      expect(mockLogger.info).toHaveBeenCalledWith(`[StyleEngine] Analyzing segment: ${mockSegment.id}`);
      expect(mockLogger.debug).toHaveBeenCalledWith(expect.stringContaining(`LLM response for segment ${mockSegment.id}`));
    });

    it('should return empty findings when LLM provides an empty JSON array', async () => {
      const llmResponse = JSON.stringify([]);
      const mockModelResponse: ModelResponse = { success: true, content: llmResponse };
      (mockLlmService.process as jest.Mock).mockResolvedValue(mockModelResponse);

      const result = await styleEngine.analyze(mockSegment, mockDocContext, mockFeatures);

      expect(result.error).toBeUndefined();
      expect(result.findings).toEqual([]);
    });

    it('should create a warning finding if LLM response is not valid JSON', async () => {
      const llmResponse = 'This is not JSON. {style_error: true';
      const mockModelResponse: ModelResponse = { success: true, content: llmResponse };
      (mockLlmService.process as jest.Mock).mockResolvedValue(mockModelResponse);

      const result = await styleEngine.analyze(mockSegment, mockDocContext, mockFeatures);

      expect(result.error).toBeUndefined();
      expect(result.findings).toHaveLength(1);
      expect(result.findings[0].type).toBe('style');
      expect(result.findings[0].message).toContain('Could not parse style analysis. Raw response:');
      expect(result.findings[0].severity).toBe('warning');
      expect(mockLogger.error).toHaveBeenCalledWith(
        expect.stringContaining(`Failed to parse LLM response for segment ${mockSegment.id}`),
        expect.any(String)
      );
    });

    it('should create a warning finding if LLM response is valid JSON but not an array', async () => {
      const llmResponse = JSON.stringify({ message: 'Not an array of style issues' });
      const mockModelResponse: ModelResponse = { success: true, content: llmResponse };
      (mockLlmService.process as jest.Mock).mockResolvedValue(mockModelResponse);

      const result = await styleEngine.analyze(mockSegment, mockDocContext, mockFeatures);

      expect(result.error).toBeUndefined();
      expect(result.findings).toEqual([]);
      expect(mockLogger.warn).toHaveBeenCalledWith(
        expect.stringContaining(`LLM response was not a JSON array for segment ${mockSegment.id}`)
      );
    });

    it('should handle default values for missing fields in LLM finding objects (default severity to info)', async () => {
        const llmResponse = JSON.stringify([
          {
            // description is missing
            problematicPhrase: 'Utilize the functionality.',
            suggestion: 'Use the function.',
            // severity is missing, should default to 'info' for style
          },
        ]);
        const mockModelResponse: ModelResponse = { success: true, content: llmResponse };
        (mockLlmService.process as jest.Mock).mockResolvedValue(mockModelResponse);

        const result = await styleEngine.analyze(mockSegment, mockDocContext, mockFeatures);
        expect(result.error).toBeUndefined();
        expect(result.findings).toHaveLength(1);
        expect(result.findings[0].message).toBe('Style issue detected.'); // Default message
        expect(result.findings[0].severity).toBe('info'); // Default severity for style
        expect(result.findings[0].suggestion).toBe('Use the function.');
    });

    it('should correctly use "warning" severity if provided by LLM', async () => {
        const llmResponse = JSON.stringify([
          {
            description: 'Overly complex sentence structure.',
            problematicPhrase: 'The aforementioned system, subsequent to its implementation, effectuated a paradigm shift.',
            suggestion: 'After implementation, the system caused a major change.',
            severity: 'warning',
          },
        ]);
        const mockModelResponse: ModelResponse = { success: true, content: llmResponse };
        (mockLlmService.process as jest.Mock).mockResolvedValue(mockModelResponse);

        const result = await styleEngine.analyze(mockSegment, mockDocContext, mockFeatures);
        expect(result.error).toBeUndefined();
        expect(result.findings).toHaveLength(1);
        expect(result.findings[0].severity).toBe('warning');
    });

    it('should return an error result if llmService.process returns success:false', async () => {
      const errorMessage = 'LLM style processing failed';
      const mockModelResponse: ModelResponse = { success: false, error: errorMessage };
      (mockLlmService.process as jest.Mock).mockResolvedValue(mockModelResponse);

      const result = await styleEngine.analyze(mockSegment, mockDocContext, mockFeatures);

      expect(result.error).toBe(`Failed to analyze style: LLM query failed: ${errorMessage}`);
      expect(result.findings).toEqual([]);
      expect(mockLogger.error).toHaveBeenCalledWith(
        `[StyleEngine] Error analyzing segment ${mockSegment.id}: LLM query failed: ${errorMessage}`,
        { error: expect.any(Error) }
      );
    });

    it('should return an error result if llmService.process throws an error', async () => {
      const errorMessage = 'LLM service for style unavailable';
      (mockLlmService.process as jest.Mock).mockRejectedValue(new Error(errorMessage));

      const result = await styleEngine.analyze(mockSegment, mockDocContext, mockFeatures);

      expect(result.error).toBe(`Failed to analyze style: LLM query invocation failed: ${errorMessage}`);
      expect(result.findings).toEqual([]);
      expect(mockLogger.error).toHaveBeenCalledWith(
        `[StyleEngine] Error analyzing segment ${mockSegment.id}: LLM query invocation failed: ${errorMessage}`,
        { error: expect.any(Error) }
      );
    });
  });
});