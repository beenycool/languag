import { FormatBase } from '../core/format-base';
import { FormatHandler } from '../core/format-types';

export class MarkdownHandler extends FormatBase implements FormatHandler {
  public readonly name: string;
  public readonly extensions: string[];
  public readonly mimeTypes: string[];

  constructor() {
    super('markdown', ['.md', '.markdown'], ['text/markdown']);
    this.name = 'markdown';
    this.extensions = ['.md', '.markdown'];
    this.mimeTypes = ['text/markdown'];
  }

  validate(content: unknown): boolean {
    return typeof content === 'string';
  }

  normalize(content: unknown): string {
    if (typeof content !== 'string') {
      throw new Error('Invalid markdown content');
    }
    return content.trim();
  }

  getMetadata(content: unknown): Record<string, unknown> {
    if (typeof content !== 'string') {
      throw new Error('Invalid markdown content');
    }
    
    const lines = content.split('\n');
    const headers = lines.filter(line => line.startsWith('#'));
    const firstHeader = headers[0]?.replace(/^#+\s*/, '') || '';

    return {
      size: content.length,
      lineCount: lines.length,
      headerCount: headers.length,
      title: firstHeader,
      encoding: 'utf-8'
    };
  }
}