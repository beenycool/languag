import {
  ClipboardEvent,
  ClipboardChangeEvent,
  ClipboardFormatEvent,
  ClipboardErrorEvent
} from '../../types/event-types';
import { ContentType } from '../../types/content-types';
import { EventDispatcher } from './event-dispatcher';

export class NotificationDispatcher {
  constructor(private eventDispatcher: EventDispatcher) {}

  notify(event: ClipboardEvent): void {
    try {
      switch (event.type) {
        case 'change':
          this.showChangeNotification(event);
          break;
        case 'format':
          this.showFormatNotification(event);
          break;
        case 'error':
          this.showErrorNotification(event);
          break;
      }
    } catch (error) {
      this.eventDispatcher.dispatchError(error, 'notification-dispatch');
    }
  }

  private showChangeNotification(event: ClipboardChangeEvent): void {
    const message = `Clipboard content changed (${this.getContentSummary(event.content)})`;
    this.showNotification(message, 'info');
  }

  private showFormatNotification(event: ClipboardFormatEvent): void {
    const message = `Clipboard format changed to ${event.format}`;
    this.showNotification(message, 'info');
  }

  private showErrorNotification(event: ClipboardErrorEvent): void {
    const message = `Clipboard error during ${event.operation}: ${event.error.message}`;
    this.showNotification(message, 'error');
  }

  private getContentSummary(content: ContentType): string {
    if ('text' in content) {
      return `text: ${content.text.substring(0, 20)}${content.text.length > 20 ? '...' : ''}`;
    } else if ('data' in content && 'format' in content) {
      // This is ImageContent
      return `image: ${content.width}x${content.height} ${content.format}`;
    } else if ('data' in content) {
      // This is FileContent
      return `file: ${content.name} (${content.type})`;
    }
    return 'unknown content';
  }

  private showNotification(message: string, type: 'info' | 'error'): void {
    // In a real implementation, this would use the platform's notification system
    console.log(`[Notification ${type}]: ${message}`);
  }
}