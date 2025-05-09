// src/main/analysis/engines/tone/__tests__/emotional-analyzer.spec.ts

import { EmotionalAnalyzer, EmotionalProfile } from '../emotional-analyzer';
import { IDocumentSegment, IDocumentContext } from '../../../context/document-context';
import { LlmService } from '../../../../services/llm-service';
import appLogger from '../../../../services/logger';

describe('EmotionalAnalyzer', () => {
  let analyzer: EmotionalAnalyzer;
  // let mockLlmService: jest.Mocked<LlmService>; // For when LLM part is active
  const logger = appLogger.child({ module: 'EmotionalAnalyzer-Test' });

  beforeEach(() => {
    // mockLlmService = { process: jest.fn() } as unknown as jest.Mocked<LlmService>;
    // Analyzer without LLM for rule-based tests
    analyzer = new EmotionalAnalyzer(undefined, logger);
  });

  const createMockSegment = (text: string): IDocumentSegment => ({
    id: 'seg-test',
    text,
    range: { start: 0, end: text.length },
  });

  const createMockContext = (uri: string = 'doc-test'): IDocumentContext => ({ uri });

  it('should detect joy from keywords', async () => {
    const segment = createMockSegment("I am so happy and joyful today!");
    const profile = await analyzer.analyze(segment, createMockContext());
    expect(profile.primaryEmotion).toBe('joy');
    expect(profile.primaryEmotionScore).toBe(0.8);
    expect(profile.sentiment?.label).toBe('positive');
  });

  it('should detect sadness from keywords', async () => {
    const segment = createMockSegment("It made me cry, I am so unhappy.");
    const profile = await analyzer.analyze(segment, createMockContext());
    expect(profile.primaryEmotion).toBe('sadness');
    expect(profile.primaryEmotionScore).toBe(0.75);
    expect(profile.sentiment?.label).toBe('negative');
  });

  it('should detect anger from keywords', async () => {
    const segment = createMockSegment("I am furious! This is an outrage!");
    const profile = await analyzer.analyze(segment, createMockContext());
    expect(profile.primaryEmotion).toBe('anger');
    expect(profile.primaryEmotionScore).toBe(0.85);
    expect(profile.sentiment?.label).toBe('negative');
  });

  it('should return neutral for text not matching simple rules (LLM part commented out)', async () => {
    const segment = createMockSegment("This is a very factual statement.");
    const profile = await analyzer.analyze(segment, createMockContext());
    expect(profile.primaryEmotion).toBe('neutral');
    expect(profile.primaryEmotionScore).toBe(0.5);
    expect(profile.sentiment?.label).toBe('neutral');
    expect(profile.details?.reason).toBe('Default fallback');
  });

  // TODO: Add tests for LLM interaction when that part is enabled.
  // Similar to StyleClassifier tests: mock LlmService, test successful parsing,
  // test fallback on LLM error or unexpected format.
  /*
  describe('LLM-based emotion analysis (when enabled)', () => {
    let mockLlmService: jest.Mocked<LlmService>;
    beforeEach(() => {
      mockLlmService = { process: jest.fn() } as unknown as jest.Mocked<LlmService>;
      analyzer = new EmotionalAnalyzer(mockLlmService, logger);
    });

    it('should use LLM and parse successful response', async () => {
      const segment = createMockSegment("The sunset was breathtakingly beautiful, filling me with awe.");
      mockLlmService.process.mockResolvedValue({
        success: true,
        content: "PRIMARY_EMOTION: surprise, INTENSITY: 0.7, SENTIMENT_SCORE: 0.8, SENTIMENT_LABEL: positive",
      });
      const profile = await analyzer.analyze(segment, createMockContext());
      expect(mockLlmService.process).toHaveBeenCalled();
      expect(profile.primaryEmotion).toBe('surprise');
      expect(profile.primaryEmotionScore).toBe(0.7);
      expect(profile.sentiment?.score).toBe(0.8);
      expect(profile.sentiment?.label).toBe('positive');
    });

    it('should fallback if LLM response is not in expected format', async () => {
      const segment = createMockSegment("Some text for LLM emotion check.");
      mockLlmService.process.mockResolvedValue({
        success: true,
        content: "This seems positive.", // Incorrect format
      });
      const profile = await analyzer.analyze(segment, createMockContext());
      expect(profile.primaryEmotion).toBe('neutral'); // Falls back
    });
  });
  */
});