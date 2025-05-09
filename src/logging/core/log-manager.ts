// Manages overall logging operations, configuration, and levels.
// TODO: Implement more sophisticated log level filtering and dynamic configuration.

import { LogFormatter, DefaultLogFormatter } from './log-formatter';
import { LogHandler } from './log-router'; // Assuming LogHandler will be defined here or imported by LogRouter

export enum LogLevel {
  DEBUG = 'debug',
  INFO = 'info',
  WARN = 'warn',
  ERROR = 'error',
  FATAL = 'fatal', // Typically an error that causes application termination
}

export interface LogEntry {
  timestamp: Date;
  level: LogLevel;
  message: string;
  context?: Record<string, any>; // Additional structured data
  source?: string; // e.g., module name, function name
}

export class LogManager {
  private static instance: LogManager;
  private handlers: LogHandler[] = [];
  private formatter: LogFormatter;
  private minLevel: LogLevel = LogLevel.INFO; // Default minimum log level

  private constructor() {
    this.formatter = new DefaultLogFormatter();
    // In a real application, handlers would be added via configuration or programmatically
  }

  public static getInstance(): LogManager {
    if (!LogManager.instance) {
      LogManager.instance = new LogManager();
    }
    return LogManager.instance;
  }

  public addHandler(handler: LogHandler): void {
    this.handlers.push(handler);
  }

  public removeHandler(handlerToRemove: LogHandler): void {
    this.handlers = this.handlers.filter(handler => handler !== handlerToRemove);
  }

  public setFormatter(formatter: LogFormatter): void {
    this.formatter = formatter;
  }

  public setMinLevel(level: LogLevel): void {
    this.minLevel = level;
  }

  public getMinLevel(): LogLevel {
    return this.minLevel;
  }

  private levelToNumeric(level: LogLevel): number {
    switch (level) {
      case LogLevel.DEBUG: return 0;
      case LogLevel.INFO: return 1;
      case LogLevel.WARN: return 2;
      case LogLevel.ERROR: return 3;
      case LogLevel.FATAL: return 4;
      default: return 1; // Default to INFO
    }
  }

  public log(level: LogLevel, message: string, context?: Record<string, any>, source?: string): void {
    if (this.levelToNumeric(level) < this.levelToNumeric(this.minLevel)) {
      return; // Skip logging if below minLevel
    }

    const logEntry: LogEntry = {
      timestamp: new Date(),
      level,
      message,
      context,
      source,
    };

    const formattedMessage = this.formatter.format(logEntry);

    this.handlers.forEach(handler => {
      try {
        handler.handle(logEntry, formattedMessage);
      } catch (error) {
        console.error('Error in log handler:', error);
        // Avoid infinite loops if console.error itself uses this LogManager
      }
    });
  }

  // Convenience methods
  public debug(message: string, context?: Record<string, any>, source?: string): void {
    this.log(LogLevel.DEBUG, message, context, source);
  }

  public info(message: string, context?: Record<string, any>, source?: string): void {
    this.log(LogLevel.INFO, message, context, source);
  }

  public warn(message: string, context?: Record<string, any>, source?: string): void {
    this.log(LogLevel.WARN, message, context, source);
  }

  public error(message: string, error?: Error | any, context?: Record<string, any>, source?: string): void {
    const fullContext = {
      ...context,
      ...(error instanceof Error ? { errorName: error.name, errorMessage: error.message, stack: error.stack } : { error: String(error) }),
    };
    this.log(LogLevel.ERROR, message, fullContext, source);
  }

  public fatal(message: string, error?: Error | any, context?: Record<string, any>, source?: string): void {
     const fullContext = {
      ...context,
      ...(error instanceof Error ? { errorName: error.name, errorMessage: error.message, stack: error.stack } : { error: String(error) }),
    };
    this.log(LogLevel.FATAL, message, fullContext, source);
  }
}

// Basic logger setup (can be done in application entry point)
// const logger = LogManager.getInstance();
// logger.addHandler(new ConsoleHandler()); // Assuming ConsoleHandler is created
// logger.info('LogManager initialized.');