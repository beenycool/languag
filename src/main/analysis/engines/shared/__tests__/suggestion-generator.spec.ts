// src/main/analysis/engines/shared/__tests__/suggestion-generator.spec.ts

import { SuggestionGenerator, SuggestionContext, GeneratedSuggestion } from '../suggestion-generator';
import { Finding } from '../../../types';
import { IDocumentSegment, IDocumentContext } from '../../../context/document-context';
import { LlmService } from '../../../../services/llm-service';
import appLogger from '../../../../services/logger';

describe('SuggestionGenerator', () => {
  let generator: SuggestionGenerator;
  // let mockLlmService: jest.Mocked<LlmService>; // For when LLM part is active
  const logger = appLogger.child({ module: 'SuggestionGenerator-Test' });

  beforeEach(() => {
    // generator without LLM for rule-based tests
    generator = new SuggestionGenerator(undefined, logger);
  });

  const createMockSegment = (text: string): IDocumentSegment => ({
    id: 'seg-test',
    text,
    range: { start: 0, end: text.length },
  });

  const createMockContext = (uri: string = 'doc-test'): IDocumentContext => ({ uri });

  const createMockFinding = (
    message: string,
    type: string,
    suggestion?: string,
    offset?: number,
    length?: number
  ): Finding => ({
    message,
    type,
    severity: 'info', // Default severity for tests
    suggestion,
    offset,
    length,
  });

  it('should return a simple informational suggestion if finding already has one', async () => {
    const finding = createMockFinding("Grammar issue here.", "GrammarRuleViolation", "Consider rephrasing this part.");
    const segment = createMockSegment("Some text with grammar issue here.");
    const suggestionContext: SuggestionContext = { finding, segment, documentContext: createMockContext() };

    const generated = await generator.generate(suggestionContext);
    expect(generated).toEqual({
      description: "Consider rephrasing this part.",
      action: 'replace', // Updated logic makes this 'replace'
    });
  });
  
  it('should make "Consider rephrasing" actionable for GrammarRuleViolation', async () => {
    const finding = createMockFinding(
        "This phrase is awkward, consider rephrasing.",
        "GrammarRuleViolation", // Type is important
        "Consider rephrasing this awkward phrase." // The suggestion text itself
    );
    const segment = createMockSegment("This is the awkward phrase indeed.");
    const suggestionContext: SuggestionContext = { finding, segment };
    const generated = await generator.generate(suggestionContext);
    expect(generated).toEqual({
        description: "Consider rephrasing this awkward phrase.",
        action: 'replace', // Should be 'replace' due to type and message content
    });
  });


  it("should generate specific suggestion for 'utilize' finding", async () => {
    const finding = createMockFinding("The text uses 'utilize'.", "StyleSuggestion"); // No direct suggestion in finding
    const segment = createMockSegment("We will utilize the new tools.");
    const suggestionContext: SuggestionContext = { finding, segment };

    const generated = await generator.generate(suggestionContext);
    expect(generated).toEqual({
      description: "Replace 'utilize' with 'use' for better clarity with a general audience.",
      action: 'replace',
      replacementText: 'use',
      confidence: 0.9,
    });
  });

  it("should generate specific suggestion for 'You guys' finding", async () => {
    const finding = createMockFinding("'You guys' used.", "CulturalSensitivity");
    const segment = createMockSegment("Hey you guys, check this out!");
    const suggestionContext: SuggestionContext = { finding, segment };

    const generated = await generator.generate(suggestionContext);
    expect(generated).toEqual({
        description: "Replace 'you guys' with a more inclusive term like 'everyone', 'folks', or 'team'.",
        action: 'replace',
        // replacementText: 'everyone', // Not picking one by default now
        confidence: 0.85,
    });
  });

  it('should return null if no specific rule matches and LLM is not used', async () => {
    const finding = createMockFinding("An unknown issue.", "UnknownType");
    const segment = createMockSegment("Some text with an unknown issue.");
    const suggestionContext: SuggestionContext = { finding, segment };

    const generated = await generator.generate(suggestionContext);
    expect(generated).toBeNull();
  });

  // TODO: Add tests for LLM interaction when that part is enabled.
  /*
  describe('LLM-based suggestion generation (when enabled)', () => {
    let mockLlmService: jest.Mocked<LlmService>;
    beforeEach(() => {
      mockLlmService = { process: jest.fn() } as unknown as jest.Mocked<LlmService>;
      generator = new SuggestionGenerator(mockLlmService, logger);
    });

    it('should use LLM and parse successful response for a replacement', async () => {
      const finding = createMockFinding("The sentence structure is confusing.", "ClarityIssue", undefined, 10, 20);
      const segmentText = "Although the dog, which was brown, quickly ran, it did so with grace.";
      const segment = createMockSegment(segmentText);
      const suggestionContext: SuggestionContext = { finding, segment };

      mockLlmService.process.mockResolvedValue({
        success: true,
        content: "DESCRIPTION: Rephrase to 'The brown dog ran quickly and gracefully.' ACTION: replace REPLACEMENT: The brown dog ran quickly and gracefully.",
      });

      const generated = await generator.generate(suggestionContext);
      expect(mockLlmService.process).toHaveBeenCalled();
      expect(generated).toEqual({
        description: "Rephrase to 'The brown dog ran quickly and gracefully.'",
        action: 'replace',
        replacementText: "The brown dog ran quickly and gracefully.",
        confidence: 0.7,
      });
    });
    
    it('should use LLM and parse successful response for an informational suggestion', async () => {
        const finding = createMockFinding("The tone seems a bit harsh here.", "ToneIssue", undefined, 5, 10);
        const segmentText = "Your work is simply not good enough.";
        const segment = createMockSegment(segmentText);
        const suggestionContext: SuggestionContext = { finding, segment };
  
        mockLlmService.process.mockResolvedValue({
          success: true,
          content: "DESCRIPTION: Consider softening the language, for example, by focusing on specific areas for improvement rather than a general negative statement. ACTION: informational",
        });
  
        const generated = await generator.generate(suggestionContext);
        expect(generated).toEqual({
          description: "Consider softening the language, for example, by focusing on specific areas for improvement rather than a general negative statement.",
          action: 'informational',
          replacementText: undefined,
          confidence: 0.7,
        });
      });

    it('should fallback to null if LLM response is not in expected format', async () => {
      const finding = createMockFinding("Complex issue.", "GenericProblem");
      const segment = createMockSegment("Text for LLM suggestion.");
      const suggestionContext: SuggestionContext = { finding, segment };
      mockLlmService.process.mockResolvedValue({
        success: true,
        content: "Maybe try something else?", // Incorrect format
      });
      const generated = await generator.generate(suggestionContext);
      expect(generated).toBeNull(); // Falls back to null
    });
  });
  */
});