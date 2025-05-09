// src/main/analysis/engines/shared/__tests__/rule-matcher.spec.ts

import { applyMatcherRules, MatcherRule, RegexRule } from '../rule-matcher';
import { IDocumentSegment, IDocumentContext } from '../../../context/document-context';
import { Finding } from '../../../types';

describe('RuleMatcher', () => {
  const createMockSegment = (text: string, startOffset: number = 0): IDocumentSegment => ({
    id: 'test-seg',
    text,
    range: { start: startOffset, end: startOffset + text.length },
  });

  const mockContext: IDocumentContext = { uri: 'test-doc', language: 'en' };

  // Example RegexRule
  const todoRule: RegexRule = {
    id: 'todo-comment',
    description: 'Flags TODO comments.',
    regex: /\/\/\s*TODO[:\s](.*)/gi, // Captures text after TODO
    message: (match) => `TODO found: "${match[1].trim()}"`,
    suggestion: (match) => `Address this TODO: ${match[1].trim()}`,
    severity: 'info',
  };

  // Example MatcherRule with an apply function
  const longWordRule: MatcherRule = {
    id: 'long-word',
    description: 'Flags words longer than 10 characters.',
    apply: (textOrSegment) => {
      const findings: Finding[] = [];
      const text = typeof textOrSegment === 'string' ? textOrSegment : textOrSegment.text;
      const words = text.split(/\s+/);
      words.forEach(word => {
        const cleanWord = word.replace(/[.,!?]/g, ''); // Basic cleaning
        if (cleanWord.length > 10) {
          const offset = text.indexOf(word); // Simple offset, might need improvement for segments
          const baseOffset = typeof textOrSegment === 'string' ? 0 : textOrSegment.range.start;
          findings.push({
            type: 'LongWord',
            message: `Word "${cleanWord}" is very long (${cleanWord.length} chars).`,
            severity: 'info',
            offset: baseOffset + offset,
            length: word.length, // Length of original word with punctuation
            suggestion: 'Consider using a shorter synonym or breaking it down.',
          });
        }
      });
      return findings;
    },
  };
  
  const conditionalRegexRule: RegexRule<{isStrict: boolean}> = {
    id: 'conditional-flag',
    description: 'Flags "DANGER" only if context.isStrict is true',
    regex: /DANGER/g,
    message: () => "Strict mode DANGER detected",
    severity: 'error',
    validateMatch: (match, text, context) => {
        return !!context?.isStrict;
    }
  };


  describe('applyMatcherRules', () => {
    it('should apply a RegexRule correctly to a string', () => {
      const text = "This is a test. // TODO: Fix this later.";
      const rules = [todoRule as unknown as MatcherRule]; // Cast for the generic applyMatcherRules
      const findings = applyMatcherRules(text, rules, mockContext);

      expect(findings).toHaveLength(1);
      expect(findings[0].type).toBe('todo-comment');
      expect(findings[0].message).toBe('TODO found: "Fix this later."');
      expect(findings[0].offset).toBe(text.indexOf('// TODO:'));
      expect(findings[0].length).toBe('// TODO: Fix this later.'.length);
      expect(findings[0].suggestion).toBe('Address this TODO: Fix this later.');
    });

    it('should apply a RegexRule correctly to an IDocumentSegment', () => {
      const text = "Segment with // TODO: Segment task.";
      const segment = createMockSegment(text, 100); // Segment starts at offset 100
      const rules = [todoRule as unknown as MatcherRule];
      const findings = applyMatcherRules(segment, rules, mockContext);

      expect(findings).toHaveLength(1);
      expect(findings[0].type).toBe('todo-comment');
      expect(findings[0].message).toBe('TODO found: "Segment task."');
      expect(findings[0].offset).toBe(100 + text.indexOf('// TODO:')); // Offset includes segment start
    });

    it('should apply a standard MatcherRule with apply function correctly', () => {
      const text = "This text contains an extraordinarilylongword.";
      const rules = [longWordRule];
      const findings = applyMatcherRules(text, rules, mockContext);

      expect(findings).toHaveLength(1);
      expect(findings[0].type).toBe('LongWord');
      expect(findings[0].message).toContain('extraordinarilylongword');
      expect(findings[0].offset).toBe(text.indexOf('extraordinarilylongword'));
    });

    it('should apply multiple rules and aggregate findings', () => {
      const text = "// TODO: A task. And supercalifragilisticexpialidocious is long.";
      const rules = [todoRule as unknown as MatcherRule, longWordRule];
      const findings = applyMatcherRules(text, rules, mockContext);

      expect(findings).toHaveLength(2);
      const todoFinding = findings.find(f => f.type === 'todo-comment');
      const longWordFinding = findings.find(f => f.type === 'LongWord');
      expect(todoFinding).toBeDefined();
      expect(longWordFinding).toBeDefined();
    });

    it('should handle RegexRule with no matches', () => {
      const text = "No tasks here.";
      const rules = [todoRule as unknown as MatcherRule];
      const findings = applyMatcherRules(text, rules, mockContext);
      expect(findings).toEqual([]);
    });

    it('should handle MatcherRule with no findings from apply', () => {
      const text = "Short words only.";
      const rules = [longWordRule];
      const findings = applyMatcherRules(text, rules, mockContext);
      expect(findings).toEqual([]);
    });

    it('should handle errors in a rule.apply function gracefully', () => {
      const errorRule: MatcherRule = {
        id: 'error-rule',
        description: 'This rule throws an error.',
        apply: () => { throw new Error('Test apply error'); },
      };
      const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
      const text = "Some text.";
      const findings = applyMatcherRules(text, [errorRule, longWordRule], mockContext);

      expect(consoleErrorSpy).toHaveBeenCalledWith('Error applying rule error-rule:', expect.any(Error));
      // Should still get findings from longWordRule if it matches
      const longWordFinding = findings.find(f => f.type === 'LongWord');
      expect(longWordFinding).toBeUndefined(); // "Some text." has no long words
      expect(findings.filter(f => f.type !== 'RuleExecutionError')).toEqual([]); // No other findings

      consoleErrorSpy.mockRestore();
    });
    
    it('should respect validateMatch for RegexRule', () => {
        const textWithDanger = "This is a DANGER zone. Another DANGER.";
        const rules = [conditionalRegexRule as unknown as MatcherRule<{isStrict: boolean}>];
        
        // Test 1: context.isStrict is false
        let findings = applyMatcherRules(textWithDanger, rules, { isStrict: false });
        expect(findings).toHaveLength(0);

        // Test 2: context.isStrict is true
        findings = applyMatcherRules(textWithDanger, rules, { isStrict: true });
        expect(findings).toHaveLength(2);
        expect(findings[0].message).toBe("Strict mode DANGER detected");
        expect(findings[1].message).toBe("Strict mode DANGER detected");
    });

    it('should handle regex without global flag correctly (iteratively)', () => {
        const nonGlobalRegexRule: RegexRule = {
            id: 'non-global-test',
            description: 'Test non-global regex',
            regex: /ITEM/i, // Non-global
            message: (match) => `Found ${match[0]}`,
            severity: 'info',
        };
        const text = "ITEM one, ITEM two";
        const rules = [nonGlobalRegexRule as unknown as MatcherRule];
        const findings = applyMatcherRules(text, rules);
        expect(findings).toHaveLength(2); // Should find both instances
        expect(findings[0].offset).toBe(text.indexOf("ITEM"));
        expect(findings[1].offset).toBe(text.lastIndexOf("ITEM"));
    });
  });
});