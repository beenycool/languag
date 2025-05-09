import { FormatBase } from '../core/format-base';
import { FormatHandler } from '../core/format-types';

export class PdfHandler extends FormatBase implements FormatHandler {
  public readonly name: string;
  public readonly extensions: string[];
  public readonly mimeTypes: string[];

  constructor() {
    super('pdf', ['.pdf'], ['application/pdf']);
    this.name = 'pdf';
    this.extensions = ['.pdf'];
    this.mimeTypes = ['application/pdf'];
  }

  validate(content: unknown): boolean {
    return content instanceof Uint8Array && 
           this.isPdfFile(content);
  }

  normalize(content: unknown): Uint8Array {
    if (!this.validate(content)) {
      throw new Error('Invalid PDF content');
    }
    return content as Uint8Array;
  }

  getMetadata(content: unknown): Record<string, unknown> {
    if (!this.validate(content)) {
      throw new Error('Invalid PDF content');
    }
    return {
      size: (content as Uint8Array).length,
      type: 'pdf'
    };
  }

  private isPdfFile(content: Uint8Array): boolean {
    // Check for PDF magic number (%PDF)
    return content.length > 4 &&
           content[0] === 0x25 && // %
           content[1] === 0x50 && // P
           content[2] === 0x44 && // D
           content[3] === 0x46;   // F
  }
}