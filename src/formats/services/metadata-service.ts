import { Metadata, MetadataExtractor } from '../core/metadata-types';

export class MetadataService {
  private readonly extractors: Map<string, MetadataExtractor> = new Map();

  register(format: string, extractor: MetadataExtractor): void {
    if (this.extractors.has(format)) {
      throw new Error(`Metadata extractor for ${format} is already registered`);
    }
    this.extractors.set(format, extractor);
  }

  getExtractor(format: string): MetadataExtractor | undefined {
    return this.extractors.get(format);
  }

  extract(format: string, content: unknown): Metadata {
    const extractor = this.getExtractor(format);
    if (!extractor) {
      throw new Error(`No metadata extractor registered for ${format}`);
    }
    return extractor.extract(content);
  }

  validate(format: string, metadata: Metadata): boolean {
    const extractor = this.getExtractor(format);
    if (!extractor) {
      throw new Error(`No metadata extractor registered for ${format}`);
    }
    return extractor.validate(metadata);
  }

  normalize(format: string, metadata: Metadata): Metadata {
    const extractor = this.getExtractor(format);
    if (!extractor) {
      throw new Error(`No metadata extractor registered for ${format}`);
    }
    return extractor.normalize(metadata);
  }
}