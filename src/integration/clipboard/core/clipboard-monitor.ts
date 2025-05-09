import { EventEmitter } from 'events';
import { ClipboardEvent, ClipboardContent } from '../types/clipboard-types';

export class ClipboardMonitor extends EventEmitter {
  private pollingInterval: NodeJS.Timeout | null = null;
  private lastContent: string = '';

  constructor(private intervalMs: number = 500) {
    super();
  }

  start(): void {
    if (this.pollingInterval) return;
    
    this.pollingInterval = setInterval(() => {
      this.checkClipboard();
    }, this.intervalMs);
  }

  stop(): void {
    if (this.pollingInterval) {
      clearInterval(this.pollingInterval);
      this.pollingInterval = null;
    }
  }

  private async checkClipboard(): Promise<void> {
    try {
      const content = await this.readClipboard();
      if (content !== this.lastContent) {
        this.lastContent = content;
        this.emit('change', {
          type: 'text/plain',
          content,
          timestamp: Date.now()
        } as ClipboardEvent);
      }
    } catch (error) {
      this.emit('error', error);
    }
  }

  private async readClipboard(): Promise<string> {
    return navigator.clipboard.readText();
  }
}