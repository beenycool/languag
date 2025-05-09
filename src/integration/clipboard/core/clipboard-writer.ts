import { ClipboardContent } from '../types/clipboard-types';

export class ClipboardWriter {
  async writeText(text: string): Promise<void> {
    try {
      await navigator.clipboard.writeText(text);
    } catch (error) {
      console.error('Failed to write text to clipboard:', error);
      throw error;
    }
  }

  async write(content: ClipboardContent): Promise<void> {
    try {
      const clipboardItem: Record<string, Blob> = {};
      
      if (content.text) {
        clipboardItem['text/plain'] = new Blob([content.text], { type: 'text/plain' });
      }
      if (content.html) {
        clipboardItem['text/html'] = new Blob([content.html], { type: 'text/html' });
      }
      if (content.rtf) {
        clipboardItem['text/rtf'] = new Blob([content.rtf], { type: 'text/rtf' });
      }
      if (content.image) {
        clipboardItem['image/png'] = new Blob([content.image], { type: 'image/png' });
      }

      await navigator.clipboard.write([new ClipboardItem(clipboardItem)]);
    } catch (error) {
      console.error('Failed to write to clipboard:', error);
      throw error;
    }
  }

  async clear(): Promise<void> {
    try {
      await navigator.clipboard.writeText('');
    } catch (error) {
      console.error('Failed to clear clipboard:', error);
      throw error;
    }
  }
}