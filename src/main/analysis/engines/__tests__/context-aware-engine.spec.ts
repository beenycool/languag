// src/main/analysis/engines/__tests__/context-aware-engine.spec.ts

import { ContextAwareEngine } from '../context-aware-engine';
import { IDocumentSegment, IDocumentContext } from '../../context/document-context';
import { AnalysisResult, ExtractedFeatures, Finding } from '../../types';
import { LlmService } from '../../../services/llm-service';
import appLogger from '../../../services/logger';
import * as winston from 'winston';

// Mocks
jest.mock('../../../services/llm-service');
jest.mock('../../../services/logger', () => {
    const actualLogger = jest.requireActual('../../../services/logger');
    return {
      ...actualLogger,
      default: {
        child: jest.fn().mockReturnThis(),
        info: jest.fn(),
        warn: jest.fn(),
        error: jest.fn(),
        debug: jest.fn(),
      },
      child: jest.fn().mockReturnThis(),
    };
  });


// A concrete implementation for testing ContextAwareEngine
class TestableContextAwareEngine extends ContextAwareEngine {
  readonly name: string = 'TestableContextAwareEngine';
  public analyzeMock = jest.fn(); // Mock for the abstract analyze method

  constructor(llmService?: LlmService, logger?: winston.Logger) {
    super(llmService, logger);
    // Override logger to ensure it uses the correct engine name if a child logger was created by super
    this.logger = (logger || appLogger).child({ engineName: this.name });
  }

  async analyze(
    segment: IDocumentSegment,
    documentContext?: IDocumentContext,
    features?: ExtractedFeatures,
  ): Promise<AnalysisResult> {
    // Delegate to the mock or provide a simple implementation for testing helpers
    return this.analyzeMock(segment, documentContext, features) || this.createSuccessResult(segment.id, []);
  }

  // Expose protected methods for testing
  public testBuildContextualPromptPrefix(
    segment: IDocumentSegment,
    documentContext?: IDocumentContext,
  ): string {
    return this.buildContextualPromptPrefix(segment, documentContext);
  }

  public getLogger(): winston.Logger {
    return this.logger;
  }
}

