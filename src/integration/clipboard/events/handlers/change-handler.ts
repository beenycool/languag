import { ClipboardEvent, ClipboardChangeEvent } from '../../types/event-types';
import { ClipboardContent } from '../../types/clipboard-types';
import { ContentType } from '../../types/content-types';

export class ChangeHandler {
  private lastContent: string = '';

  handle(event: ClipboardEvent): ClipboardChangeEvent | null {
    if (event.type !== 'change') return null;

    const content = event.content as ClipboardContent;
    const currentText = content.text || '';

    if (currentText !== this.lastContent) {
      this.lastContent = currentText;
      return {
        type: 'change',
        content: this.mapToContentType(content),
        timestamp: Date.now()
      };
    }
    return null;
  }

  private mapToContentType(content: ClipboardContent): ContentType {
    if (content.image) {
      return {
        data: content.image,
        width: 0, // Will be set by analyzer
        height: 0, // Will be set by analyzer
        format: 'png'
      };
    }
    return {
      text: content.text || '',
      isRichText: !!content.html || !!content.rtf
    };
  }
}