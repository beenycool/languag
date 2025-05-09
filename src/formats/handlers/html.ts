import { FormatBase } from '../core/format-base';
import { FormatHandler } from '../core/format-types';

export class HtmlHandler extends FormatBase implements FormatHandler {
  public readonly name: string;
  public readonly extensions: string[];
  public readonly mimeTypes: string[];

  constructor() {
    super('html', ['.html', '.htm'], ['text/html']);
    this.name = 'html';
    this.extensions = ['.html', '.htm'];
    this.mimeTypes = ['text/html'];
  }

  validate(content: unknown): boolean {
    if (typeof content !== 'string') return false;
    
    // Basic HTML validation
    const htmlRegex = /<([A-Za-z][A-Za-z0-9]*)\b[^>]*>(.*?)<\/\1>/;
    return htmlRegex.test(content);
  }

  normalize(content: unknown): string {
    if (typeof content !== 'string' || !this.validate(content)) {
      throw new Error('Invalid HTML content');
    }
    return content.trim();
  }

  getMetadata(content: unknown): Record<string, unknown> {
    if (typeof content !== 'string' || !this.validate(content)) {
      throw new Error('Invalid HTML content');
    }

    const titleMatch = content.match(/<title>(.*?)<\/title>/i);
    const metaTags = content.match(/<meta\s+[^>]*>/g) || [];
    const metaData: Record<string, string> = {};

    metaTags.forEach(tag => {
      const nameMatch = tag.match(/name=["']([^"']+)["']/i);
      const contentMatch = tag.match(/content=["']([^"']+)["']/i);
      if (nameMatch && contentMatch) {
        metaData[nameMatch[1].toLowerCase()] = contentMatch[1];
      }
    });

    return {
      size: content.length,
      title: titleMatch?.[1] || '',
      ...metaData,
      elementCount: (content.match(/<[^!][^>]*>/g) || []).length
    };
  }
}