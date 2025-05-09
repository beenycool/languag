import { FormatBase } from '../core/format-base';
import { FormatHandler } from '../core/format-types';

export class DocxHandler extends FormatBase implements FormatHandler {
  public readonly name: string;
  public readonly extensions: string[];
  public readonly mimeTypes: string[];

  constructor() {
    super('docx', ['.docx'], [
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
    ]);
    this.name = 'docx';
    this.extensions = ['.docx'];
    this.mimeTypes = [
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
    ];
  }

  validate(content: unknown): boolean {
    return content instanceof Uint8Array && 
           this.isDocxFile(content);
  }

  normalize(content: unknown): Uint8Array {
    if (!this.validate(content)) {
      throw new Error('Invalid DOCX content');
    }
    return content as Uint8Array;
  }

  getMetadata(content: unknown): Record<string, unknown> {
    if (!this.validate(content)) {
      throw new Error('Invalid DOCX content');
    }
    return {
      size: (content as Uint8Array).length,
      type: 'docx'
    };
  }

  private isDocxFile(content: Uint8Array): boolean {
    // Check for DOCX magic number (PK header)
    return content.length > 4 &&
           content[0] === 0x50 && // P
           content[1] === 0x4B && // K
           content[2] === 0x03 &&
           content[3] === 0x04;
  }
}