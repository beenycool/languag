// src/microservices/services/management/logging-service.ts

import { IConfigService } from '../infrastructure/config-service';

/**
 * @enum LogLevel
 * Defines standard logging levels.
 */
export enum LogLevel {
  ERROR = 'error', // Critical errors, application stability affected.
  WARN = 'warn',   // Potential issues, unexpected behavior.
  INFO = 'info',   // General operational information, milestones.
  DEBUG = 'debug', // Detailed information for debugging.
  TRACE = 'trace', // Highly detailed diagnostic information.
}

/**
 * @interface LogEntry
 * Represents a single log entry.
 */
export interface LogEntry {
  timestamp: number;
  level: LogLevel;
  message: string;
  serviceName?: string; // Name of the service generating the log
  correlationId?: string; // For tracking requests across services
  requestId?: string; // Specific request ID
  userId?: string; // User associated with the log
  error?: {
    name?: string;
    message?: string;
    stack?: string;
    code?: string | number;
  };
  [key: string]: any; // Additional structured data
}

/**
 * @interface LogTransport
 * Defines a contract for a log transport mechanism (e.g., console, file, remote service).
 */
export interface LogTransport {
  /**
   * Logs a message.
   * @param entry - The log entry to write.
   */
  log(entry: LogEntry): Promise<void>;

  /**
   * Optional: Gets the name of the transport.
   */
  getName?(): string;

  /**
   * Optional: Initializes the transport (e.g., opens a file stream).
   */
  init?(): Promise<void>;

  /**
   * Optional: Closes the transport (e.g., closes file stream, flushes buffer).
   */
  destroy?(): Promise<void>;
}

/**
 * @interface ILoggingService
 * Defines the contract for a centralized logging service.
 */
export interface ILoggingService {
  log(level: LogLevel, message: string, context?: Record<string, any>): void;
  error(message: string, error?: Error | any, context?: Record<string, any>): void;
  warn(message: string, context?: Record<string, any>): void;
  info(message: string, context?: Record<string, any>): void;
  debug(message: string, context?: Record<string, any>): void;
  trace(message: string, context?: Record<string, any>): void;

  /**
   * Adds a log transport.
   * @param transport - The log transport to add.
   */
  addTransport(transport: LogTransport): Promise<void>;

  /**
   * Removes a log transport.
   * @param transportName - The name of the transport to remove (requires transport.getName()).
   *                        If not provided or name not found, might require passing the transport instance.
   */
  removeTransport(transportName: string): Promise<void>;

  /**
   * Sets the minimum log level for the service. Messages below this level will be ignored.
   * @param level - The minimum log level.
   */
  setLogLevel(level: LogLevel): void;

  /**
   * Gets the current minimum log level.
   */
  getLogLevel(): LogLevel;

  /**
   * Creates a child logger with pre-configured context (e.g., serviceName).
   * @param defaultContext - Default context to include in all logs from this child logger.
   */
  getChildLogger(defaultContext: Record<string, any>): ILoggingService;
}

/**
 * @class LoggingService
 * Provides a flexible and extensible logging solution for microservices.
 */
export class LoggingService implements ILoggingService {
  private transports: LogTransport[];
  private minLevel: LogLevel;
  private serviceName?: string;
  private defaultContext: Record<string, any>;

  private static LogLevelOrder: Record<LogLevel, number> = {
    [LogLevel.TRACE]: 0,
    [LogLevel.DEBUG]: 1,
    [LogLevel.INFO]: 2,
    [LogLevel.WARN]: 3,
    [LogLevel.ERROR]: 4,
  };

  constructor(configService?: IConfigService, defaultContext: Record<string, any> = {}) {
    this.transports = [];
    this.defaultContext = defaultContext;
    this.serviceName = configService?.get<string>('service.name', 'UnknownService') ?? defaultContext.serviceName ?? 'UnknownService';
    const configuredLevel = configService?.get<string>('logging.level', LogLevel.INFO) ?? defaultContext.minLevel ?? LogLevel.INFO;
    this.minLevel = this.isValidLogLevel(configuredLevel) ? configuredLevel as LogLevel : LogLevel.INFO;

    console.log(`LoggingService initialized for "${this.serviceName}" with level "${this.minLevel}".`);
  }

