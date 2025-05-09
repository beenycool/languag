import { ClipboardContent } from '../../types/clipboard-types';

export class FormatFilter {
  private allowedFormats: Set<string> = new Set([
    'text/plain',
    'text/html',
    'text/rtf',
    'image/png'
  ]);

  filter(content: ClipboardContent): boolean {
    if (content.text && !this.allowedFormats.has('text/plain')) return false;
    if (content.html && !this.allowedFormats.has('text/html')) return false;
    if (content.rtf && !this.allowedFormats.has('text/rtf')) return false;
    if (content.image && !this.allowedFormats.has('image/png')) return false;
    return true;
  }

  allowFormat(format: string): void {
    this.allowedFormats.add(format);
  }

  blockFormat(format: string): void {
    this.allowedFormats.delete(format);
  }

  setAllowedFormats(formats: string[]): void {
    this.allowedFormats = new Set(formats);
  }
}