describe('ContextAwareEngine', () => {
  let engine: TestableContextAwareEngine;
  let mockLlmService: jest.Mocked<LlmService>;
  let mockLogger: jest.Mocked<winston.Logger>;

  const mockSegment: IDocumentSegment = { id: 'seg-ctx-1', text: 'Sample text.', range: { start: 0, end: 12 } };
  const mockDocContext: IDocumentContext = { uri: 'doc-ctx.txt', language: 'en', metadata: { title: 'Test Document' } };
  const mockFeatures: ExtractedFeatures = { wordCount: 2, sentenceCount: 1, keywords: ['sample', 'text'] };

  beforeEach(() => {
    jest.clearAllMocks();

    // LlmService constructor takes no arguments
    mockLlmService = new LlmService() as jest.Mocked<LlmService>;
    // We need to mock the methods that are actually called by BaseEngine or ContextAwareEngine.
    // BaseEngine calls llmService.process().
    // If ContextAwareEngine or its derivatives call other LlmService methods, they should be mocked here.
    mockLlmService.process = jest.fn();
    // BaseEngine does not directly call getProvider or getActiveProvider, but if our tests imply it,
    // or if the engine logic we are testing does, we mock them.
    // For now, let's assume 'process' is the primary one.
    // If 'getProviderName' was a typo for 'getActiveProvider()?.providerName', that's different.
    // The error suggested 'getProvider', let's mock that if it's used.
    // For the current BaseEngine.queryLLM, it doesn't seem to use getProvider directly.
    // It uses llmConfig.provider which is internal to LlmService.
    // Let's ensure the mock is sufficient for BaseEngine's needs.
    // If BaseEngine's queryLLM needs provider name for logging or other reasons,
    // it would likely get it from a method on LlmService.
    // For now, only 'process' is directly called by BaseEngine.queryLLM.
    // The 'getProviderName' was likely an error in the original test.


    mockLogger = {
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
      debug: jest.fn(),
      child: jest.fn().mockReturnThis(), // Ensure child returns the mock itself for chaining
    } as unknown as jest.Mocked<winston.Logger>;
  });

  describe('Constructor and Logger', () => {
    it('should use the provided logger and create a child with the correct engine name', () => {
      engine = new TestableContextAwareEngine(mockLlmService, mockLogger);
      expect(mockLogger.child).toHaveBeenCalledWith({ engineName: 'TestableContextAwareEngine' });
      expect(engine.getLogger()).toBe(mockLogger); // The child mock returns itself
    });

    it('should use the default appLogger and create a child if no logger is provided', () => {
      engine = new TestableContextAwareEngine(mockLlmService, undefined);
      expect(appLogger.child).toHaveBeenCalledWith({ engineName: 'TestableContextAwareEngine' });
      // This test is a bit tricky because appLogger.child also returns a mock.
      // We're essentially checking that the 'child' method was called on appLogger.
    });
  });

  describe('analyze (abstract method)', () => {
    it('should be callable and delegate to the mock implementation', async () => {
      engine = new TestableContextAwareEngine(mockLlmService, mockLogger);
      const expectedResult: AnalysisResult = { segmentId: mockSegment.id, engine: engine.name, findings: [] };
      engine.analyzeMock.mockResolvedValue(expectedResult);

      const result = await engine.analyze(mockSegment, mockDocContext, mockFeatures);
      expect(engine.analyzeMock).toHaveBeenCalledWith(mockSegment, mockDocContext, mockFeatures);
      expect(result).toBe(expectedResult);
    });
  });

  describe('buildContextualPromptPrefix', () => {
    it('should return an empty string if no context is provided', () => {
      engine = new TestableContextAwareEngine(mockLlmService, mockLogger);
      const prefix = engine.testBuildContextualPromptPrefix(mockSegment, undefined);
      expect(prefix).toBe('');
    });

    it('should include language if present in documentContext', () => {
      engine = new TestableContextAwareEngine(mockLlmService, mockLogger);
      const context: IDocumentContext = { uri: 'test.txt', language: 'fr' };
      const prefix = engine.testBuildContextualPromptPrefix(mockSegment, context);
      expect(prefix).toContain('The document language is fr.');
    });

    it('should include title if present in documentContext metadata', () => {
      engine = new TestableContextAwareEngine(mockLlmService, mockLogger);
      const context: IDocumentContext = { uri: 'test.txt', metadata: { title: 'My Awesome Doc' } };
      const prefix = engine.testBuildContextualPromptPrefix(mockSegment, context);
      expect(prefix).toContain('The document title is "My Awesome Doc".');
    });

    it('should combine multiple context elements', () => {
      engine = new TestableContextAwareEngine(mockLlmService, mockLogger);
      const prefix = engine.testBuildContextualPromptPrefix(mockSegment, mockDocContext);
      expect(prefix).toBe('The document language is en. The document title is "Test Document".');
    });

    it('should trim the resulting prefix', () => {
        engine = new TestableContextAwareEngine(mockLlmService, mockLogger);
        // Simulate context that might lead to leading/trailing spaces if not trimmed
        const contextOnlyLang: IDocumentContext = { uri: 'test.txt', language: 'de' };
        const prefix = engine.testBuildContextualPromptPrefix(mockSegment, contextOnlyLang);
        expect(prefix).toBe('The document language is de.'); 
      });
  });

  // Inherited methods from BaseEngine (createSuccessResult, createErrorResult, queryLLM)
  // are tested in base-engine.spec.ts.
  // We can add tests here if ContextAwareEngine overrides or significantly alters their behavior
  // based on context, which it currently does not directly for those methods.
});