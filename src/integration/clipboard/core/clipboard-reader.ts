import { ClipboardContent, ClipboardFormat } from '../types/clipboard-types';

export class ClipboardReader {
  async readText(): Promise<string> {
    try {
      return await navigator.clipboard.readText();
    } catch (error) {
      console.error('Failed to read clipboard text:', error);
      throw error;
    }
  }

  async read(format: ClipboardFormat = 'text/plain'): Promise<ClipboardContent> {
    try {
      const items = await navigator.clipboard.read();
      for (const item of items) {
        if (item.types.includes(format)) {
          const blob = await item.getType(format);
          return {
            text: format === 'text/plain' ? await blob.text() : '',
            html: format === 'text/html' ? await blob.text() : undefined,
            rtf: format === 'text/rtf' ? await blob.text() : undefined,
            image: format === 'image/png' ? await blob.arrayBuffer() : undefined
          };
        }
      }
      throw new Error(`Clipboard format ${format} not available`);
    } catch (error) {
      console.error('Failed to read clipboard:', error);
      throw error;
    }
  }

  async getAvailableFormats(): Promise<ClipboardFormat[]> {
    try {
      const items = await navigator.clipboard.read();
      const formats: ClipboardFormat[] = [];
      for (const item of items) {
        for (const type of item.types) {
          if (type === 'text/plain') formats.push('text/plain');
          if (type === 'text/html') formats.push('text/html');
          if (type === 'text/rtf') formats.push('text/rtf');
          if (type === 'image/png') formats.push('image/png');
        }
      }
      return formats;
    } catch (error) {
      console.error('Failed to get clipboard formats:', error);
      return ['text/plain']; // Fallback to text/plain
    }
  }
}