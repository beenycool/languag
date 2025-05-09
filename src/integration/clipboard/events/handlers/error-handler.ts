import { ClipboardEvent, ClipboardErrorEvent } from '../../types/event-types';

export class ErrorHandler {
  private lastError: string = '';

  handle(error: unknown, operation: string): ClipboardErrorEvent | null {
    const errorMessage = error instanceof Error ? error.message : String(error);
    
    if (errorMessage !== this.lastError) {
      this.lastError = errorMessage;
      return {
        type: 'error',
        error: error instanceof Error ? error : new Error(errorMessage),
        timestamp: Date.now(),
        operation
      };
    }
    return null;
  }

  logError(event: ClipboardErrorEvent): void {
    console.error(`[Clipboard Error] ${event.operation}:`, event.error);
  }
}