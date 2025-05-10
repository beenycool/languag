// src/microservices/resilience/stability/timeout-handler.ts

import { ILoggingService, LogLevel } from '../../services/management/logging-service'; // Optional

/**
 * @interface TimeoutOptions
 * Configuration options for the timeout handler.
 */
export interface TimeoutOptions {
  /** Duration in milliseconds after which the operation should time out. */
  timeoutMs: number;
  /** Optional logger instance. */
  logger?: ILoggingService;
  /** Optional name for logging/identification. */
  handlerName?: string;
  /** Custom error to throw on timeout. If not provided, a default TimeoutError is thrown. */
  timeoutError?: Error | ((options: TimeoutOptions) => Error);
}

/**
 * @interface ITimeoutHandler
 * Defines the contract for a handler that applies a timeout to an operation.
 */
export interface ITimeoutHandler {
  /**
   * Executes an operation with a specified timeout.
   * If the operation does not complete within the timeout period, it is rejected.
   * @param operation - A function that returns a Promise representing the operation to execute.
   * @param operationArgs - Optional arguments to pass to the operation.
   * @returns A Promise that resolves with the result of the operation if it completes in time,
   *          or rejects with a timeout error if it exceeds the timeout.
   */
  executeWithTimeout<T, A extends any[] = any[]>(
    operation: (...args: A) => Promise<T>,
    ...operationArgs: A
  ): Promise<T>;
}

/**
 * @class TimeoutError
 * Custom error class for timeout events.
 */
export class TimeoutError extends Error {
  public readonly code: string;
  constructor(message: string, public readonly timeoutMs?: number, public readonly handlerName?: string) {
    super(message);
    this.name = 'TimeoutError';
    this.code = 'OPERATION_TIMEOUT';
    // Ensure prototype chain is correct for instanceof checks
    Object.setPrototypeOf(this, TimeoutError.prototype);
  }
}

/**
 * @class TimeoutHandler
 * Implements logic to enforce a timeout on asynchronous operations.
 */
export class TimeoutHandler implements ITimeoutHandler {
  private options: Required<Omit<TimeoutOptions, 'logger' | 'handlerName' | 'timeoutError'>> & Pick<TimeoutOptions, 'logger' | 'handlerName' | 'timeoutError'>;

  constructor(options: TimeoutOptions) {
    this.options = {
        timeoutMs: options.timeoutMs,
        logger: options.logger,
        handlerName: options.handlerName || 'UnnamedTimeoutHandler',
        timeoutError: options.timeoutError,
    };
    if (this.options.timeoutMs <= 0) {
        throw new Error('timeoutMs must be a positive number.');
    }
    this.log(LogLevel.INFO, `TimeoutHandler "${this.options.handlerName}" initialized with timeout ${this.options.timeoutMs}ms.`);
  }

  private log(level: LogLevel, message: string, context?: Record<string, any>): void {
    if (this.options.logger) {
      this.options.logger.log(level, `[Timeout:${this.options.handlerName}] ${message}`, context);
    } else if (level === LogLevel.ERROR || level === LogLevel.WARN) {
      (level === LogLevel.ERROR ? console.error : console.warn)(`[Timeout:${this.options.handlerName}] ${message}`, context || '');
    }
  }

  public executeWithTimeout<T, A extends any[] = any[]>(
    operation: (...args: A) => Promise<T>,
    ...operationArgs: A
  ): Promise<T> {
    return new Promise<T>((resolve, reject) => {
      let timeoutId: NodeJS.Timeout | null = null;
      let completed = false; // Flag to prevent multiple resolutions/rejections

      const finish = (resolver: (value: T) => void, rejecter: (reason?: any) => void, valueOrError: any, isError: boolean) => {
        if (!completed) {
          completed = true;
          if (timeoutId) {
            clearTimeout(timeoutId);
            timeoutId = null;
          }
          if (isError) {
            rejecter(valueOrError);
          } else {
            resolver(valueOrError);
          }
        }
      };

      timeoutId = setTimeout(() => {
        if (!completed) {
          this.log(LogLevel.WARN, `Operation timed out after ${this.options.timeoutMs}ms.`);
          let errorToThrow: Error;
          if (typeof this.options.timeoutError === 'function') {
            errorToThrow = this.options.timeoutError(this.options);
          } else if (this.options.timeoutError instanceof Error) {
            errorToThrow = this.options.timeoutError;
          } else {
            errorToThrow = new TimeoutError(
              `Operation in "${this.options.handlerName}" timed out after ${this.options.timeoutMs}ms.`,
              this.options.timeoutMs,
              this.options.handlerName
            );
          }
          finish(resolve, reject, errorToThrow, true);
        }
      }, this.options.timeoutMs);

      this.log(LogLevel.DEBUG, 'Executing operation with timeout.', { args: operationArgs.length > 0 ? operationArgs : undefined });
      operation(...operationArgs)
        .then(result => {
          this.log(LogLevel.DEBUG, 'Operation completed within timeout.');
          finish(resolve, reject, result, false);
        })
        .catch(error => {
          this.log(LogLevel.DEBUG, 'Operation failed within timeout.', { error: error?.message });
          finish(resolve, reject, error, true);
        });
    });
  }
}

