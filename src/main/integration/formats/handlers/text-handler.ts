/**
 * @file File format handler for plain text files.
 */
import { FileFormatHandler } from '../core/format-registry';
// import { logger } from '../../../services/logger';

export class TextHandler implements FileFormatHandler {
  id = 'plaintext';
  name = 'Plain Text';
  extensions = ['.txt', '.text'];
  mimeTypes = ['text/plain'];
  description = 'Handler for unformatted plain text files.';

  async parse(rawContent: Buffer | string, options?: Record<string, any>): Promise<string> {
    // logger.debug(`TextHandler: Parsing content (options: ${JSON.stringify(options)})`);
    console.debug(`TextHandler: Parsing content (options: ${JSON.stringify(options)})`);
    if (Buffer.isBuffer(rawContent)) {
      // Assuming UTF-8 encoding for plain text. Options could specify other encodings.
      const encoding = options?.encoding || 'utf-8';
      try {
        return rawContent.toString(encoding as BufferEncoding);
      } catch (error) {
        // logger.error(`TextHandler: Error decoding buffer with encoding ${encoding}. Falling back to UTF-8.`, error);
        console.error(`TextHandler: Error decoding buffer with encoding ${encoding}. Falling back to UTF-8.`, error);
        return rawContent.toString('utf-8'); // Fallback
      }
    }
    return rawContent as string;
  }

  async serialize(structuredContent: string, options?: Record<string, any>): Promise<string> {
    // logger.debug(`TextHandler: Serializing content (options: ${JSON.stringify(options)})`);
    console.debug(`TextHandler: Serializing content (options: ${JSON.stringify(options)})`);
    if (typeof structuredContent !== 'string') {
      // logger.warn('TextHandler: serialize expects a string. Attempting to convert.');
      console.warn('TextHandler: serialize expects a string. Attempting to convert.');
      return String(structuredContent);
    }
    // For plain text, serialization is straightforward.
    // Options could be used for things like line endings if needed.
    return structuredContent;
  }

  async extractMetadata(
    content: Buffer | string,
    options?: Record<string, any>
  ): Promise<Record<string, any>> {
    // logger.debug(`TextHandler: Extracting metadata (options: ${JSON.stringify(options)})`);
    console.debug(`TextHandler: Extracting metadata (options: ${JSON.stringify(options)})`);
    const textContent = Buffer.isBuffer(content) ? content.toString('utf-8') : content;
    const metadata: Record<string, any> = {
      lineCount: textContent.split(/\r\n|\r|\n/).length,
      wordCount: textContent.split(/\s+/).filter(Boolean).length,
      characterCount: textContent.length,
      // Could add encoding detection here if more sophisticated
    };
    // logger.info('TextHandler: Metadata extracted:', metadata);
    console.info('TextHandler: Metadata extracted:', metadata);
    return metadata;
  }

  async validate(content: Buffer | string | any): Promise<boolean> {
    // logger.debug('TextHandler: Validating content.');
    console.debug('TextHandler: Validating content.');
    // For plain text, most string content is valid.
    // We might check for excessive non-printable characters if strict validation is needed.
    if (typeof content === 'string' || Buffer.isBuffer(content)) {
      // logger.info('TextHandler: Content is valid (string or buffer).');
      console.info('TextHandler: Content is valid (string or buffer).');
      return true;
    }
    // logger.warn('TextHandler: Content is not a string or buffer, considered invalid.');
    console.warn('TextHandler: Content is not a string or buffer, considered invalid.');
    return false;
  }
}

// Example of how it might be registered (in a central place)
// import { formatRegistry } from './some-registry-instance';
// formatRegistry.register(new TextHandler());