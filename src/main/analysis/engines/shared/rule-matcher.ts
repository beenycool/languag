// src/main/analysis/engines/shared/rule-matcher.ts

/**
 * @file Provides flexible rule matching capabilities.
 */

import { Finding } from '../../types';
import { IDocumentSegment, IDocumentContext } from '../../context/document-context'; // For context-aware rules

/**
 * Defines a generic rule structure for the RuleMatcher.
 * A rule can operate on raw text or a document segment, and optionally use context.
 */
export interface MatcherRule<TContext = IDocumentContext | undefined> {
  id: string; // Unique identifier for the rule
  description: string; // Description of what the rule does
  /**
   * Applies the rule to the given text or segment.
   * @param textOrSegment The content to analyze (string or IDocumentSegment).
   * @param context Optional context (e.g., IDocumentContext or custom context).
   * @returns An array of findings if the rule is violated.
   */
  apply: (textOrSegment: string | IDocumentSegment, context?: TContext) => Finding[];
}

/**
 * A specific type of rule based on regular expressions.
 */
export interface RegexRule<TContext = IDocumentContext | undefined> extends Omit<MatcherRule<TContext>, 'apply'> {
  regex: RegExp; // The regular expression to match
  message: (match: RegExpExecArray, context?: TContext) => string; // Generates the finding message
  suggestion?: (match: RegExpExecArray, context?: TContext) => string; // Generates a suggestion
  severity: Finding['severity'];
  /**
   * Optional function to further validate or refine a regex match.
   * If it returns false, the match is ignored.
   * @param match The RegExpExecArray result.
   * @param text The full text being analyzed.
   * @param context Optional context.
   * @returns True if the match is valid, false otherwise.
   */
  validateMatch?: (match: RegExpExecArray, text: string, context?: TContext) => boolean;
}

/**
 * Applies a set of MatcherRules to a given text or document segment.
 * @param content The text string or IDocumentSegment to analyze.
 * @param rules An array of MatcherRules to apply.
 * @param context Optional context to pass to the rules.
 * @returns An aggregated array of findings from all applied rules.
 */
export function applyMatcherRules<TContext = IDocumentContext | undefined>(
  content: string | IDocumentSegment,
  rules: MatcherRule<TContext>[],
  context?: TContext,
): Finding[] {
  let allFindings: Finding[] = [];
  const text = typeof content === 'string' ? content : content.text;

  rules.forEach(rule => {
    try {
      let ruleFindings: Finding[];
      // Check if it's a RegexRule and needs special handling
      if ('regex' in rule) {
        const regexRule = rule as unknown as RegexRule<TContext>; // Cast to access regex properties
        ruleFindings = [];
        let match;
        // Ensure the regex has the global flag for iterative matching, or reset lastIndex if not.
        const effectiveRegex = new RegExp(regexRule.regex, regexRule.regex.flags.includes('g') ? regexRule.regex.flags : regexRule.regex.flags + 'g');
        
        while ((match = effectiveRegex.exec(text)) !== null) {
          if (regexRule.validateMatch && !regexRule.validateMatch(match, text, context)) {
            continue; // Skip this match if validation fails
          }
          const findingOffset = typeof content === 'string' ? match.index : (content.range.start + match.index);
          ruleFindings.push({
            type: rule.id, // Or a more generic 'RuleViolation' type
            message: regexRule.message(match, context),
            severity: regexRule.severity,
            offset: findingOffset,
            length: match[0].length,
            suggestion: regexRule.suggestion ? regexRule.suggestion(match, context) : undefined,
          });
        }
      } else {
        // Standard MatcherRule with an apply function
        ruleFindings = rule.apply(content, context);
      }
      allFindings = allFindings.concat(ruleFindings);
    } catch (error) {
      console.error(`Error applying rule ${rule.id}:`, error);
      // Optionally, create a finding for the error itself
      // allFindings.push({
      //   type: 'RuleExecutionError',
      //   message: `Error executing rule '${rule.id}': ${error instanceof Error ? error.message : String(error)}`,
      //   severity: 'error',
      //   offset: 0,
      //   length: 0,
      // });
    }
  });
  return allFindings;
}

// Example Usage (can be removed or moved to tests):

// const exampleRegexRule: RegexRule = {
//   id: 'no-todo-comments',
//   description: 'Flags TODO comments.',
//   regex: /\/\/\s*TODO[:\s]/gi,
//   message: (match) => `Found a TODO comment: "${match[0]}"`,
//   suggestion: (match) => `Address the TODO: ${match.input.substring(match.index + match[0].length).split('\n')[0].trim() || 'No details provided.'}`,
//   severity: 'info',
// };

// const exampleApplyRule: MatcherRule = {
//   id: 'long-paragraph-check',
//   description: 'Checks if a paragraph (segment) is too long.',
//   apply: (textOrSegment, context) => {
//     const findings: Finding[] = [];
//     const text = typeof textOrSegment === 'string' ? textOrSegment : (textOrSegment as IDocumentSegment).text;
//     if (text.length > 500) { // Arbitrary length
//       findings.push({
//         type: 'ReadabilityHint',
//         message: 'This paragraph might be too long, consider breaking it up.',
//         severity: 'info',
//         offset: typeof textOrSegment === 'string' ? 0 : (textOrSegment as IDocumentSegment).range.start,
//         length: text.length,
//       });
//     }
//     return findings;
//   }
// };

// const textToAnalyze = "This is some text. // TODO: Fix this later.\nAnother line.";
// const segmentToAnalyze: IDocumentSegment = { id: 's1', text: textToAnalyze, range: {start: 0, end: textToAnalyze.length}};

// const allRules = [exampleRegexRule as unknown as MatcherRule, exampleApplyRule];
// const results = applyMatcherRules(segmentToAnalyze, allRules);
// console.log(results);