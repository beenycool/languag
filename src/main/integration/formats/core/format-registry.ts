/**
 * @file Manages registration and lookup of file format handlers.
 */
// import { logger } from '../../../services/logger';

export interface FileFormatHandler {
  /** Unique identifier for the format (e.g., 'plaintext', 'markdown', 'docx'). */
  id: string;
  /** Common file extensions associated with this format (e.g., ['.txt'], ['.md', '.markdown']). */
  extensions: string[];
  /** MIME types associated with this format (e.g., ['text/plain'], ['text/markdown']). */
  mimeTypes: string[];
  /** Human-readable name for the format (e.g., 'Plain Text', 'Markdown'). */
  name: string;
  /** Optional description of the format. */
  description?: string;

  /**
   * Parses the raw file content into a structured representation.
   * @param rawContent The raw content (e.g., Buffer or string).
   * @param options Optional parsing parameters.
   * @returns A promise resolving to the structured content.
   */
  parse: (rawContent: Buffer | string, options?: Record<string, any>) => Promise<any>;

  /**
   * Serializes structured content back into raw file format.
   * @param structuredContent The structured content.
   * @param options Optional serialization parameters.
   * @returns A promise resolving to the raw content (Buffer or string).
   */
  serialize: (structuredContent: any, options?: Record<string, any>) => Promise<Buffer | string>;

  /**
   * Extracts metadata from the raw or structured content.
   * @param content Raw or structured content.
   * @param options Optional metadata extraction parameters.
   * @returns A promise resolving to a metadata object.
   */
  extractMetadata?: (content: Buffer | string | any, options?: Record<string, any>) => Promise<Record<string, any>>;

  /**
   * Validates if the content conforms to the format.
   * @param content Raw or structured content.
   * @returns A promise resolving to true if valid, false otherwise, or an error object/string.
   */
  validate?: (content: Buffer | string | any) => Promise<boolean | string | Error>;
}

export class FormatRegistry {
  private handlers: Map<string, FileFormatHandler> = new Map();
  private extensionMap: Map<string, string> = new Map(); // .txt -> plaintext
  private mimeTypeMap: Map<string, string> = new Map(); // text/plain -> plaintext

  constructor() {
    // logger.info('FormatRegistry initialized.');
    console.info('FormatRegistry initialized.');
  }

  /**
   * Registers a new file format handler.
   * @param handler The FileFormatHandler instance to register.
   */
  register(handler: FileFormatHandler): void {
    if (this.handlers.has(handler.id)) {
      // logger.warn(`Format handler with ID '${handler.id}' is already registered. Overwriting.`);
      console.warn(`Format handler with ID '${handler.id}' is already registered. Overwriting.`);
    }
    this.handlers.set(handler.id, handler);

    handler.extensions.forEach(ext => {
      const normalizedExt = ext.toLowerCase().startsWith('.') ? ext.toLowerCase() : `.${ext.toLowerCase()}`;
      if (this.extensionMap.has(normalizedExt) && this.extensionMap.get(normalizedExt) !== handler.id) {
        // logger.warn(`Extension '${normalizedExt}' is already mapped to handler '${this.extensionMap.get(normalizedExt)}'. Re-mapping to '${handler.id}'.`);
        console.warn(`Extension '${normalizedExt}' is already mapped to handler '${this.extensionMap.get(normalizedExt)}'. Re-mapping to '${handler.id}'.`);
      }
      this.extensionMap.set(normalizedExt, handler.id);
    });

    handler.mimeTypes.forEach(mime => {
      const normalizedMime = mime.toLowerCase();
      if (this.mimeTypeMap.has(normalizedMime) && this.mimeTypeMap.get(normalizedMime) !== handler.id) {
        // logger.warn(`MIME type '${normalizedMime}' is already mapped to handler '${this.mimeTypeMap.get(normalizedMime)}'. Re-mapping to '${handler.id}'.`);
        console.warn(`MIME type '${normalizedMime}' is already mapped to handler '${this.mimeTypeMap.get(normalizedMime)}'. Re-mapping to '${handler.id}'.`);
      }
      this.mimeTypeMap.set(normalizedMime, handler.id);
    });

    // logger.info(`Format handler '${handler.id}' (${handler.name}) registered.`);
    console.info(`Format handler '${handler.id}' (${handler.name}) registered.`);
  }

  /**
   * Unregisters a file format handler by its ID.
   * @param handlerId The ID of the handler to unregister.
   */
  unregister(handlerId: string): void {
    const handler = this.handlers.get(handlerId);
    if (handler) {
      this.handlers.delete(handlerId);
      handler.extensions.forEach(ext => {
        const normalizedExt = ext.toLowerCase().startsWith('.') ? ext.toLowerCase() : `.${ext.toLowerCase()}`;
        if (this.extensionMap.get(normalizedExt) === handlerId) {
          this.extensionMap.delete(normalizedExt);
        }
      });
      handler.mimeTypes.forEach(mime => {
        const normalizedMime = mime.toLowerCase();
        if (this.mimeTypeMap.get(normalizedMime) === handlerId) {
          this.mimeTypeMap.delete(normalizedMime);
        }
      });
      // logger.info(`Format handler '${handlerId}' unregistered.`);
      console.info(`Format handler '${handlerId}' unregistered.`);
    } else {
      // logger.warn(`Attempted to unregister non-existent format handler: '${handlerId}'.`);
      console.warn(`Attempted to unregister non-existent format handler: '${handlerId}'.`);
    }
  }

  /**
   * Retrieves a format handler by its ID.
   * @param id The unique ID of the format handler.
   * @returns The FileFormatHandler or undefined if not found.
   */
  getHandlerById(id: string): FileFormatHandler | undefined {
    return this.handlers.get(id);
  }

  /**
   * Retrieves a format handler based on a file extension.
   * @param extension The file extension (e.g., '.txt', 'md').
   * @returns The FileFormatHandler or undefined if no suitable handler is found.
   */
  getHandlerByExtension(extension: string): FileFormatHandler | undefined {
    const normalizedExt = extension.toLowerCase().startsWith('.') ? extension.toLowerCase() : `.${extension.toLowerCase()}`;
    const handlerId = this.extensionMap.get(normalizedExt);
    return handlerId ? this.handlers.get(handlerId) : undefined;
  }

  /**
   * Retrieves a format handler based on a MIME type.
   * @param mimeType The MIME type (e.g., 'text/plain', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document').
   * @returns The FileFormatHandler or undefined if no suitable handler is found.
   */
  getHandlerByMimeType(mimeType: string): FileFormatHandler | undefined {
    const normalizedMime = mimeType.toLowerCase().split(';')[0].trim(); // Ignore parameters like charset
    const handlerId = this.mimeTypeMap.get(normalizedMime);
    return handlerId ? this.handlers.get(handlerId) : undefined;
  }

  /**
   * Lists all registered format handlers.
   * @returns An array of all registered FileFormatHandler instances.
   */
  listAllHandlers(): FileFormatHandler[] {
    return Array.from(this.handlers.values());
  }

  /**
   * Clears all registered handlers. Useful for testing or reset.
   */
  clearAll(): void {
    this.handlers.clear();
    this.extensionMap.clear();
    this.mimeTypeMap.clear();
    // logger.info('All format handlers cleared from registry.');
    console.info('All format handlers cleared from registry.');
  }
}