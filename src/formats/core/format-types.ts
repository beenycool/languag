export interface FormatHandler {
  name: string;
  extensions: string[];
  mimeTypes: string[];
  validate: (content: unknown) => boolean;
  normalize: (content: unknown) => unknown;
  getMetadata: (content: unknown) => Record<string, unknown>;
}

export type FormatType = 
  | 'text'
  | 'document'
  | 'workspace'
  | 'binary'
  | 'archive';

export interface FormatRegistration {
  type: FormatType;
  handler: FormatHandler;
  priority?: number;
}