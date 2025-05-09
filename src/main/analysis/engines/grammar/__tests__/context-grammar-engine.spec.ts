// src/main/analysis/engines/grammar/__tests__/context-grammar-engine.spec.ts

import { ContextAwareGrammarEngine } from '../context-grammar-engine';
import { IDocumentSegment, IDocumentContext } from '../../../context/document-context';
import { LlmService } from '../../../../services/llm-service';
import { Finding } from '../../../types';
import appLogger from '../../../../services/logger';

// Mock the rule application functions
jest.mock('../grammar-rules/base-rules', () => ({
  applyBaseGrammarRules: jest.fn(),
}));
jest.mock('../grammar-rules/context-rules', () => ({
  applyContextGrammarRules: jest.fn(),
}));
jest.mock('../grammar-rules/genre-rules', () => ({
  applyGenreGrammarRules: jest.fn(),
}));

import { applyBaseGrammarRules } from '../grammar-rules/base-rules';
import { applyContextGrammarRules } from '../grammar-rules/context-rules';
import { applyGenreGrammarRules } from '../grammar-rules/genre-rules';

describe('ContextAwareGrammarEngine', () => {
  let engine: ContextAwareGrammarEngine;
  let mockLlmService: jest.Mocked<LlmService>;
  const mockLogger = appLogger.child({ module: 'ContextAwareGrammarEngine-Test' });

  beforeEach(() => {
    // Reset mocks before each test
    (applyBaseGrammarRules as jest.Mock).mockReset().mockReturnValue([]);
    (applyContextGrammarRules as jest.Mock).mockReset().mockReturnValue([]);
    (applyGenreGrammarRules as jest.Mock).mockReset().mockReturnValue([]);

    // mockLlmService = {
    //   process: jest.fn(),
    //   // Add other methods if ContextAwareGrammarEngine uses them directly
    // } as unknown as jest.Mocked<LlmService>;
    // For now, not passing LLM service as it's optional and LLM part is commented out
    engine = new ContextAwareGrammarEngine(undefined, mockLogger);
  });

  const createMockSegment = (id: string, text: string): IDocumentSegment => ({
    id,
    text,
    range: { start: 0, end: text.length },
  });

  const createMockContext = (uri: string, language?: string, metadata?: Record<string, any>): IDocumentContext => ({
    uri,
    language,
    metadata,
  });

  it('should have the correct name', () => {
    expect(engine.name).toBe('ContextAwareGrammarEngine');
  });

  it('should call all rule applicators and return combined findings', async () => {
    const segment = createMockSegment('seg1', "This is a test segment with a very bad grammar mistake and some informal language like gonna.");
    const context = createMockContext('doc1', 'en', { formality: 'formal', genre: 'academic' });

    const baseFindings: Finding[] = [{ type: 'BaseRule', message: 'Base issue', severity: 'error', offset: 10, length: 4 }];
    const contextFindings: Finding[] = [{ type: 'ContextRule', message: 'Context issue', severity: 'warning', offset: 20, length: 5 }];
    const genreFindings: Finding[] = [{ type: 'GenreRule', message: 'Genre issue', severity: 'info', offset: 30, length: 6 }];

    (applyBaseGrammarRules as jest.Mock).mockReturnValue(baseFindings);
    (applyContextGrammarRules as jest.Mock).mockReturnValue(contextFindings);
    (applyGenreGrammarRules as jest.Mock).mockReturnValue(genreFindings);

    const result = await engine.analyze(segment, context);

    expect(applyBaseGrammarRules).toHaveBeenCalledWith(segment, context);
    expect(applyContextGrammarRules).toHaveBeenCalledWith(segment, context);
    expect(applyGenreGrammarRules).toHaveBeenCalledWith(segment, context, undefined); // features is undefined

    expect(result.findings).toHaveLength(3);
    expect(result.findings).toEqual(expect.arrayContaining([...baseFindings, ...contextFindings, ...genreFindings]));
    expect(result.error).toBeUndefined();
  });

  it('should handle cases where no findings are returned by rules', async () => {
    const segment = createMockSegment('seg1', "Perfect text.");
    const context = createMockContext('doc1', 'en');

    // All rule applicators return empty arrays (default mock behavior now)

    const result = await engine.analyze(segment, context);

    expect(result.findings).toHaveLength(0);
    expect(result.error).toBeUndefined();
  });

  it('should handle missing document context gracefully for context and genre rules', async () => {
    const segment = createMockSegment('seg1', "Text without context.");
    // No context provided

    const baseFindings: Finding[] = [{ type: 'BaseRule', message: 'Base issue only', severity: 'error', offset: 0, length: 4 }];
    (applyBaseGrammarRules as jest.Mock).mockReturnValue(baseFindings);

    const result = await engine.analyze(segment); // No context

    expect(applyBaseGrammarRules).toHaveBeenCalledWith(segment, undefined);
    // applyContextGrammarRules might not be called or might handle undefined context internally
    // applyGenreGrammarRules might not be called or might handle undefined context internally
    // Based on current engine implementation, they are called with undefined context.
    expect(applyContextGrammarRules).toHaveBeenCalledWith(segment, undefined);
    expect(applyGenreGrammarRules).toHaveBeenCalledWith(segment, undefined, undefined);


    expect(result.findings).toEqual(baseFindings);
    expect(result.error).toBeUndefined();
  });

  it('should remove duplicate findings', async () => {
    const segment = createMockSegment('seg1', "Duplicate duplicate.");
    const context = createMockContext('doc1');

    const finding1: Finding = { type: 'DupRule', message: 'Duplicate', severity: 'warning', offset: 0, length: 9 };
    const finding2: Finding = { type: 'DupRule', message: 'Duplicate', severity: 'warning', offset: 0, length: 9 }; // Exact duplicate
    const finding3: Finding = { type: 'OtherRule', message: 'Different', severity: 'info', offset: 10, length: 9 };


    (applyBaseGrammarRules as jest.Mock).mockReturnValue([finding1, finding3]);
    (applyContextGrammarRules as jest.Mock).mockReturnValue([finding2]); // finding2 is a duplicate of finding1

    const result = await engine.analyze(segment, context);

    expect(result.findings).toHaveLength(2);
    expect(result.findings).toEqual(expect.arrayContaining([finding1, finding3]));
  });


  it('should return an error result if a rule applicator throws an error', async () => {
    const segment = createMockSegment('seg1', "Error prone text.");
    const context = createMockContext('doc1');
    const errorMessage = 'Rule failed!';

    (applyBaseGrammarRules as jest.Mock).mockImplementation(() => {
      throw new Error(errorMessage);
    });

    const result = await engine.analyze(segment, context);

    expect(result.findings).toHaveLength(0);
    expect(result.error).toBe(errorMessage);
  });

  // TODO: Add tests for LLM interaction if/when that part is enabled and fleshed out.
  // This would involve mocking LlmService.process and verifying its calls and responses.
});