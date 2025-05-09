import { FormatRegistry } from './format-registry';

export class FormatDetector {
  constructor(private readonly formatRegistry: FormatRegistry) {}

  detectByContent(content: unknown): string | undefined {
    if (typeof content === 'string') {
      // Check for text-based formats
      if (content.startsWith('{\\rtf1')) return 'rtf';
      if (content.match(/<([A-Za-z][A-Za-z0-9]*)\b[^>]*>/)) return 'html';
      if (content.match(/^#+\s/)) return 'markdown';
      return 'plain-text';
    } else if (content instanceof Uint8Array) {
      // Check for binary formats
      if (this.isPdf(content)) return 'pdf';
      if (this.isDocx(content)) return 'docx';
    }
    return undefined;
  }

  private isPdf(content: Uint8Array): boolean {
    return content.length > 4 &&
           content[0] === 0x25 && // %
           content[1] === 0x50 && // P
           content[2] === 0x44 && // D
           content[3] === 0x46;   // F
  }

  private isDocx(content: Uint8Array): boolean {
    return content.length > 4 &&
           content[0] === 0x50 && // P
           content[1] === 0x4B && // K
           content[2] === 0x03 &&
           content[3] === 0x04;
  }
}