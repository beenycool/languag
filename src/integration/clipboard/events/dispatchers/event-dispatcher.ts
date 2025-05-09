import { EventEmitter } from 'events';
import { ClipboardEvent } from '../../types/event-types';
import { ChangeHandler } from '../handlers/change-handler';
import { FormatHandler } from '../handlers/format-handler';
import { ErrorHandler } from '../handlers/error-handler';

export class EventDispatcher extends EventEmitter {
  private changeHandler = new ChangeHandler();
  private formatHandler = new FormatHandler();
  private errorHandler = new ErrorHandler();

  dispatch(event: ClipboardEvent): void {
    try {
      // Handle change events
      const changeEvent = this.changeHandler.handle(event);
      if (changeEvent) {
        this.emit('change', changeEvent);
      }

      // Handle format events
      const formatEvent = this.formatHandler.handle(event);
      if (formatEvent) {
        this.emit('format', formatEvent);
      }
    } catch (error) {
      // Handle any errors during dispatch
      const errorEvent = this.errorHandler.handle(error, 'event-dispatch');
      if (errorEvent) {
        this.errorHandler.logError(errorEvent);
        this.emit('error', errorEvent);
      }
    }
  }

  dispatchError(error: unknown, operation: string): void {
    const errorEvent = this.errorHandler.handle(error, operation);
    if (errorEvent) {
      this.errorHandler.logError(errorEvent);
      this.emit('error', errorEvent);
    }
  }
}