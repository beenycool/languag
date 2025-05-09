import { ContentType, TextContent, ImageContent, FileContent } from '../../types/content-types';

export class ContentAnalyzer {
  analyze(content: ContentType): { type: string; size: number; metadata: Record<string, any> } {
    if ('text' in content) {
      return this.analyzeText(content);
    } else if ('data' in content && 'format' in content) {
      return this.analyzeImage(content);
    } else if ('data' in content) {
      return this.analyzeFile(content);
    }
    return { type: 'unknown', size: 0, metadata: {} };
  }

  private analyzeText(content: TextContent) {
    const words = content.text.split(/\s+/).filter(Boolean).length;
    const lines = content.text.split('\n').length;
    const chars = content.text.length;

    return {
      type: 'text',
      size: Buffer.byteLength(content.text, 'utf8'),
      metadata: {
        words,
        lines,
        chars,
        isRichText: content.isRichText || false,
        language: content.language || 'unknown'
      }
    };
  }

  private analyzeImage(content: ImageContent) {
    return {
      type: 'image',
      size: content.data.byteLength,
      metadata: {
        width: content.width,
        height: content.height,
        format: content.format,
        aspectRatio: content.width / content.height
      }
    };
  }

  private analyzeFile(content: FileContent) {
    return {
      type: 'file',
      size: content.size,
      metadata: {
        name: content.name,
        type: content.type
      }
    };
  }
}