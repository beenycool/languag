// src/main/analysis/engines/grammar/grammar-rules/base-rules.ts

/**
 * @file Defines base grammar rules applicable across most contexts.
 */

import { IDocumentSegment, IDocumentContext } from '../../../context/document-context';
import { Finding } from '../../../types';

export interface GrammarRule {
  id: string; // Unique identifier for the rule
  description: string; // Description of the grammar rule
  apply: (segment: IDocumentSegment, documentContext?: IDocumentContext) => Finding[]; // Function to apply the rule
}

// Example base grammar rules
export const BaseGrammarRules: GrammarRule[] = [
  {
    id: 'double-negative',
    description: 'Detects potential double negatives.',
    apply: (segment) => {
      const findings: Finding[] = [];
      const text = segment.text.toLowerCase();
      // This is a very simplistic check, real implementation would need more robust NLP
      if (text.includes("can't not") || text.includes("cannot hardly")) {
        const match = text.match(/can't not|cannot hardly/);
        if (match && typeof match.index === 'number') {
            findings.push({
                type: 'GrammarRuleViolation',
                message: 'Potential double negative detected.',
                severity: 'warning',
                offset: match.index,
                length: match[0].length,
                suggestion: 'Review for unintended double negative meaning.',
            });
        }
      }
      return findings;
    },
  },
  {
    id: 'common-misspelling-its-it\'s',
    description: "Checks for common misuse of 'its' vs 'it's'.",
    apply: (segment) => {
      const findings: Finding[] = [];
      const text = segment.text;
      const regex = /\b(it's|its)\b/gi;
      let match;
      while ((match = regex.exec(text)) !== null) {
        const word = match[0];
        // Simplified check: "it's" should generally be followed by certain verb forms or adjectives.
        // "its" should generally be followed by a noun. This is highly context-dependent.
        // A more robust check would involve Part-of-Speech (POS) tagging.
        if (word.toLowerCase() === "it's") {
          // Example: "it's a beautiful day" (correct) vs "it's beauty" (likely incorrect)
          // This placeholder doesn't implement full POS logic.
        } else if (word.toLowerCase() === "its") {
          // Example: "its color is red" (correct) vs "its is red" (incorrect)
        }
        // For this example, we'll just flag all occurrences for review.
        // In a real system, this would be much more nuanced.
        findings.push({
          type: 'GrammarRuleViolation',
          message: `Review usage of '${word}'. Ensure 'it\\'s' (it is/has) and 'its' (possessive) are used correctly.`,
          severity: 'info',
          offset: match.index,
          length: word.length,
          suggestion: `Verify if '${word}' is used correctly in this context.`,
        });
      }
      return findings;
    },
  },
  // Add more base rules here
];

/**
 * Applies all base grammar rules to a segment.
 * @param segment The document segment to analyze.
 * @param documentContext Optional document context.
 * @returns An array of findings.
 */
export function applyBaseGrammarRules(
  segment: IDocumentSegment,
  documentContext?: IDocumentContext
): Finding[] {
  let allFindings: Finding[] = [];
  BaseGrammarRules.forEach(rule => {
    try {
      const findings = rule.apply(segment, documentContext);
      allFindings = allFindings.concat(findings);
    } catch (error) {
      console.error(`Error applying base grammar rule ${rule.id}:`, error);
      // Optionally create a finding for the error itself
    }
  });
  return allFindings;
}