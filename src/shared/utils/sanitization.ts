// Placeholder for sanitization utilities
// In a real application, use a robust library like DOMPurify for HTML or a similar library for other content types.

/**
 * Regular expression to identify characters that need to be escaped in text.
 * This includes: <, >, &, ", ', `, /
 */
const SANITIZE_REGEX_TEXT = /[<>&"'`/]/g;

/**
 * A map of characters to their corresponding HTML entity equivalents for sanitization.
 * Used to replace potentially harmful characters in text input and output.
 */
const SANITIZE_MAP_TEXT: Record<string, string> = {
  '<': '&lt;',
  '>': '&gt;',
  '&': '&amp;',
  '"': '&quot;',
  '\u0027': '&#x27;', // Single quote (apostrophe)
  '`': '&#x60;',  // Grave accent (backtick)
  '/': '&#x2F;'  // Forward slash
};

/**
 * Basic text sanitization by escaping potentially harmful characters.
 * This is a very basic example and might not be sufficient for all use cases.
 * @param input The string to sanitize.
 * @returns Sanitized string.
 */
export function sanitizeInput(input: string): string {
  if (typeof input !== 'string') return '';
  return input.replace(SANITIZE_REGEX_TEXT, (match) => SANITIZE_MAP_TEXT[match]);
}

/**
 * Basic output sanitization. For LLM outputs, this might involve
 * removing or escaping control characters, or ensuring the output
 * doesn't contain malicious scripts if it's ever rendered as HTML.
 * @param output The string to sanitize.
 * @returns Sanitized string.
 */
export function sanitizeOutput(output: string | undefined): string {
  if (typeof output !== 'string') return '';
  // For now, same as input sanitization. Could be more specific.
  return output.replace(SANITIZE_REGEX_TEXT, (match) => SANITIZE_MAP_TEXT[match]);
}

/**
 * Sanitizes error messages for production to avoid leaking sensitive details.
 * In development, it might pass through more information.
 * @param message The error message string.
 * @param context Optional context for the error.
 * @returns Sanitized error message.
 */
export function sanitizeError(message: string, context?: string): string {
  const baseMessage = 'An error occurred';
  const contextMessage = context ? ` during ${context}` : '';

  if (process.env.NODE_ENV === 'production') {
    // In production, return a generic message
    // Log the original error message internally if needed (done by the caller)
    return `${baseMessage}${contextMessage}. Please check logs for details.`;
  }
  // In development, return the original message (or a slightly more detailed one)
  return message || `${baseMessage}${contextMessage}.`;
}