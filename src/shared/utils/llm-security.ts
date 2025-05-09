// src/shared/utils/llm-security.ts

/**
 * @file LLM-specific security utilities.
 * Includes functions for prompt sanitization, instruction fencing, and output sanitization.
 */

import { sanitizeInput, sanitizeOutput } from './sanitization';

/**
 * Maximum length for a prompt to prevent overly long inputs to the LLM.
 */
const MAX_PROMPT_LENGTH = 8000; // Example: 8000 characters, adjust as needed

/**
 * Sanitizes prompts before sending them to an LLM.
 * This can include removing potentially harmful characters or patterns,
 * and truncating to a maximum length.
 *
 * @param prompt The raw prompt string.
 * @returns A sanitized and potentially truncated prompt string.
 */
export function sanitizePrompts(prompt: string): string {
  if (typeof prompt !== 'string') return '';

  // Basic sanitization (similar to sanitizeInput but could be more LLM-specific)
  let sanitizedPrompt = prompt.replace(/[<>&"'`]/g, (match) => {
    const replacements: Record<string, string> = {
      '<': '<',
      '>': '>',
      '&': '&',
      '"': '"',
      "'": '&#x27;',
      '`': '&#x60;',
    };
    return replacements[match] || '';
  });

  // Remove or escape sequences that might be interpreted as control characters by the LLM
  // This is highly dependent on the specific LLM being used.
  // Example: replacing triple backticks if they are not intended for code blocks
  // sanitizedPrompt = sanitizedPrompt.replace(/```/g, '\\`\\`\\`');

  // Truncate prompt if it exceeds the maximum allowed length
  if (sanitizedPrompt.length > MAX_PROMPT_LENGTH) {
    sanitizedPrompt = sanitizedPrompt.substring(0, MAX_PROMPT_LENGTH);
    // Optionally, add an indicator that the prompt was truncated
    // sanitizedPrompt += "... [PROMPT TRUNCATED]";
    console.warn(`Prompt truncated to ${MAX_PROMPT_LENGTH} characters.`);
  }

  return sanitizedPrompt;
}

/**
 * Adds instruction fencing to a prompt.
 * This helps the LLM distinguish between instructions and user-provided data,
 * reducing the risk of prompt injection.
 *
 * Common fencing techniques include using XML-like tags or specific delimiters.
 * Example: "<instructions>Review this text:</instructions><user_data>{text_to_review}</user_data>"
 *
 * @param instructions The instructions for the LLM.
 * @param userData The user-provided data to be processed by the LLM.
 * @returns A combined prompt string with instruction fencing.
 */
export function addInstructionFencing(instructions: string, userData: string): string {
  // Sanitize both parts individually first
  const saneInstructions = sanitizePrompts(instructions); // Use sanitizePrompts for consistency
  const saneUserData = sanitizePrompts(userData);     // Or a more specific user data sanitizer

  // Example using simple XML-like tags. Choose a robust method.
  // Ensure these tags are unlikely to appear naturally in user data or instructions,
  // or that they are escaped if they do.
  return `<system_instructions>\n${saneInstructions}\n</system_instructions>\n<user_data>\n${saneUserData}\n</user_data>`;
}

/**
 * Sanitizes output received from an LLM.
 * This is crucial to prevent injection of malicious content (e.g., XSS)
 * if the LLM output is ever rendered or used in sensitive contexts.
 * It also involves checking for and potentially removing any "refusal" markers
 * or boilerplate text the LLM might add if it couldn't fulfill the prompt.
 *
 * @param llmOutput The raw output string from the LLM.
 * @returns A sanitized output string.
 */
export function sanitizeLlmOutput(llmOutput: string | undefined): string {
  if (typeof llmOutput !== 'string') return '';

  // Use the general-purpose output sanitizer as a base
  // This will handle common HTML entities.
  let sanitized = sanitizeOutput(llmOutput);

  // LLM-specific output cleaning:
  // 1. Remove common refusal phrases (customize based on your LLM)
  const refusalPatterns = [
    /As an AI language model, I cannot [^\n]*/gi,
    /I am unable to [^\n]*/gi,
    /I'm sorry, but I cannot [^\n]*/gi,
    // Add more patterns as observed from your LLM's behavior
  ];
  refusalPatterns.forEach(pattern => {
    sanitized = sanitized.replace(pattern, '').trim();
  });

  // 2. Trim extraneous whitespace that LLMs sometimes produce
  sanitized = sanitized.replace(/\s\s+/g, ' ').trim();

  // 3. Potentially, strip or neutralize any remaining tags if the output is
  //    expected to be plain text but might contain LLM-generated markdown/HTML.
  //    This is a more aggressive step and depends on the use case.
  //    Example (very basic, consider a library for robustness):
  //    sanitized = sanitized.replace(/<[^>]+>/g, '');

  return sanitized;
}