  private isValidLogLevel(level: string): boolean {
    return Object.values(LogLevel).includes(level as LogLevel);
  }

  public async addTransport(transport: LogTransport): Promise<void> {
    if (transport.init) {
      await transport.init();
    }
    this.transports.push(transport);
    console.log(`Log transport added: ${transport.getName ? transport.getName() : 'UnnamedTransport'}`);
  }

  public async removeTransport(transportName: string): Promise<void> {
    const initialLength = this.transports.length;
    const transportsToKeep: LogTransport[] = [];
    const transportsToRemove: LogTransport[] = [];

    for (const t of this.transports) {
        if (t.getName && t.getName() === transportName) {
            transportsToRemove.push(t);
        } else {
            transportsToKeep.push(t);
        }
    }
    this.transports = transportsToKeep;

    for (const t of transportsToRemove) {
        if (t.destroy) {
            await t.destroy();
        }
    }

    if (this.transports.length < initialLength) {
      console.log(`Log transport removed: ${transportName}`);
    } else {
      console.warn(`Log transport "${transportName}" not found for removal.`);
    }
  }

  public setLogLevel(level: LogLevel): void {
    if (this.isValidLogLevel(level)) {
      this.minLevel = level;
      console.log(`Log level set to: ${this.minLevel}`);
    } else {
      console.warn(`Invalid log level: ${level}. Log level remains ${this.minLevel}.`);
    }
  }

  public getLogLevel(): LogLevel {
    return this.minLevel;
  }

  private shouldLog(level: LogLevel): boolean {
    return LoggingService.LogLevelOrder[level] >= LoggingService.LogLevelOrder[this.minLevel];
  }

  public log(level: LogLevel, message: string, context: Record<string, any> = {}): void {
    if (!this.shouldLog(level)) {
      return;
    }

    const entry: LogEntry = {
      timestamp: Date.now(),
      level,
      message,
      serviceName: this.serviceName,
      ...this.defaultContext, // Apply logger's default context
      ...context, // Apply call-specific context (can override logger's default)
    };

    if (context.error instanceof Error) {
      entry.error = {
        name: context.error.name,
        message: context.error.message,
        stack: context.error.stack,
        ...(typeof (context.error as any).code !== 'undefined' && { code: (context.error as any).code }),
      };
      // Avoid duplicating error in the main context if it's already in entry.error
      const { error, ...restOfContext } = context;
      Object.assign(entry, restOfContext);
    }


    this.transports.forEach(transport => {
      transport.log(entry).catch(err => {
        // Fallback to console.error if a transport fails
        console.error(`Failed to write log via transport ${transport.getName ? transport.getName() : 'UnnamedTransport'}:`, err, 'Original log entry:', entry);
      });
    });
  }

  public error(message: string, error?: Error | any, context: Record<string, any> = {}): void {
    const logContext = { ...context };
    if (error) {
      if (error instanceof Error) {
        logContext.error = error; // Will be destructured by this.log
      } else if (typeof error === 'object' && error !== null) {
        // If it's an object but not an Error instance, merge its properties
        logContext.errorDetails = error;
      } else {
        logContext.errorDetails = String(error);
      }
    }
    this.log(LogLevel.ERROR, message, logContext);
  }

  public warn(message: string, context?: Record<string, any>): void {
    this.log(LogLevel.WARN, message, context);
  }

  public info(message: string, context?: Record<string, any>): void {
    this.log(LogLevel.INFO, message, context);
  }

  public debug(message: string, context?: Record<string, any>): void {
    this.log(LogLevel.DEBUG, message, context);
  }

  public trace(message: string, context?: Record<string, any>): void {
    this.log(LogLevel.TRACE, message, context);
  }

  public getChildLogger(defaultContext: Record<string, any>): ILoggingService {
    const mergedContext = {
      ...this.defaultContext,
      ...defaultContext,
      // Ensure serviceName from parent is kept if not overridden by child
      serviceName: defaultContext.serviceName || this.serviceName,
      minLevel: defaultContext.minLevel || this.minLevel,
    };
    const child = new LoggingService(undefined, mergedContext); // Pass undefined for configService to inherit parent's effective config
    
    // Share transports with the child
    child.transports = [...this.transports];
    // Child's log level is independent or can be inherited via defaultContext.minLevel
    child.setLogLevel(mergedContext.minLevel as LogLevel);

    return child;
  }

