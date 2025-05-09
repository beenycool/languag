// src/main/analysis/engines/tone/__tests__/formality-detector.spec.ts

import { FormalityDetector, FormalityLevel } from '../formality-detector';
import { IDocumentSegment, IDocumentContext } from '../../../context/document-context';
import { LlmService } from '../../../../services/llm-service';
import appLogger from '../../../../services/logger';

describe('FormalityDetector', () => {
  let detector: FormalityDetector;
  // let mockLlmService: jest.Mocked<LlmService>; // For when LLM part is active
  const logger = appLogger.child({ module: 'FormalityDetector-Test' });

  beforeEach(() => {
    // detector without LLM for rule-based tests
    detector = new FormalityDetector(undefined, logger);
  });

  const createMockSegment = (text: string): IDocumentSegment => ({
    id: 'seg-test',
    text,
    range: { start: 0, end: text.length },
  });

  const createMockContext = (uri: string = 'doc-test', metadata?: Record<string, any>): IDocumentContext => ({ uri, metadata });

  it('should detect informal style from slang/abbreviations', async () => {
    const segment = createMockSegment("Hey dude, BTW, I'm gonna be late FYI.");
    const formality = await detector.detect(segment, createMockContext());
    expect(formality.level).toBe('informal');
    expect(formality.confidence).toBe(0.85);
    expect(formality.details?.reason).toBe('Informal slang/abbreviations');
  });

  it('should detect formal style from lexicon/phrasing', async () => {
    const segment = createMockSegment("To Whom It May Concern: We shall henceforth proceed pursuant to the agreement.");
    const formality = await detector.detect(segment, createMockContext());
    expect(formality.level).toBe('formal');
    expect(formality.confidence).toBe(0.9);
    expect(formality.details?.reason).toBe('Formal lexicon/phrasing');
  });

  it('should return neutral for text not matching strong rules (LLM part commented out)', async () => {
    const segment = createMockSegment("This is a standard sentence. It's neither very formal nor informal.");
    const formality = await detector.detect(segment, createMockContext());
    expect(formality.level).toBe('neutral');
    expect(formality.confidence).toBe(0.4); // Default fallback confidence
    expect(formality.details?.reason).toBe('Default fallback');
  });

  it('should infer formality from document type if available (fallback)', async () => {
    const segment = createMockSegment("A standard sentence.");
    let context = createMockContext('doc1', { documentType: 'legal_document' });
    let formality = await detector.detect(segment, context);
    expect(formality.level).toBe('formal');
    expect(formality.confidence).toBe(0.6);
    expect(formality.details?.reason).toContain('Inferred from document type');

    context = createMockContext('doc2', { documentType: 'chat_log' });
    formality = await detector.detect(segment, context);
    expect(formality.level).toBe('informal');
    expect(formality.confidence).toBe(0.6);
    expect(formality.details?.reason).toContain('Inferred from document type');
  });
  
  it('should prioritize direct rule match over document type inference', async () => {
    const segment = createMockSegment("Heretofore, this is a legal point, but BTW, it's also simple."); // Contains formal and informal cues
    // The rule for "BTW" (informal) should take precedence over "legal_document" (formal) type if both apply.
    // Current rule implementation: first match wins. "BTW" is checked before "heretofore".
    // Let's test with a text that has only formal words but informal doc type.
    const formalTextInInformalDoc = createMockSegment("We shall proceed.");
    const context = createMockContext('doc-chat', { documentType: 'chat_log' }); // Informal doc type
    
    // The rule for "shall" (formal) should be detected.
    const formality = await detector.detect(formalTextInInformalDoc, context);
    expect(formality.level).toBe('formal'); // Rule for "shall"
    expect(formality.confidence).toBe(0.9); 
  });


  // TODO: Add tests for LLM interaction when that part is enabled.
  /*
  describe('LLM-based formality detection (when enabled)', () => {
    let mockLlmService: jest.Mocked<LlmService>;
    beforeEach(() => {
      mockLlmService = { process: jest.fn() } as unknown as jest.Mocked<LlmService>;
      detector = new FormalityDetector(mockLlmService, logger);
    });

    it('should use LLM and parse successful response', async () => {
      const segment = createMockSegment("The discourse presented herein necessitates meticulous consideration.");
      mockLlmService.process.mockResolvedValue({
        success: true,
        content: "LEVEL: formal, CONFIDENCE: 0.95",
      });
      const formality = await detector.detect(segment, createMockContext());
      expect(mockLlmService.process).toHaveBeenCalled();
      expect(formality.level).toBe('formal');
      expect(formality.confidence).toBe(0.95);
    });
  });
  */
});