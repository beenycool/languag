// src/microservices/resilience/circuit/retry-handler.ts

import { ILoggingService, LogLevel } from '../../services/management/logging-service'; // Optional for logging

/**
 * @interface RetryOptions
 * Configuration options for the retry mechanism.
 */
export interface RetryOptions {
  /** Maximum number of retry attempts. Default: 3. */
  maxAttempts?: number;
  /** Initial delay (ms) before the first retry. Default: 100ms. */
  initialDelayMs?: number;
  /** Maximum delay (ms) between retries. Default: 30000ms (30s). */
  maxDelayMs?: number;
  /** Factor by which the delay increases after each attempt (e.g., 2 for exponential backoff). Default: 2. */
  backoffFactor?: number;
  /** Randomness factor for jitter (0 to 1). 0 means no jitter. Default: 0.2. */
  jitterFactor?: number;
  /** Optional logger instance. */
  logger?: ILoggingService;
  /** Optional name for logging/identification. */
  handlerName?: string;
  /**
   * A function to determine if an error is retryable.
   * Defaults to retrying on all errors.
   * @param error - The error encountered.
   * @returns True if the operation should be retried for this error, false otherwise.
   */
  isRetryable?: (error: any) => boolean;
  /**
   * Callback invoked before each retry attempt.
   * @param attempt - The current attempt number (1-based).
   * @param delayMs - The delay in milliseconds before this attempt.
   * @param error - The error from the previous attempt.
   */
  onRetry?: (attempt: number, delayMs: number, error: any) => void | Promise<void>;
}

/**
 * @interface IRetryHandler
 * Defines a contract for a handler that can execute an operation with retry logic.
 */
export interface IRetryHandler {
  /**
   * Executes an operation with retry logic based on the configured options.
   * @param operation - A function that returns a Promise representing the operation to execute.
   * @param operationArgs - Optional arguments to pass to the operation.
   * @returns A Promise that resolves with the result of the operation if successful within attempts,
   *          or rejects with the last error if all attempts fail.
   */
  executeWithRetries<T, A extends any[] = any[]>(
    operation: (...args: A) => Promise<T>,
    ...operationArgs: A
  ): Promise<T>;
}

const DEFAULT_RETRY_OPTIONS: Required<Omit<RetryOptions, 'logger' | 'handlerName' | 'isRetryable' | 'onRetry'>> = {
  maxAttempts: 3,
  initialDelayMs: 200,
  maxDelayMs: 30000, // 30 seconds
  backoffFactor: 2,
  jitterFactor: 0.2, // 20% jitter
};

/**
 * @class RetryHandler
 * Implements logic to automatically retry a failing operation with configurable backoff and jitter.
 */
export class RetryHandler implements IRetryHandler {
  private options: Required<Omit<RetryOptions, 'logger' | 'handlerName' | 'isRetryable' | 'onRetry'>> & Pick<RetryOptions, 'logger' | 'handlerName' | 'isRetryable' | 'onRetry'>;

  constructor(options?: Partial<RetryOptions>) {
    this.options = { ...DEFAULT_RETRY_OPTIONS, ...options };
    if (this.options.jitterFactor < 0 || this.options.jitterFactor > 1) {
        this.log(LogLevel.WARN, `Invalid jitterFactor ${this.options.jitterFactor}, clamping to [0, 1]. Using 0.2.`);
        this.options.jitterFactor = Math.max(0, Math.min(1, this.options.jitterFactor || 0.2));
    }
    this.log(LogLevel.INFO, 'RetryHandler initialized.');
  }

  private log(level: LogLevel, message: string, context?: Record<string, any>): void {
    const handlerName = this.options.handlerName || 'UnnamedRetryHandler';
    if (this.options.logger) {
      this.options.logger.log(level, `[Retry:${handlerName}] ${message}`, context);
    } else if (level === LogLevel.ERROR || level === LogLevel.WARN) {
      (level === LogLevel.ERROR ? console.error : console.warn)(`[Retry:${handlerName}] ${message}`, context || '');
    }
  }

