// src/main/analysis/engines/tone/cultural-checker.ts

/**
 * @file Module for checking cultural sensitivity.
 */

import { IDocumentSegment, IDocumentContext } from '../../context/document-context';
import { Finding } from '../../types';
import { LlmService } from '../../../services/llm-service';
import * as winston from 'winston';
import appLogger from '../../../services/logger';
import { sanitizePrompts, addInstructionFencing, sanitizeLlmOutput } from '../../../../shared/utils/llm-security';
import { sanitizeError } from '../../../../shared/utils/sanitization';

interface CulturalRule {
  id: string;
  description: string;
  patterns: RegExp[]; // Regex patterns to detect potentially problematic phrases
  message: (match: string) => string; // Function to generate a finding message
  suggestion: (match: string) => string; // Function to generate a suggestion
  severity: 'info' | 'warning' | 'error';
  targetAudiences?: string[]; // e.g., 'global', 'us-specific', 'non-native-speakers'
  // Add more properties like language specificity if needed
}

// Example rules - these are highly simplified and context-dependent.
// Real cultural sensitivity checking is extremely complex and nuanced.
const culturalRules: CulturalRule[] = [
  {
    id: 'gendered-language-guys',
    description: "Checks for gendered term 'you guys' when addressing a mixed audience.",
    patterns: [/\byou guys\b/gi],
    message: (match) => `'${match}' can be perceived as non-inclusive when addressing a mixed-gender audience.`,
    suggestion: (match) => `Consider using a more inclusive term like 'everyone', 'folks', 'team', or 'you all' instead of '${match}'.`,
    severity: 'warning',
    targetAudiences: ['global', 'diverse'],
  },
  {
    id: 'potentially-ableist-crazy',
    description: "Flags casual use of 'crazy' or 'insane' which can be ableist.",
    patterns: [/\b(crazy|insane)\b/gi],
    message: (match) => `Casual use of terms like '${match}' can be insensitive to individuals with mental health conditions.`,
    suggestion: (match) => `Consider alternatives like 'wild', 'unbelievable', 'intense', or 'surprising' depending on the context, instead of '${match}'.`,
    severity: 'info', // Severity can be debated; 'info' for awareness
  },
  // Add more rules for idioms, potentially offensive terms, regionalisms, etc.
  // This would require a substantial, well-curated database of rules.
];

export class CulturalChecker {
  private llmService?: LlmService;
  private logger: winston.Logger;

  constructor(llmService?: LlmService, logger?: winston.Logger) {
    this.llmService = llmService;
    this.logger = logger || appLogger.child({ module: 'CulturalChecker' });
    this.logger.info('CulturalChecker initialized.');
  }

  /**
   * Checks a text segment for potential cultural sensitivity issues.
   * This is a placeholder and would typically involve a large rule set or LLM interaction.
   * @param segment - The document segment to check.
   * @param documentContext - Optional context of the entire document, which might include target audience.
   * @returns A promise that resolves to an array of Findings.
   */
  public async check(
    segment: IDocumentSegment,
    documentContext?: IDocumentContext,
  ): Promise<Finding[]> {
    const findings: Finding[] = [];
    this.logger.debug(`Checking cultural sensitivity for segment: ${segment.id}`, { documentUri: documentContext?.uri });

    const targetAudience = documentContext?.metadata?.audience as string | undefined; // e.g., 'global', 'technical_us'

    culturalRules.forEach(rule => {
      // Check if rule is applicable to the target audience
      if (rule.targetAudiences && targetAudience && !rule.targetAudiences.some(aud => targetAudience.toLowerCase().includes(aud))) {
        // If rule has target audiences specified, and current doc audience doesn't match any, skip.
        // This logic might need refinement (e.g. if rule applies to ALL audiences unless specified otherwise)
        // For now, if targetAudiences is set, one must match.
        return;
      }

      rule.patterns.forEach(pattern => {
        let match;
        while ((match = pattern.exec(segment.text)) !== null) {
          findings.push({
            type: 'CulturalSensitivity',
            message: rule.message(match[0]),
            severity: rule.severity,
            offset: match.index,
            length: match[0].length,
            suggestion: rule.suggestion(match[0]),
            // ruleId: rule.id // Optional: include rule ID for reference
          });
        }
      });
    });

    // LLM-based check for more nuanced issues
    if (this.llmService) {
      const instructions = `Review the following text for any culturally insensitive, biased, or potentially offensive language, considering a ${targetAudience || 'general global'} audience. Provide specific issues and suggestions. If no issues, respond with "No specific cultural sensitivity issues found."`;
      const userData = segment.text;
      const fencedPrompt = addInstructionFencing(instructions, userData);
      this.logger.debug(`[CulturalChecker] LLM prompt (fenced, first 100): ${fencedPrompt.substring(0,100)}...`);

      try {
        // const rawLlmResponse = await this.llmService.process({ type: 'generate', input: fencedPrompt });
        // Simulate response for now
        const simulatedRawResponse = `Issue: The term 'blacklist' can have negative connotations. Suggestion: Consider using 'denylist' or 'blocklist'.`;
        const sanitizedLlmResponse = sanitizeLlmOutput(simulatedRawResponse);

        if (sanitizedLlmResponse && !sanitizedLlmResponse.toLowerCase().includes("no specific cultural sensitivity issues found")) {
          this.logger.debug(`[CulturalChecker] Sanitized LLM Response: ${sanitizedLlmResponse}`);
          // Placeholder for parsing LLM response into findings
          // This would require a more structured response from the LLM or sophisticated parsing.
          // For example, if LLM provides structured JSON or specific markers.
          // findings.push(...parseLLMCulturalResponse(sanitizedLlmResponse, segment));
          // For now, let's add a generic finding if LLM returns something actionable.
          findings.push({
            type: 'CulturalSensitivityLLM',
            message: `LLM identified potential cultural sensitivity: ${sanitizedLlmResponse.substring(0, 150)}${sanitizedLlmResponse.length > 150 ? '...' : ''}`,
            severity: 'info', // Or 'warning' depending on LLM's output/confidence
            offset: 0, // LLM finding might apply to whole segment or need more advanced offset mapping
            length: segment.text.length,
            suggestion: "Review LLM feedback for details."
          });
        } else if (sanitizedLlmResponse) {
            this.logger.info(`[CulturalChecker] LLM found no specific cultural sensitivity issues for segment ${segment.id}.`);
        } else {
            this.logger.warn(`[CulturalChecker] LLM response for segment ${segment.id} was empty after sanitization.`);
        }
      } catch (error) {
        const rawErrorMessage = error instanceof Error ? error.message : String(error);
        const sanitizedErrorMessage = sanitizeError(rawErrorMessage, 'LLM cultural sensitivity check');
        this.logger.error(`Error during LLM cultural sensitivity check for segment ${segment.id}: ${sanitizedErrorMessage}`, { originalError: rawErrorMessage, segmentId: segment.id });
      }
    }

    return findings;
  }

  // public async dispose(): Promise<void> {
  //   this.logger.info('CulturalChecker disposed.');
  // }
}