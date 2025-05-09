// src/main/analysis/engines/grammar/grammar-rules/genre-rules.ts

/**
 * @file Defines genre-specific grammar rules.
 * These rules depend on the detected or specified genre of the document.
 */

import { IDocumentSegment, IDocumentContext } from '../../../context/document-context';
import { Finding, ExtractedFeatures } from '../../../types'; // ExtractedFeatures might be useful for genre
import { GrammarRule } from './base-rules';
import appLogger from '../../../../services/logger'; // Import appLogger

// Example genre-specific grammar rules
export const GenreGrammarRules: GrammarRule[] = [
  {
    id: 'academic-passive-voice-check',
    description: 'Flags excessive passive voice in academic writing if genre is academic.',
    apply: (segment, documentContext) => {
      const findings: Finding[] = [];
      const genre = documentContext?.metadata?.genre || (documentContext as any)?.features?.genre; // Assuming genre might be in metadata or features

      if (genre === 'academic' || genre === 'scientific_paper') {
        // This is a very simplistic check for passive voice.
        // Real passive voice detection requires sophisticated NLP (e.g., POS tagging, dependency parsing).
        const passivePatterns = [
          /\b(is|are|was|were|be|been|being)\s+\w{1,50}ed\b/gi, // e.g., "is determined", "was found"
          /\b(is|are|was|were|be|been|being)\s+\w{1,50}en\b/gi, // e.g., "is given", "was taken"
        ];

        let passiveCount = 0;
        passivePatterns.forEach(pattern => {
          const matches = segment.text.match(pattern);
          if (matches) {
            passiveCount += matches.length;
            matches.forEach(matchText => {
                // Find the index of each match to provide accurate offset
                let lastIndex = -1;
                while((lastIndex = segment.text.indexOf(matchText, lastIndex + 1)) !== -1) {
                    // Check if this specific match has already been added to avoid duplicates from overlapping patterns
                    // This simple check might not be perfect for complex overlaps.
                    if (!findings.some(f => f.offset === lastIndex && f.length === matchText.length)) {
                        findings.push({
                            type: 'GrammarGenreViolation',
                            message: `Potential passive voice construction: "${matchText}". Consider active voice for clarity in academic writing.`,
                            severity: 'info',
                            offset: lastIndex,
                            length: matchText.length,
                            suggestion: 'Rewrite in active voice if appropriate for this context.',
                        });
                    }
                }
            });
          }
        });

        // Example: Flag if more than N passive constructions are found in a segment.
        // This threshold would need tuning.
        // For this example, we're adding findings for each instance rather than a summary.
      }
      return findings;
    },
  },
  {
    id: 'fiction-dialogue-punctuation',
    description: 'Checks for common dialogue punctuation conventions in fiction.',
    apply: (segment, documentContext) => {
      const findings: Finding[] = [];
      const genre = documentContext?.metadata?.genre;

      if (genre === 'fiction' || genre === 'novel' || genre === 'short_story') {
        // Example: Check if dialogue within quotes ends with punctuation before the closing quote.
        // e.g., "Hello," she said. (Correct) vs "Hello" she said. (Incorrect)
        // This requires identifying dialogue, which is complex.
        // Simplistic regex for demonstration:
        const dialogueRegex = /"[^"]{1,1000}"/g; // Finds text within double quotes, limited length
        let match;
        while ((match = dialogueRegex.exec(segment.text)) !== null) {
          const dialogueText = match[0];
          const innerText = dialogueText.substring(1, dialogueText.length - 1); // Text inside quotes
          if (innerText.length > 0) {
            const lastChar = innerText[innerText.length - 1];
            const punctuation = ['.', ',', '?', '!', ';', ':'];
            if (!punctuation.includes(lastChar)) {
              // Check if the character immediately after the quote is a lowercase letter (suggesting run-on)
              const charAfterQuote = segment.text[match.index + dialogueText.length];
              if (charAfterQuote && charAfterQuote.match(/[a-z]/)) {
                 findings.push({
                    type: 'GrammarGenreViolation',
                    message: `Dialogue "${innerText}" might be missing ending punctuation before the closing quote, or the following attribution is not capitalized.`,
                    severity: 'info',
                    offset: match.index + dialogueText.length - 1, // Point to the end of inner text
                    length: 1,
                    suggestion: 'Ensure dialogue ends with appropriate punctuation (e.g., comma, period) inside the quotes, or that attribution starts correctly.',
                 });
              }
            }
          }
        }
      }
      return findings;
    },
  },
  // Add more genre-specific rules
];

/**
 * Applies all genre-specific grammar rules to a segment.
 * @param segment The document segment to analyze.
 * @param documentContext The document context (which might contain genre information).
 * @param features Optional extracted features (which might also contain genre information).
 * @returns An array of findings.
 */
export function applyGenreGrammarRules(
  segment: IDocumentSegment,
  documentContext?: IDocumentContext,
  _features?: ExtractedFeatures // features might be used by some rules
): Finding[] {
  const genre = documentContext?.metadata?.genre || (documentContext as any)?.features?.genre;
  if (!genre && !documentContext?.metadata?.documentType) { // Some rules might infer genre from documentType
    // this.logger.debug('No genre information available, skipping genre-specific grammar rules.');
    return [];
  }

  let allFindings: Finding[] = [];
  GenreGrammarRules.forEach(rule => {
    try {
      const findings = rule.apply(segment, documentContext); // Pass features if rules are designed to use them
      allFindings = allFindings.concat(findings);
    } catch (error) {
      appLogger.error(`Error applying genre grammar rule ${rule.id}:`, {
        error,
        segmentId: segment.id,
        documentUri: documentContext?.uri
      });
    }
  });
  return allFindings;
}