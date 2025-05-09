// src/main/analysis/engines/grammar/grammar-rules/__tests__/context-rules.spec.ts

import { applyContextGrammarRules, ContextGrammarRules } from '../context-rules';
import { IDocumentSegment, IDocumentContext } from '../../../../context/document-context';
import { Finding } from '../../../../types';

describe('Context Grammar Rules', () => {
  const createMockSegment = (text: string): IDocumentSegment => ({
    id: 'test-segment',
    text,
    range: { start: 0, end: text.length },
  });

  describe('applyContextGrammarRules', () => {
    it('should return empty if no documentContext is provided', () => {
      const segment = createMockSegment("Some text.");
      const findings = applyContextGrammarRules(segment); // No context
      expect(findings).toEqual([]);
    });

    it('should apply rules based on document context and aggregate findings', () => {
      const segment = createMockSegment("Hey, I'm gonna go. Pienso de que es bueno.");
      const context: IDocumentContext = {
        uri: 'test-doc',
        language: 'es', // Spanish context
        metadata: { formality: 'formal', documentType: 'legal_document' },
      };
      const findings = applyContextGrammarRules(segment, context);

      const informalFinding = findings.find(f => f.message.includes("Informal term 'gonna'"));
      const dequeismoFinding = findings.find(f => f.message.includes("dequeísmo"));

      expect(findings.length).toBeGreaterThanOrEqual(1); // At least 'gonna' should be caught
      expect(informalFinding).toBeDefined();
      if (informalFinding) {
        expect(informalFinding.severity).toBe('warning');
        expect(informalFinding.offset).toBe(segment.text.indexOf('gonna'));
      }
      // The 'pienso de que' rule is very specific, let's check if it was found
      // This depends on the exact implementation of the rule.
      if (context.language === 'es' && segment.text.toLowerCase().includes('pienso de que')) {
        expect(dequeismoFinding).toBeDefined();
        if (dequeismoFinding) {
            expect(dequeismoFinding.severity).toBe('info');
            expect(dequeismoFinding.offset).toBe(segment.text.toLowerCase().indexOf('pienso de que'));
        }
      }
    });

    it('should not apply formal-language-check if context is not formal', () => {
      const segment = createMockSegment("I'm gonna go.");
      const context: IDocumentContext = {
        uri: 'test-doc',
        language: 'en',
        metadata: { formality: 'informal' }, // Informal context
      };
      const findings = applyContextGrammarRules(segment, context);
      const informalFinding = findings.find(f => f.message.includes("Informal term 'gonna'"));
      expect(informalFinding).toBeUndefined(); // Rule should not trigger
    });

    it('should handle errors in individual rules gracefully', () => {
        const originalRuleApply = ContextGrammarRules[0].apply;
        ContextGrammarRules[0].apply = jest.fn(() => { throw new Error('Test context rule error'); });
        const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});

        const segment = createMockSegment("Some text.");
        const context: IDocumentContext = { uri: 'test-doc', language: 'en', metadata: { formality: 'formal' } };
        const findings = applyContextGrammarRules(segment, context);

        expect(consoleErrorSpy).toHaveBeenCalledWith(expect.stringContaining('Error applying context grammar rule'), expect.any(Error));
        // If other rules exist and match, findings might not be empty.
        // For this test, assuming only the first rule is problematic.
        // If the 'language-specific-common-errors' rule is present and doesn't match "Some text." in 'en':
        const langRule = ContextGrammarRules.find(r => r.id === 'language-specific-common-errors');
        if (langRule && ContextGrammarRules.indexOf(langRule) > 0) { // if it's not the one we mocked
            expect(findings).toEqual([]); // Assuming it doesn't match "Some text."
        }


        ContextGrammarRules[0].apply = originalRuleApply; // Restore
        consoleErrorSpy.mockRestore();
      });
  });

  // Individual rule tests
  describe('Rule: formal-language-check', () => {
    const rule = ContextGrammarRules.find(r => r.id === 'formal-language-check');
    it('should find "gonna" in formal context', () => {
      const segment = createMockSegment("I'm gonna submit the report.");
      const context: IDocumentContext = { uri: 'doc1', metadata: { formality: 'formal' } };
      const findings = rule!.apply(segment, context);
      expect(findings).toHaveLength(1);
      expect(findings[0].message).toContain("Informal term 'gonna'");
      expect(findings[0].offset).toBe(segment.text.indexOf('gonna'));
    });

    it('should not find "gonna" if context is not formal', () => {
      const segment = createMockSegment("I'm gonna submit the report.");
      const context: IDocumentContext = { uri: 'doc1', metadata: { formality: 'informal' } };
      const findings = rule!.apply(segment, context);
      expect(findings).toHaveLength(0);
    });
  });

  describe('Rule: language-specific-common-errors (Spanish example)', () => {
    const rule = ContextGrammarRules.find(r => r.id === 'language-specific-common-errors');
    it("should find 'pienso de que' in Spanish context", () => {
      const segment = createMockSegment("Yo pienso de que es una buena idea.");
      const context: IDocumentContext = { uri: 'doc1', language: 'es' };
      const findings = rule!.apply(segment, context);
      expect(findings).toHaveLength(1);
      expect(findings[0].message).toContain("dequeísmo");
      expect(findings[0].offset).toBe(segment.text.toLowerCase().indexOf('pienso de que'));
    });

    it("should not find 'pienso de que' if language is not Spanish", () => {
      const segment = createMockSegment("I think that it's a good idea."); // English, similar structure but not the error
      const context: IDocumentContext = { uri: 'doc1', language: 'en' };
      const findings = rule!.apply(segment, context);
      expect(findings).toHaveLength(0);
    });
  });
});