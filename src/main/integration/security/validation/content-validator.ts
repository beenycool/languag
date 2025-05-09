/**
 * @file Performs security validation on content.
 */
// import { logger } from '../../../services/logger';
import { SecurityManager } from '../../common/security-manager'; // To check permissions for validation actions
import { SecurityPrincipal, PermissionLevel } from '../../types/security-types';
import { FileFormatHandler, FormatRegistry } from '../../formats/core/format-registry';

export interface ContentValidationOptions {
  formatId?: string; // Hint for the content format
  principal?: SecurityPrincipal; // Principal attempting to use/process the content
  maxSizeMb?: number;
  allowedMimeTypes?: string[];
  // Add more specific validation rules, e.g., for script tags, active content, etc.
  disallowedPatterns?: RegExp[];
}

export interface ValidationResult {
  isValid: boolean;
  issues: string[];
}

const DEFAULT_VALIDATION_OPTIONS: Partial<ContentValidationOptions> = {
  maxSizeMb: 50, // Default max size 50MB
  disallowedPatterns: [
    // Very basic examples, real-world patterns would be more comprehensive
    /<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, // Script tags
    /on\w+="[^"]*"/gi, // Inline event handlers like onclick, onerror
  ],
};

export class ContentValidator {
  private securityManager?: SecurityManager;
  private formatRegistry?: FormatRegistry;

  constructor(securityManager?: SecurityManager, formatRegistry?: FormatRegistry) {
    this.securityManager = securityManager;
    this.formatRegistry = formatRegistry;
    // logger.info('ContentValidator initialized.');
    console.info('ContentValidator initialized.');
  }

  /**
   * Validates content against a set of security rules.
   * @param content The content to validate (Buffer or string).
   * @param options Validation options.
   * @returns A ValidationResult object.
   */
  async validate(
    content: Buffer | string,
    options: ContentValidationOptions
  ): Promise<ValidationResult> {
    const effectiveOptions = { ...DEFAULT_VALIDATION_OPTIONS, ...options };
    const issues: string[] = [];

    // Permission check: Does the principal have permission to request validation? (Meta, but could be relevant)
    if (effectiveOptions.principal && this.securityManager) {
      // Define a conceptual resource for "contentValidation"
      if (!this.securityManager.canAccess(effectiveOptions.principal, 'system://content-validation', PermissionLevel.READ)) {
        // logger.warn(`ContentValidator: Principal ${effectiveOptions.principal.id} lacks permission for validation action.`);
        console.warn(`ContentValidator: Principal ${effectiveOptions.principal.id} lacks permission for validation action.`);
        return { isValid: false, issues: ['Permission denied for validation action.'] };
      }
    }

    // Size check
    const contentLength = Buffer.isBuffer(content) ? content.byteLength : content.length;
    if (effectiveOptions.maxSizeMb && contentLength > effectiveOptions.maxSizeMb * 1024 * 1024) {
      issues.push(`Content size (${(contentLength / (1024*1024)).toFixed(2)}MB) exceeds maximum allowed size of ${effectiveOptions.maxSizeMb}MB.`);
    }

    // Format-specific validation using FileFormatHandler
    let handler: FileFormatHandler | undefined;
    if (effectiveOptions.formatId && this.formatRegistry) {
      handler = this.formatRegistry.getHandlerById(effectiveOptions.formatId);
      if (handler && handler.validate) {
        try {
          const handlerValidationResult = await handler.validate(content);
          if (handlerValidationResult !== true) {
            issues.push(typeof handlerValidationResult === 'string' ? handlerValidationResult : 'Format-specific validation failed.');
          }
        } catch (e: any) {
          // logger.warn(`ContentValidator: Error during format-specific validation by ${handler.id}: ${e.message}`);
          console.warn(`ContentValidator: Error during format-specific validation by ${handler.id}: ${e.message}`);
          issues.push(`Format-specific validation error: ${e.message}`);
        }
      } else if (handler && !handler.validate) {
        // logger.debug(`ContentValidator: Handler ${handler.id} does not implement a validate method.`);
        console.debug(`ContentValidator: Handler ${handler.id} does not implement a validate method.`);
      }
    }


    // Pattern checks (on string content)
    if (effectiveOptions.disallowedPatterns && effectiveOptions.disallowedPatterns.length > 0) {
      const stringContent = Buffer.isBuffer(content) ? content.toString('utf-8') : content; // Assuming UTF-8 for pattern matching
      for (const pattern of effectiveOptions.disallowedPatterns) {
        if (pattern.test(stringContent)) {
          issues.push(`Content matches disallowed pattern: ${pattern.source}`);
          // logger.warn(`ContentValidator: Content matched disallowed pattern: ${pattern.source}`);
          console.warn(`ContentValidator: Content matched disallowed pattern: ${pattern.source}`);
        }
      }
    }

    // MIME type check (if MIME type is provided via options or detected elsewhere)
    // This part is conceptual as MIME type isn't directly passed to this method.
    // It would typically be part of a broader file processing pipeline.
    // if (effectiveOptions.allowedMimeTypes && detectedMimeType) {
    //   if (!effectiveOptions.allowedMimeTypes.includes(detectedMimeType)) {
    //     issues.push(`Disallowed MIME type: ${detectedMimeType}.`);
    //   }
    // }

    const isValid = issues.length === 0;
    if (isValid) {
      // logger.info('ContentValidator: Content passed validation.');
      console.info('ContentValidator: Content passed validation.');
    } else {
      // logger.warn('ContentValidator: Content validation failed.', { issues });
      console.warn('ContentValidator: Content validation failed.', { issues });
    }

    return { isValid, issues };
  }

  // Add more specific validation methods as needed, e.g., for URLs, HTML snippets, etc.
  // async validateUrl(url: string): Promise<ValidationResult> { ... }
}