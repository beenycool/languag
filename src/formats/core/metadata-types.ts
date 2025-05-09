export interface Metadata {
  [key: string]: unknown;
  size?: number;
  created?: Date | string;
  modified?: Date | string;
  author?: string;
  title?: string;
  description?: string;
}

export interface MetadataExtractor {
  extract(content: unknown): Metadata;
  validate(metadata: Metadata): boolean;
  normalize(metadata: Metadata): Metadata;
}

export interface MetadataSchema {
  fields: {
    [key: string]: {
      type: 'string' | 'number' | 'date' | 'boolean' | 'object';
      required?: boolean;
      sensitive?: boolean;
    };
  };
  version: string;
}