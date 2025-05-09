// src/main/analysis/engines/style/__tests__/style-classifier.spec.ts

import { StyleClassifier, StyleClassification } from '../style-classifier';
import { IDocumentSegment, IDocumentContext } from '../../../context/document-context';
import { LlmService } from '../../../../services/llm-service';
import appLogger from '../../../../services/logger';

describe('StyleClassifier', () => {
  let classifier: StyleClassifier;
  let mockLlmService: jest.Mocked<LlmService>;
  const logger = appLogger.child({ module: 'StyleClassifier-Test' });

  beforeEach(() => {
    // mockLlmService = {
    //   process: jest.fn(),
    // } as unknown as jest.Mocked<LlmService>;
    // For now, testing rule-based and fallback as LLM part is commented out
    classifier = new StyleClassifier(undefined, logger);
  });

  const createMockSegment = (text: string): IDocumentSegment => ({
    id: 'seg-test',
    text,
    range: { start: 0, end: text.length },
  });

  const createMockContext = (uri: string = 'doc-test'): IDocumentContext => ({ uri });

  it('should classify academic style based on keywords', async () => {
    const segment = createMockSegment("This paper discusses methodology and references previous PhD work.");
    const classification = await classifier.classify(segment, createMockContext());
    expect(classification.primaryStyle).toBe('academic');
    expect(classification.confidence).toBe(0.7);
    expect(classification.details?.reason).toBe('Keywords match');
  });

  it('should classify informal style based on slang', async () => {
    const segment = createMockSegment("Dude, that's awesome! lol gonna go now.");
    const classification = await classifier.classify(segment, createMockContext());
    expect(classification.primaryStyle).toBe('informal');
    expect(classification.confidence).toBe(0.8);
    expect(classification.details?.reason).toBe('Slang detected');
  });

  it('should classify formal style based on lexicon', async () => {
    const segment = createMockSegment("We shall heretofore proceed pursuant to the agreement.");
    const classification = await classifier.classify(segment, createMockContext());
    expect(classification.primaryStyle).toBe('formal');
    expect(classification.confidence).toBe(0.75);
    expect(classification.details?.reason).toBe('Formal lexicon');
  });

  it('should return "unknown" for text not matching simple rules (LLM part commented out)', async () => {
    const segment = createMockSegment("A very neutral and generic piece of text.");
    const classification = await classifier.classify(segment, createMockContext());
    expect(classification.primaryStyle).toBe('unknown');
    expect(classification.confidence).toBe(0.3);
    expect(classification.details?.reason).toBe('Default fallback');
  });

  // TODO: Add tests for LLM interaction if that part is enabled and fleshed out.
  // This would involve:
  // 1. Providing a mockLlmService to the StyleClassifier constructor.
  // 2. Mocking `llmService.process` to return various responses (success, failure, unexpected format).
  // 3. Verifying that the classifier parses the LLM response correctly or handles errors.
  /*
  describe('LLM-based classification (when enabled)', () => {
    beforeEach(() => {
      mockLlmService = {
        process: jest.fn(),
      } as unknown as jest.Mocked<LlmService>;
      classifier = new StyleClassifier(mockLlmService, logger); // Classifier with LLM
    });

    it('should use LLM and parse successful response', async () => {
      const segment = createMockSegment("An intricate narrative woven with metaphorical elegance.");
      mockLlmService.process.mockResolvedValue({
        success: true,
        content: "STYLE: creative, CONFIDENCE: 0.85",
      });
      const classification = await classifier.classify(segment, createMockContext());
      expect(mockLlmService.process).toHaveBeenCalled();
      expect(classification.primaryStyle).toBe('creative');
      expect(classification.confidence).toBe(0.85);
    });

    it('should fallback if LLM response is not in expected format', async () => {
      const segment = createMockSegment("Some text for LLM.");
      mockLlmService.process.mockResolvedValue({
        success: true,
        content: "This is creative.", // Incorrect format
      });
      const classification = await classifier.classify(segment, createMockContext());
      expect(classification.primaryStyle).toBe('unknown'); // Falls back
      expect(classification.confidence).toBe(0.3);
    });

    it('should fallback if LLM process fails', async () => {
      const segment = createMockSegment("Some text for LLM.");
      mockLlmService.process.mockResolvedValue({ success: false, error: "LLM error" });
      const classification = await classifier.classify(segment, createMockContext());
      expect(classification.primaryStyle).toBe('unknown');
      expect(classification.confidence).toBe(0.3);
    });

    it('should fallback if LLM process throws an error', async () => {
        const segment = createMockSegment("Some text for LLM.");
        mockLlmService.process.mockRejectedValue(new Error("Network failure"));
        const classification = await classifier.classify(segment, createMockContext());
        expect(classification.primaryStyle).toBe('unknown');
        expect(classification.confidence).toBe(0.3);
      });
  });
  */
});