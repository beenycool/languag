/**
 * @file Handles extraction, storage, and querying of file metadata.
 */
import { FormatRegistry, FileFormatHandler } from './format-registry';
// import { logger } from '../../../services/logger';

export interface MetadataExtractionOptions {
  formatId?: string; // Explicitly provide format ID if known
  handlerOptions?: Record<string, any>; // Options for the specific handler's extractMetadata method
  // Add other options like 'depth' for structured metadata, etc.
}

export interface FileMetadata extends Record<string, any> {
  fileName?: string;
  filePath?: string;
  fileSize?: number; // in bytes
  mimeType?: string;
  formatId?: string; // Detected/specified format ID
  createdAt?: Date;
  modifiedAt?: Date;
  // Format-specific metadata will be added as dynamic properties
}

export class MetadataManager {
  private registry: FormatRegistry;

  constructor(registry: FormatRegistry) {
    this.registry = registry;
    // logger.info('MetadataManager initialized.');
    console.info('MetadataManager initialized.');
  }

  /**
   * Extracts metadata from raw file content.
   * It tries to use a specific handler if formatId is provided,
   * otherwise it might attempt to infer the format (not implemented here for simplicity).
   * @param rawContent The raw content of the file (Buffer or string).
   * @param options Options for metadata extraction, including optional formatId.
   * @param basicFileInfo Optional basic file info like name, path, size to enrich metadata.
   * @returns A promise resolving to the extracted FileMetadata.
   * @throws Error if the format handler is not found or metadata extraction fails.
   */
  async extract(
    rawContent: Buffer | string,
    options: MetadataExtractionOptions,
    basicFileInfo?: { fileName?: string; filePath?: string; fileSize?: number; mimeType?: string, modifiedAt?: Date, createdAt?: Date }
  ): Promise<FileMetadata> {
    const { formatId, handlerOptions } = options;
    let handler: FileFormatHandler | undefined;

    if (formatId) {
      handler = this.registry.getHandlerById(formatId);
      if (!handler) {
        // logger.warn(`Metadata extraction: Handler for formatId '${formatId}' not found.`);
        console.warn(`Metadata extraction: Handler for formatId '${formatId}' not found.`);
        // Fallback or throw error - for now, we'll proceed without a specific handler if it has no extractMetadata
      }
    } else if (basicFileInfo?.mimeType) {
        handler = this.registry.getHandlerByMimeType(basicFileInfo.mimeType);
        if (!handler) {
            // logger.debug(`Metadata extraction: No handler found for MIME type '${basicFileInfo.mimeType}'.`);
            console.debug(`Metadata extraction: No handler found for MIME type '${basicFileInfo.mimeType}'.`);
        }
    }
    // TODO: Add inference logic if formatId is not provided, e.g., using file extension or magic bytes.

    let extractedMeta: Record<string, any> = {};
    let usedFormatId = formatId;

    if (handler && handler.extractMetadata) {
      try {
        // logger.debug(`Using handler '${handler.id}' to extract metadata.`);
        console.debug(`Using handler '${handler.id}' to extract metadata.`);
        extractedMeta = await handler.extractMetadata(rawContent, handlerOptions);
        usedFormatId = handler.id; // Confirm the format ID used
        // logger.info(`Successfully extracted metadata using handler '${handler.id}'.`);
        console.info(`Successfully extracted metadata using handler '${handler.id}'.`);
      } catch (error: any) {
        // logger.error(`Metadata extraction failed with handler '${handler.id}':`, error);
        console.error(`Metadata extraction failed with handler '${handler.id}':`, error);
        // Decide if to throw or return basic info only
        // For now, we'll continue and return at least basic info
      }
    } else if (formatId && !handler?.extractMetadata) {
      // logger.warn(`Handler for format '${formatId}' found, but it does not implement extractMetadata.`);
      console.warn(`Handler for format '${formatId}' found, but it does not implement extractMetadata.`);
    } else if (!formatId) {
      // logger.debug('No specific formatId provided and no handler inferred for metadata extraction.');
      console.debug('No specific formatId provided and no handler inferred for metadata extraction.');
    }


    const finalMetadata: FileMetadata = {
      ...basicFileInfo, // Spread basic file info first
      formatId: usedFormatId || basicFileInfo?.mimeType, // Use detected/provided formatId or mimeType as fallback
      ...extractedMeta, // Spread extracted metadata, potentially overwriting generic fields if handler provides them
    };

    // Ensure fileSize is a number if provided
    if (basicFileInfo?.fileSize !== undefined) {
        finalMetadata.fileSize = Number(basicFileInfo.fileSize);
    }


    return finalMetadata;
  }

  /**
   * A more generic method to get metadata, potentially from a file path.
   * This would involve reading the file first.
   * For this example, it's a placeholder for a more complete implementation.
   *
   * @param filePath The path to the file.
   * @param options Options for metadata extraction.
   * @returns A promise resolving to the FileMetadata.
   */
  async getMetadataForFile(filePath: string, options: MetadataExtractionOptions): Promise<FileMetadata> {
    // In a real implementation:
    // 1. Read file content (e.g., using fs.readFile)
    // 2. Get basic file stats (fs.stat for size, modifiedAt, etc.)
    // 3. Call this.extract(fileContent, options, basicStats)
    // logger.warn(`getMetadataForFile is a placeholder. File reading for ${filePath} not implemented here.`);
    console.warn(`getMetadataForFile is a placeholder. File reading for ${filePath} not implemented here.`);
    // This is a mock response:
    return this.extract('', options, { filePath, fileName: filePath.split('/').pop() });
  }
}