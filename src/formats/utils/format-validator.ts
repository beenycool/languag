import { FormatHandler } from '../core/format-types';

export class FormatValidator {
  static validateContent(
    handler: FormatHandler,
    content: unknown
  ): boolean {
    try {
      return handler.validate(content);
    } catch {
      return false;
    }
  }

  static validateExtension(
    handler: FormatHandler,
    extension: string
  ): boolean {
    return handler.extensions.includes(extension.toLowerCase());
  }

  static validateMimeType(
    handler: FormatHandler,
    mimeType: string
  ): boolean {
    return handler.mimeTypes.includes(mimeType.toLowerCase());
  }

  static validateAll(
    handler: FormatHandler,
    content: unknown,
    extension?: string,
    mimeType?: string
  ): boolean {
    const contentValid = this.validateContent(handler, content);
    const extensionValid = extension ? this.validateExtension(handler, extension) : true;
    const mimeTypeValid = mimeType ? this.validateMimeType(handler, mimeType) : true;
    
    return contentValid && extensionValid && mimeTypeValid;
  }
}