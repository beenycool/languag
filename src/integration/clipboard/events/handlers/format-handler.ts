import { ClipboardEvent, ClipboardFormatEvent } from '../../types/event-types';
import { ClipboardContent } from '../../types/clipboard-types';

export class FormatHandler {
  private lastFormat: string = '';

  handle(event: ClipboardEvent): ClipboardFormatEvent | null {
    if (event.type !== 'change') return null;

    const content = event.content as ClipboardContent;
    let currentFormat = 'text/plain';

    if (content.html) currentFormat = 'text/html';
    else if (content.rtf) currentFormat = 'text/rtf';
    else if (content.image) currentFormat = 'image/png';

    if (currentFormat !== this.lastFormat) {
      this.lastFormat = currentFormat;
      return {
        type: 'format',
        format: currentFormat,
        timestamp: Date.now()
      };
    }
    return null;
  }
}