  public async executeWithRetries<T, A extends any[] = any[]>(
    operation: (...args: A) => Promise<T>,
    ...operationArgs: A
  ): Promise<T> {
    let lastError: any;
    let currentDelayMs = this.options.initialDelayMs;

    for (let attempt = 1; attempt <= this.options.maxAttempts; attempt++) {
      try {
        this.log(LogLevel.DEBUG, `Attempt ${attempt}/${this.options.maxAttempts} for operation.`, { args: operationArgs.length > 0 ? operationArgs : undefined });
        return await operation(...operationArgs);
      } catch (error: any) {
        lastError = error;
        this.log(LogLevel.WARN, `Attempt ${attempt} failed.`, { error: error?.message, stack: error?.stack });

        if (this.options.isRetryable && !this.options.isRetryable(error)) {
          this.log(LogLevel.WARN, 'Error deemed not retryable. Aborting retries.', { error: error?.message });
          throw lastError;
        }

        if (attempt === this.options.maxAttempts) {
          this.log(LogLevel.ERROR, `All ${this.options.maxAttempts} attempts failed. No more retries.`, { lastError: lastError?.message });
          break; // Exit loop, will throw lastError
        }

        // Calculate delay with backoff and jitter
        const jitter = Math.random() * currentDelayMs * this.options.jitterFactor;
        const delayWithJitter = Math.round(currentDelayMs + (Math.random() > 0.5 ? jitter : -jitter));
        const actualDelayMs = Math.max(0, Math.min(delayWithJitter, this.options.maxDelayMs)); // Ensure delay is within bounds and non-negative

        this.log(LogLevel.INFO, `Will retry after ${actualDelayMs}ms (attempt ${attempt + 1}/${this.options.maxAttempts}). Base delay: ${currentDelayMs}ms.`);

        if (this.options.onRetry) {
            try {
                await Promise.resolve(this.options.onRetry(attempt, actualDelayMs, lastError));
            } catch (onRetryError) {
                this.log(LogLevel.ERROR, 'Error in onRetry callback.', { error: onRetryError });
            }
        }

        await new Promise(resolve => setTimeout(resolve, actualDelayMs));

        // Increase delay for next attempt (exponential backoff)
        currentDelayMs = Math.min(currentDelayMs * this.options.backoffFactor, this.options.maxDelayMs);
      }
    }
    // If loop finishes, it means all attempts failed
    throw lastError;
  }
}

// Example Usage:
async function exampleRetryUsage() {
  // const logger = new LoggingService(); // Assuming LoggingService is set up
  // await logger.addTransport(new ConsoleTransport());
  // logger.setLogLevel(LogLevel.DEBUG);

  const retryHandler = new RetryHandler({
    maxAttempts: 4,
    initialDelayMs: 100,
    backoffFactor: 1.5,
    jitterFactor: 0.1,
    // logger,
    handlerName: 'ApiServiceRetry',
    isRetryable: (err: any) => {
      // Example: only retry on network errors or specific HTTP status codes
      if (err.isNetworkError || (err.statusCode && [500, 502, 503, 504].includes(err.statusCode))) {
        return true;
      }
      return false;
    },
    onRetry: (attempt, delay, err) => {
        console.log(`ON_RETRY_CALLBACK: Attempt ${attempt} failed with "${err.message}". Retrying in ${delay}ms.`);
    }
  });

  let attemptCounter = 0;
  async function flakyOperation(id: string): Promise<string> {
    attemptCounter++;
    console.log(`Calling flakyOperation (attempt #${attemptCounter}) with id: ${id}`);
    await new Promise(resolve => setTimeout(resolve, 50)); // Simulate work

    if (attemptCounter < 3) { // Fail first 2 times
      const error: any = new Error(`Simulated network error on attempt ${attemptCounter}`);
      error.isNetworkError = true; // Custom property for isRetryable
      console.error(`flakyOperation FAILED on attempt ${attemptCounter}.`);
      throw error;
    }
    if (attemptCounter === 3) { // Fail 3rd time with non-retryable error
        const error: any = new Error(`Simulated validation error on attempt ${attemptCounter}`);
        error.statusCode = 400; // Not in retryable list
        console.error(`flakyOperation FAILED on attempt ${attemptCounter} with non-retryable error.`);
        throw error;
    }
    console.log(`flakyOperation SUCCEEDED on attempt ${attemptCounter}!`);
    return `Success from flakyOperation (attempt #${attemptCounter}) with id: ${id}`;
  }

  // Scenario 1: Operation eventually succeeds after retries
  console.log('\n--- Scenario 1: Eventually Succeeds (will fail on 3rd due to non-retryable) ---');
  attemptCounter = 0; // Reset for scenario
  try {
    const result1 = await retryHandler.executeWithRetries(flakyOperation, 'data123');
    console.log('Final Result (Scenario 1):', result1);
  } catch (e: any) {
    console.error('Error in Scenario 1:', e.message, e.isNetworkError ? '(Network Error)' : `(Status: ${e.statusCode})`);
  }


  // Scenario 2: Operation always fails with retryable error until max attempts
  console.log('\n--- Scenario 2: Always Fails Retryable ---');
  attemptCounter = 0; // Reset
  async function alwaysFailsRetryable(): Promise<string> {
      attemptCounter++;
      console.log(`Calling alwaysFailsRetryable (attempt #${attemptCounter})`);
      await new Promise(resolve => setTimeout(resolve, 50));
      const error: any = new Error(`Persistent simulated server error on attempt ${attemptCounter}`);
      error.statusCode = 503; // Retryable
      console.error(`alwaysFailsRetryable FAILED on attempt ${attemptCounter}.`);
      throw error;
  }
  try {
    const result2 = await retryHandler.executeWithRetries(alwaysFailsRetryable);
    console.log('Final Result (Scenario 2):', result2); // Should not reach here
  } catch (e: any) {
    console.error('Error in Scenario 2 (expected):', e.message);
  }
}

// To run the example:
// exampleRetryUsage().catch(e => console.error("Example usage main error:", e));