// Example Usage:
async function exampleTimeoutUsage() {
  // const logger = new LoggingService();
  // await logger.addTransport(new ConsoleTransport());
  // logger.setLogLevel(LogLevel.DEBUG);

  const shortTimeoutHandler = new TimeoutHandler({
    timeoutMs: 500,
    handlerName: 'ShortOpTimeout',
    // logger,
    timeoutError: (opts) => new TimeoutError(`Custom timeout for ${opts.handlerName} after ${opts.timeoutMs}ms!`)
  });

  const longTimeoutHandler = new TimeoutHandler({
    timeoutMs: 2000,
    handlerName: 'LongOpTimeout',
    // logger
  });

  async function quickOperation(message: string): Promise<string> {
    console.log(`[QuickOp] Starting with message: "${message}"`);
    await new Promise(resolve => setTimeout(resolve, 200));
    console.log('[QuickOp] Finished.');
    return `QuickOp success: ${message}`;
  }

  async function slowOperation(message: string): Promise<string> {
    console.log(`[SlowOp] Starting with message: "${message}" (will take 1000ms)`);
    await new Promise(resolve => setTimeout(resolve, 1000));
    console.log('[SlowOp] Finished.');
    return `SlowOp success: ${message}`;
  }

  // Scenario 1: Operation completes within short timeout
  console.log('\n--- Scenario 1: Quick op with short timeout (should succeed) ---');
  try {
    const result1 = await shortTimeoutHandler.executeWithTimeout(quickOperation, 'Hello');
    console.log('Result (Scenario 1):', result1);
  } catch (e: any) {
    console.error('Error (Scenario 1):', e.message, e instanceof TimeoutError ? `(Code: ${e.code})` : '');
  }

  // Scenario 2: Operation exceeds short timeout
  console.log('\n--- Scenario 2: Slow op with short timeout (should time out) ---');
  try {
    const result2 = await shortTimeoutHandler.executeWithTimeout(slowOperation, 'World');
    console.log('Result (Scenario 2):', result2);
  } catch (e: any) {
    console.error('Error (Scenario 2):', e.message, e instanceof TimeoutError ? `(Code: ${e.code})` : '');
  }

  // Scenario 3: Operation completes within long timeout
  console.log('\n--- Scenario 3: Slow op with long timeout (should succeed) ---');
  try {
    const result3 = await longTimeoutHandler.executeWithTimeout(slowOperation, 'Again');
    console.log('Result (Scenario 3):', result3);
  } catch (e: any) {
    console.error('Error (Scenario 3):', e.message, e instanceof TimeoutError ? `(Code: ${e.code})` : '');
  }

  // Scenario 4: Operation fails before timeout
  console.log('\n--- Scenario 4: Op fails before timeout (should reject with op error) ---');
  async function failingOperation(): Promise<string> {
      console.log('[FailingOp] Starting...');
      await new Promise(resolve => setTimeout(resolve, 100));
      console.error('[FailingOp] Throwing error.');
      throw new Error("Deliberate failure in operation");
  }
  try {
    const result4 = await shortTimeoutHandler.executeWithTimeout(failingOperation);
    console.log('Result (Scenario 4):', result4);
  } catch (e: any) {
    console.error('Error (Scenario 4):', e.message, e instanceof TimeoutError ? `(Code: ${e.code})` : '');
  }
}

// To run the example:
// exampleTimeoutUsage().catch(e => console.error("Example usage main error:", e));