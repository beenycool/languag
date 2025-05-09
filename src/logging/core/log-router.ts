// Defines interfaces for log handlers and a simple router/dispatcher.
// In a more complex system, this could involve more sophisticated routing rules.

import { LogEntry, LogLevel } from './log-manager'; // Assuming LogEntry is in log-manager.ts

export interface LogHandler {
  /**
   * Handles a log entry.
   * @param entry The raw log entry.
   * @param formattedMessage The pre-formatted log message (string).
   */
  handle(entry: LogEntry, formattedMessage: string): void;

  /**
   * Optional: Allows a handler to specify which log levels it's interested in.
   * If not implemented, it's assumed to handle all levels passed to it by LogManager.
   */
  shouldHandle?(level: LogLevel): boolean;

  /**
   * Optional: Called when the handler is being removed or system is shutting down.
   * Useful for flushing buffers, closing files/connections.
   */
  destroy?(): Promise<void> | void;
}

// LogRouter isn't strictly necessary if LogManager directly manages a list of handlers.
// However, if routing logic becomes complex (e.g., based on log source or context),
// a dedicated router class could be useful. For now, LogManager handles dispatch.

// Example of a basic console handler that could be moved to its own file (e.g., handlers/console-handler.ts)
export class ConsoleLogHandler implements LogHandler {
  public handle(entry: LogEntry, formattedMessage: string): void {
    switch (entry.level) {
      case LogLevel.DEBUG:
        console.debug(formattedMessage);
        break;
      case LogLevel.INFO:
        console.info(formattedMessage);
        break;
      case LogLevel.WARN:
        console.warn(formattedMessage);
        break;
      case LogLevel.ERROR:
      case LogLevel.FATAL:
        console.error(formattedMessage);
        break;
      default:
        console.log(formattedMessage);
    }
  }

  public shouldHandle(level: LogLevel): boolean {
    // This console handler will handle all levels by default if LogManager doesn't filter first.
    // Or, you could implement specific level filtering here.
    return true;
  }

  public destroy(): void {
    // No specific cleanup needed for console.
    console.log('ConsoleLogHandler destroyed.');
  }
}

// This file primarily defines the LogHandler interface.
// The LogManager will use this interface for its handlers.