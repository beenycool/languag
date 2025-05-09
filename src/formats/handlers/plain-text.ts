import { FormatBase } from '../core/format-base';
import { FormatHandler } from '../core/format-types';

export class PlainTextHandler extends FormatBase implements FormatHandler {
  public readonly name: string;
  public readonly extensions: string[];
  public readonly mimeTypes: string[];

  constructor() {
    super('plain-text', ['.txt', '.text'], ['text/plain']);
    this.name = 'plain-text';
    this.extensions = ['.txt', '.text'];
    this.mimeTypes = ['text/plain'];
  }

  validate(content: unknown): boolean {
    return typeof content === 'string';
  }

  normalize(content: unknown): string {
    if (typeof content !== 'string') {
      throw new Error('Invalid plain text content');
    }
    return content.trim();
  }

  getMetadata(content: unknown): Record<string, unknown> {
    if (typeof content !== 'string') {
      throw new Error('Invalid plain text content');
    }
    return {
      size: content.length,
      lineCount: content.split('\n').length,
      encoding: 'utf-8'
    };
  }
}