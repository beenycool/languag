// src/main/analysis/engines/grammar/grammar-rules/__tests__/base-rules.spec.ts

import { applyBaseGrammarRules, BaseGrammarRules } from '../base-rules';
import { IDocumentSegment, IDocumentContext } from '../../../../context/document-context';
import { Finding } from '../../../../types';

describe('Base Grammar Rules', () => {
  const createMockSegment = (text: string): IDocumentSegment => ({
    id: 'test-segment',
    text,
    range: { start: 0, end: text.length },
  });

  const mockContext: IDocumentContext = {
    uri: 'test-doc',
    language: 'en',
  };

  describe('applyBaseGrammarRules', () => {
    it('should apply all base rules and aggregate findings', () => {
      const segment = createMockSegment("Test can't not be good. Its a nice day.");
      const findings = applyBaseGrammarRules(segment, mockContext);

      // Check if specific rules were triggered (based on example rules)
      const doubleNegativeFinding = findings.find(f => f.message.includes('double negative'));
      const itsItsFinding = findings.find(f => f.message.includes("Review usage of 'Its'"));


      expect(findings.length).toBeGreaterThanOrEqual(2); // Expecting at least two findings from the sample rules
      expect(doubleNegativeFinding).toBeDefined();
      expect(itsItsFinding).toBeDefined();

      if (doubleNegativeFinding) {
        expect(doubleNegativeFinding.severity).toBe('warning');
        expect(doubleNegativeFinding.offset).toBe(segment.text.toLowerCase().indexOf("can't not"));
      }
      if (itsItsFinding) {
        expect(itsItsFinding.severity).toBe('info');
        // Note: The 'Its a nice day' will match 'Its'. The rule flags all 'its'/'it's'.
        expect(itsItsFinding.offset).toBe(segment.text.indexOf('Its'));
      }
    });

    it('should return an empty array if no rules match', () => {
      const segment = createMockSegment("This is perfectly fine text.");
      const findings = applyBaseGrammarRules(segment, mockContext);
      expect(findings).toEqual([]);
    });

    it('should handle errors in individual rules gracefully', () => {
      const originalRuleApply = BaseGrammarRules[0].apply;
      BaseGrammarRules[0].apply = jest.fn(() => { throw new Error('Test rule error'); });
      const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});

      const segment = createMockSegment("Some text.");
      // We expect findings from other rules if they exist and match
      // For this test, assuming only the first rule is problematic and others don't match or don't exist.
      // If other rules existed and matched, this test would need adjustment.
      const findings = applyBaseGrammarRules(segment, mockContext);

      expect(consoleErrorSpy).toHaveBeenCalledWith(expect.stringContaining('Error applying base grammar rule'), expect.any(Error));
      // Depending on whether other rules produce findings, this might change.
      // If BaseGrammarRules only has the mocked rule and one more that doesn't match "Some text.":
      const itsRuleIndex = BaseGrammarRules.findIndex(r => r.id === "common-misspelling-its-it's");
      if (itsRuleIndex > 0 && BaseGrammarRules[itsRuleIndex]) {
         // If the 'its' rule is present and doesn't match "Some text.", findings should be empty.
         expect(findings).toEqual([]);
      }


      BaseGrammarRules[0].apply = originalRuleApply; // Restore original function
      consoleErrorSpy.mockRestore();
    });
  });

  // Individual rule tests (optional, but good for complex rules)
  describe('Rule: double-negative', () => {
    const rule = BaseGrammarRules.find(r => r.id === 'double-negative');
    it('should find "can\'t not"', () => {
      const segment = createMockSegment("You can't not go.");
      const findings = rule!.apply(segment, mockContext);
      expect(findings).toHaveLength(1);
      expect(findings[0].message).toContain('double negative');
      expect(findings[0].offset).toBe(segment.text.indexOf("can't not"));
    });
  });

  describe("Rule: common-misspelling-its-it's", () => {
    const rule = BaseGrammarRules.find(r => r.id === "common-misspelling-its-it's");
    it("should find 'its' and 'it's'", () => {
      const segment = createMockSegment("It's a cat. Its fur is soft.");
      const findings = rule!.apply(segment, mockContext);
      expect(findings).toHaveLength(2);
      expect(findings[0].message).toContain("Review usage of 'It's'");
      expect(findings[0].offset).toBe(segment.text.indexOf("It's"));
      expect(findings[1].message).toContain("Review usage of 'Its'");
      expect(findings[1].offset).toBe(segment.text.indexOf("Its"));
    });
  });
});