  /**
   * Cleans up resources, like destroying transports.
   */
  public async destroy(): Promise<void> {
    for (const transport of this.transports) {
      if (transport.destroy) {
        await transport.destroy();
      }
    }
    this.transports = [];
    console.log(`LoggingService for "${this.serviceName}" destroyed.`);
  }
}

// --- Example Log Transports ---

/**
 * @class ConsoleTransport
 * A simple log transport that writes to the console.
 */
export class ConsoleTransport implements LogTransport {
  private format: (entry: LogEntry) => string;

  constructor(format?: (entry: LogEntry) => string) {
    this.format = format || this.defaultFormat;
  }

  public getName(): string {
    return 'ConsoleTransport';
  }

  private defaultFormat(entry: LogEntry): string {
    let output = `${new Date(entry.timestamp).toISOString()} [${entry.level.toUpperCase()}]`;
    if (entry.serviceName) output += ` [${entry.serviceName}]`;
    if (entry.correlationId) output += ` [corr:${entry.correlationId}]`;
    if (entry.requestId) output += ` [req:${entry.requestId}]`;
    if (entry.userId) output += ` [user:${entry.userId}]`;
    output += `: ${entry.message}`;

    const reservedKeys = ['timestamp', 'level', 'message', 'serviceName', 'correlationId', 'requestId', 'userId', 'error'];
    const additionalContext = Object.keys(entry)
      .filter(key => !reservedKeys.includes(key) && entry[key] !== undefined)
      .reduce((obj, key) => {
        obj[key] = entry[key];
        return obj;
      }, {} as Record<string, any>);

    if (Object.keys(additionalContext).length > 0) {
      try {
        output += ` ${JSON.stringify(additionalContext)}`;
      } catch (e) {
        output += ` (UnserializableContext)`;
      }
    }

    if (entry.error) {
      output += `\n  Error: ${entry.error.name || 'Error'}: ${entry.error.message || 'No message'}`;
      if (entry.error.code) output += ` (Code: ${entry.error.code})`;
      if (entry.error.stack) output += `\n  Stack: ${entry.error.stack}`;
    }
    return output;
  }

  public async log(entry: LogEntry): Promise<void> {
    const message = this.format(entry);
    switch (entry.level) {
      case LogLevel.ERROR:
        console.error(message);
        break;
      case LogLevel.WARN:
        console.warn(message);
        break;
      case LogLevel.INFO:
        console.info(message);
        break;
      case LogLevel.DEBUG:
        console.debug(message);
        break;
      case LogLevel.TRACE:
        console.trace(message); // console.trace often includes its own stack
        break;
      default:
        console.log(message);
    }
  }
}

// Example Usage
async function loggingExample() {
  // const config = new ConfigService(); // Assuming ConfigService is available and configured
  // config.addSource(new ObjectConfigSource({ 'logging.level': 'debug', 'service.name': 'OrderService' }));
  // await config.loadConfiguration();

  const logger = new LoggingService(/* config */); // Pass config if available
  logger.setLogLevel(LogLevel.DEBUG);
  await logger.addTransport(new ConsoleTransport());

  logger.info('Application started.', { version: '1.0.0', environment: 'development' });
  logger.warn('Low disk space detected.', { freeSpace: '500MB' });
  logger.error('Failed to connect to database.', new Error('Connection timeout'), { dbHost: 'localhost', attempt: 3 });
  logger.debug('User authentication request received.', { username: 'john.doe', ip: '192.168.1.100' });
  logger.trace('Entering function processOrder()', { orderId: '12345' });

  const paymentContext = { correlationId: 'corr-abc-123', serviceName: 'PaymentServiceChild' };
  const paymentLogger = logger.getChildLogger(paymentContext);
  paymentLogger.info('Processing payment for order.', { orderId: '12345', amount: 99.99 });
  paymentLogger.error('Payment failed: Card declined.', undefined, { orderId: '12345', reasonCode: '05' });

  await logger.destroy();
}

// To run the example:
// loggingExample().catch(console.error);