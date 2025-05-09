// src/main/analysis/engines/grammar/grammar-rules/__tests__/genre-rules.spec.ts

import { applyGenreGrammarRules, GenreGrammarRules } from '../genre-rules';
import { IDocumentSegment, IDocumentContext } from '../../../../context/document-context';
import { Finding, ExtractedFeatures } from '../../../../types';

describe('Genre Grammar Rules', () => {
  const createMockSegment = (text: string): IDocumentSegment => ({
    id: 'test-segment',
    text,
    range: { start: 0, end: text.length },
  });

  const mockFeatures: ExtractedFeatures = { // Define some mock features
    wordCount: 10,
    sentenceCount: 1,
    keywords: ['test'],
  };

  describe('applyGenreGrammarRules', () => {
    it('should return empty if no genre information is available in context', () => {
      const segment = createMockSegment("Some text.");
      const context: IDocumentContext = { uri: 'test-doc', language: 'en' }; // No genre in metadata
      const findings = applyGenreGrammarRules(segment, context, mockFeatures);
      expect(findings).toEqual([]);
    });

    it('should apply rules based on genre from documentContext.metadata and aggregate findings', () => {
      const segment = createMockSegment('The experiment was conducted. "Hello," he said.');
      const context: IDocumentContext = {
        uri: 'test-doc',
        language: 'en',
        metadata: { genre: 'academic' }, // Academic genre
      };
      const findings = applyGenreGrammarRules(segment, context, mockFeatures);

      // Check for academic passive voice (example rule)
      const passiveVoiceFinding = findings.find(f => f.message.includes('Potential passive voice'));
      expect(passiveVoiceFinding).toBeDefined();
      if (passiveVoiceFinding) {
        expect(passiveVoiceFinding.severity).toBe('info');
        expect(passiveVoiceFinding.offset).toBe(segment.text.indexOf('was conducted'));
      }
      // Fiction dialogue rule should not trigger for academic genre
      const dialogueFinding = findings.find(f => f.message.includes('Dialogue'));
      expect(dialogueFinding).toBeUndefined();
    });

    it('should apply rules based on genre from documentContext.features (alternative)', () => {
        const segment = createMockSegment('The experiment was conducted. "Hello," he said.');
        // Simulate genre being in a 'features' property of context if metadata.genre is not standard
        const contextWithFeaturesGenre = {
          uri: 'test-doc',
          language: 'en',
          metadata: {},
          features: { genre: 'academic' } // Genre in a custom features object
        } as unknown as IDocumentContext; // Cast to bypass strict IDocumentContext typing for test

        const findings = applyGenreGrammarRules(segment, contextWithFeaturesGenre, mockFeatures);
        const passiveVoiceFinding = findings.find(f => f.message.includes('Potential passive voice'));
        expect(passiveVoiceFinding).toBeDefined();
      });


    it('should apply fiction dialogue rule for fiction genre', () => {
      const segment = createMockSegment('"Stop" he yelled. "Or I will shoot!"'); // Missing comma, missing period
      const context: IDocumentContext = {
        uri: 'test-doc',
        language: 'en',
        metadata: { genre: 'fiction' },
      };
      const findings = applyGenreGrammarRules(segment, context, mockFeatures);
      const dialogueFinding1 = findings.find(f => f.offset === segment.text.indexOf('"Stop"') + '"Stop"'.length -1);
      const dialogueFinding2 = findings.find(f => f.offset === segment.text.indexOf('"Or I will shoot!"') + '"Or I will shoot!"'.length -1);


      expect(findings.length).toBeGreaterThanOrEqual(1); // Expect at least one dialogue issue
      expect(dialogueFinding1).toBeDefined();
      if(dialogueFinding1) {
        expect(dialogueFinding1.message).toContain('Dialogue "Stop" might be missing ending punctuation');
      }
      // The second dialogue part is more complex due to the exclamation mark.
      // The current simple rule might or might not catch it depending on its logic.
      // For "Or I will shoot!", the last char is '!', so it should NOT be flagged by the current rule.
      expect(dialogueFinding2).toBeUndefined(); // Because "!" is a valid punctuation.

      const segmentWithMissingPunc = createMockSegment('"Wait" she whispered');
      const findingsPunc = applyGenreGrammarRules(segmentWithMissingPunc, context, mockFeatures);
      expect(findingsPunc.length).toBe(1);
      expect(findingsPunc[0].message).toContain('Dialogue "Wait" might be missing ending punctuation');

    });

    it('should handle errors in individual rules gracefully', () => {
        const originalRuleApply = GenreGrammarRules[0].apply;
        GenreGrammarRules[0].apply = jest.fn(() => { throw new Error('Test genre rule error'); });
        const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});

        const segment = createMockSegment("Some text for genre rule.");
        const context: IDocumentContext = { uri: 'test-doc', metadata: { genre: 'academic' } };
        const findings = applyGenreGrammarRules(segment, context, mockFeatures);

        expect(consoleErrorSpy).toHaveBeenCalledWith(expect.stringContaining('Error applying genre grammar rule'), expect.any(Error));
        // If other rules exist and match, findings might not be empty.
        // For this test, assuming only the first rule is problematic.
        const fictionRule = GenreGrammarRules.find(r => r.id === 'fiction-dialogue-punctuation');
        if (fictionRule && GenreGrammarRules.indexOf(fictionRule) > 0) { // if it's not the one we mocked
             expect(findings).toEqual([]); // Assuming it doesn't match "Some text for genre rule." in 'academic'
        }

        GenreGrammarRules[0].apply = originalRuleApply; // Restore
        consoleErrorSpy.mockRestore();
      });
  });

  // Individual rule tests
  describe('Rule: academic-passive-voice-check', () => {
    const rule = GenreGrammarRules.find(r => r.id === 'academic-passive-voice-check');
    it('should find passive voice in academic genre', () => {
      const segment = createMockSegment("The results are determined by the process.");
      const context: IDocumentContext = { uri: 'doc1', metadata: { genre: 'academic' } };
      const findings = rule!.apply(segment, context);
      expect(findings.length).toBeGreaterThanOrEqual(1);
      expect(findings[0].message).toContain('Potential passive voice');
      expect(findings[0].offset).toBe(segment.text.indexOf('are determined'));
    });

    it('should not find passive voice if genre is not academic', () => {
      const segment = createMockSegment("The results are determined by the process.");
      const context: IDocumentContext = { uri: 'doc1', metadata: { genre: 'fiction' } };
      const findings = rule!.apply(segment, context);
      expect(findings).toHaveLength(0);
    });
  });

  describe('Rule: fiction-dialogue-punctuation', () => {
    const rule = GenreGrammarRules.find(r => r.id === 'fiction-dialogue-punctuation');
    it('should flag dialogue missing punctuation in fiction', () => {
      const segment = createMockSegment('"Look out" he shouted.');
      const context: IDocumentContext = { uri: 'doc1', metadata: { genre: 'fiction' } };
      const findings = rule!.apply(segment, context);
      expect(findings).toHaveLength(1);
      expect(findings[0].message).toContain('Dialogue "Look out" might be missing');
      expect(findings[0].offset).toBe(segment.text.indexOf('"Look out"') + '"Look out"'.length -1);
    });

    it('should not flag correctly punctuated dialogue', () => {
      const segment = createMockSegment('"Look out!" he shouted.');
      const context: IDocumentContext = { uri: 'doc1', metadata: { genre: 'fiction' } };
      const findings = rule!.apply(segment, context);
      expect(findings).toHaveLength(0);
    });

    it('should not flag if genre is not fiction', () => {
      const segment = createMockSegment('"Look out" he shouted.');
      const context: IDocumentContext = { uri: 'doc1', metadata: { genre: 'news_report' } };
      const findings = rule!.apply(segment, context);
      expect(findings).toHaveLength(0);
    });
  });
});