// src/main/analysis/engines/grammar/grammar-rules/context-rules.ts

/**
 * @file Defines context-specific grammar rules.
 * These rules might depend on the broader document context, like language or metadata.
 */

import { IDocumentSegment, IDocumentContext } from '../../../context/document-context';
import { Finding } from '../../../types';
import { GrammarRule } from './base-rules'; // Assuming GrammarRule is exported from base-rules

// Example context-specific grammar rules
export const ContextGrammarRules: GrammarRule[] = [
  {
    id: 'formal-language-check',
    description: 'Checks for informal language if the document context suggests formality.',
    apply: (segment, documentContext) => {
      const findings: Finding[] = [];
      // Example: Check document metadata for a 'formality' setting or infer from document type
      const isFormalContext = documentContext?.metadata?.formality === 'formal' ||
                              documentContext?.metadata?.documentType === 'legal_document';

      if (isFormalContext) {
        const informalPatterns = [
          /\b(gonna|wanna|gotta)\b/gi,
          /\b(ain't|ain`t)\b/gi,
          /\b(lol|rofl|brb)\b/gi,
          // Add more patterns for informal language
        ];

        informalPatterns.forEach(pattern => {
          let match;
          while ((match = pattern.exec(segment.text)) !== null) {
            findings.push({
              type: 'GrammarContextViolation',
              message: `Informal term '${match[0]}' used in a formal context.`,
              severity: 'warning',
              offset: match.index,
              length: match[0].length,
              suggestion: `Consider replacing '${match[0]}' with a more formal equivalent.`,
            });
          }
        });
      }
      return findings;
    },
  },
  {
    id: 'language-specific-common-errors',
    description: 'Checks for common errors specific to the detected document language.',
    apply: (segment, documentContext) => {
      const findings: Finding[] = [];
      if (documentContext?.language === 'es') { // Example for Spanish
        // Check for common Spanish error: "de que" vs "de que" (dequeísmo/queísmo)
        // This is a complex topic and would require sophisticated NLP.
        // Placeholder for demonstration:
        if (segment.text.toLowerCase().includes('pienso de que')) {
           const matchIndex = segment.text.toLowerCase().indexOf('pienso de que');
            findings.push({
                type: 'GrammarContextViolation',
                message: "Possible 'dequeísmo' (e.g., 'pienso de que' instead of 'pienso que').",
                severity: 'info',
                offset: matchIndex,
                length: 'pienso de que'.length,
                suggestion: "Review for correct use of 'de que' vs 'que'.",
            });
        }
      }
      // Add checks for other languages
      return findings;
    },
  },
  // Add more context-specific rules here
];

/**
 * Applies all context-specific grammar rules to a segment.
 * @param segment The document segment to analyze.
 * @param documentContext The document context.
 * @returns An array of findings.
 */
export function applyContextGrammarRules(
  segment: IDocumentSegment,
  documentContext?: IDocumentContext
): Finding[] {
  if (!documentContext) {
    return []; // Context rules typically require document context
  }

  let allFindings: Finding[] = [];
  ContextGrammarRules.forEach(rule => {
    // Optionally, a rule could indicate if it's applicable based on context
    // before even calling apply, to save computation.
    try {
      const findings = rule.apply(segment, documentContext);
      allFindings = allFindings.concat(findings);
    } catch (error) {
      console.error(`Error applying context grammar rule ${rule.id}:`, error);
    }
  });
  return allFindings;
}