export abstract class FormatBase {
  protected readonly name: string;
  protected readonly extensions: string[];
  protected readonly mimeTypes: string[];

  constructor(name: string, extensions: string[], mimeTypes: string[]) {
    this.name = name;
    this.extensions = extensions;
    this.mimeTypes = mimeTypes;
  }

  abstract validate(content: unknown): boolean;
  abstract normalize(content: unknown): unknown;
  abstract getMetadata(content: unknown): Record<string, unknown>;
}