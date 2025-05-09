import { ClipboardContent } from '../../types/clipboard-types';

export class FormatAnalyzer {
  private knownTextFormats = new Set([
    'text/plain',
    'text/html',
    'text/rtf',
    'text/css',
    'text/javascript',
    'application/json',
    'application/xml'
  ]);

  private knownImageFormats = new Set([
    'image/png',
    'image/jpeg',
    'image/gif',
    'image/webp',
    'image/svg+xml'
  ]);

  analyze(content: ClipboardContent): {
    primaryFormat: string;
    availableFormats: string[];
    isText: boolean;
    isImage: boolean;
    isRich: boolean;
  } {
    const availableFormats: string[] = [];
    if (content.text) availableFormats.push('text/plain');
    if (content.html) availableFormats.push('text/html');
    if (content.rtf) availableFormats.push('text/rtf');
    if (content.image) availableFormats.push('image/png');

    const primaryFormat = this.determinePrimaryFormat(availableFormats);
    const isText = this.knownTextFormats.has(primaryFormat);
    const isImage = this.knownImageFormats.has(primaryFormat);
    const isRich = primaryFormat !== 'text/plain' && isText;

    return {
      primaryFormat,
      availableFormats,
      isText,
      isImage,
      isRich
    };
  }

  private determinePrimaryFormat(formats: string[]): string {
    // Prefer richer formats over plain text
    if (formats.includes('text/html')) return 'text/html';
    if (formats.includes('text/rtf')) return 'text/rtf';
    if (formats.includes('image/png')) return 'image/png';
    return formats[0] || 'text/plain';
  }
}