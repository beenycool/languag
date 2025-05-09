import { FormatBase } from '../core/format-base';
import { FormatHandler } from '../core/format-types';

export class RtfHandler extends FormatBase implements FormatHandler {
  public readonly name: string;
  public readonly extensions: string[];
  public readonly mimeTypes: string[];

  constructor() {
    super('rtf', ['.rtf'], ['application/rtf', 'text/rtf']);
    this.name = 'rtf';
    this.extensions = ['.rtf'];
    this.mimeTypes = ['application/rtf', 'text/rtf'];
  }

  validate(content: unknown): boolean {
    return typeof content === 'string' && 
           content.startsWith('{\\rtf1') && 
           content.endsWith('}');
  }

  normalize(content: unknown): string {
    if (typeof content !== 'string' || !this.validate(content)) {
      throw new Error('Invalid RTF content');
    }
    return content;
  }

  getMetadata(content: unknown): Record<string, unknown> {
    if (typeof content !== 'string' || !this.validate(content)) {
      throw new Error('Invalid RTF content');
    }

    const titleMatch = content.match(/\\title\\f0\\fs\\b (.+?)\\b0\\f0\\fs/);
    const authorMatch = content.match(/\\author\\f0\\fs\\b (.+?)\\b0\\f0\\fs/);

    return {
      size: content.length,
      title: titleMatch?.[1] || '',
      author: authorMatch?.[1] || '',
      isRTF: true
    };
  }
}