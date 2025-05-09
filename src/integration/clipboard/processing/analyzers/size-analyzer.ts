import { ClipboardContent } from '../../types/clipboard-types';

export class SizeAnalyzer {
  private maxTextSize = 1024 * 1024; // 1MB
  private maxImageSize = 10 * 1024 * 1024; // 10MB

  analyze(content: ClipboardContent): {
    size: number;
    isOversized: boolean;
    sizeLimit: number;
  } {
    let size = 0;

    if (content.text) size += Buffer.byteLength(content.text, 'utf8');
    if (content.html) size += Buffer.byteLength(content.html, 'utf8');
    if (content.rtf) size += Buffer.byteLength(content.rtf, 'utf8');
    if (content.image) size += content.image.byteLength;

    const isText = content.text && !content.image;
    const sizeLimit = isText ? this.maxTextSize : this.maxImageSize;
    const isOversized = size > sizeLimit;

    return {
      size,
      isOversized,
      sizeLimit
    };
  }

  setMaxTextSize(size: number): void {
    this.maxTextSize = size;
  }

  setMaxImageSize(size: number): void {
    this.maxImageSize = size;
  }
}