// src/microservices/resilience/circuit/fallback-handler.ts

import { ILoggingService, LogLevel } from '../../services/management/logging-service'; // Optional for logging

/**
 * @type FallbackFunction
 * Defines the signature for a function that provides a fallback result.
 * @param error - The error that triggered the fallback.
 * @param args - The original arguments passed to the primary operation (if available and needed).
 * @returns A promise that resolves to the fallback value.
 */
export type FallbackFunction<T, E = Error, A extends any[] = any[]> = (error: E, ...args: A) => Promise<T>;

/**
 * @interface IFallbackHandler
 * Defines a contract for a handler that can execute an operation and provide a fallback
 * if the primary operation fails.
 */
export interface IFallbackHandler {
  /**
   * Executes a primary operation and, if it fails, executes a fallback function.
   * @param primaryOperation - A function that returns a Promise representing the primary operation.
   * @param fallback - A FallbackFunction that provides a result if the primary operation fails.
   * @param operationArgs - Optional arguments to pass to both primaryOperation (if it accepts them) and fallback.
   * @returns A Promise that resolves to the result of the primary operation or the fallback.
   */
  executeWithFallback<T, E = Error, A extends any[] = any[]>(
    primaryOperation: (...args: A) => Promise<T>,
    fallback: FallbackFunction<T, E, A>,
    ...operationArgs: A
  ): Promise<T>;
}

/**
 * @interface FallbackOptions
 * Configuration options for the FallbackHandler.
 */
export interface FallbackOptions {
  logger?: ILoggingService;
  handlerName?: string; // Optional name for logging
  shouldAttemptFallback?: (error: any) => boolean; // Decide if fallback should be attempted for this error
}

/**
 * @class FallbackHandler
 * Implements logic to execute a primary operation and use a fallback if it fails.
 */
export class FallbackHandler implements IFallbackHandler {
  private logger?: ILoggingService;
  private handlerName?: string;
  private shouldAttemptFallback: (error: any) => boolean;

  constructor(options?: FallbackOptions) {
    this.logger = options?.logger;
    this.handlerName = options?.handlerName || 'UnnamedFallbackHandler';
    this.shouldAttemptFallback = options?.shouldAttemptFallback || (() => true); // Default to always attempt
    this.log(LogLevel.INFO, 'FallbackHandler initialized.');
  }

  private log(level: LogLevel, message: string, context?: Record<string, any>): void {
    if (this.logger) {
      this.logger.log(level, `[Fallback:${this.handlerName}] ${message}`, context);
    } else if (level === LogLevel.ERROR || level === LogLevel.WARN) {
      (level === LogLevel.ERROR ? console.error : console.warn)(`[Fallback:${this.handlerName}] ${message}`, context || '');
    }
  }

  public async executeWithFallback<T, E = Error, A extends any[] = any[]>(
    primaryOperation: (...args: A) => Promise<T>,
    fallback: FallbackFunction<T, E, A>,
    ...operationArgs: A
  ): Promise<T> {
    try {
      this.log(LogLevel.DEBUG, 'Attempting primary operation.', { args: operationArgs.length > 0 ? operationArgs : undefined });
      const result = await primaryOperation(...operationArgs);
      this.log(LogLevel.DEBUG, 'Primary operation succeeded.');
      return result;
    } catch (error: any) {
      this.log(LogLevel.WARN, 'Primary operation failed.', { error: error?.message, stack: error?.stack });

      if (!this.shouldAttemptFallback(error)) {
        this.log(LogLevel.WARN, 'Fallback not attempted due to shouldAttemptFallback condition.', { error: error?.message });
        throw error; // Re-throw original error if fallback is not to be attempted
      }

      this.log(LogLevel.INFO, 'Attempting fallback operation.', { originalError: error?.message });
      try {
        const fallbackResult = await fallback(error as E, ...operationArgs);
        this.log(LogLevel.INFO, 'Fallback operation succeeded.');
        return fallbackResult;
      } catch (fallbackError: any) {
        this.log(LogLevel.ERROR, 'Fallback operation also failed.', {
          originalError: error?.message,
          fallbackError: fallbackError?.message,
          fallbackStack: fallbackError?.stack
        });
        // Decide on behavior: throw original error, fallback error, or a combined error.
        // Throwing the original error is often preferred as it indicates the root cause.
        throw error; // Or: throw fallbackError; or a custom error.
      }
    }
  }
}

// Example Usage:
async function exampleFallbackUsage() {
  // const logger = new LoggingService(); // Assuming LoggingService is set up
  // await logger.addTransport(new ConsoleTransport());
  // logger.setLogLevel(LogLevel.DEBUG);

  const fallbackHandler = new FallbackHandler({
    // logger,
    handlerName: 'UserServiceFallback',
    shouldAttemptFallback: (err: any) => {
        // Example: Don't fallback for validation errors (e.g. HTTP 400)
        // but do fallback for network errors or server errors (e.g. HTTP 500+)
        if (err.isValidationError) return false;
        return true;
    }
  });

  let primaryShouldFail = true;
  let fallbackShouldFail = false;

  async function fetchUserData(userId: string): Promise<{ id: string; name: string; source: string }> {
    console.log(`Attempting to fetch user data for ${userId} from primary source...`);
    await new Promise(resolve => setTimeout(resolve, 200)); // Simulate network delay
    if (primaryShouldFail) {
      const error: any = new Error('Primary data source unavailable (503 Service Unavailable)');
      // error.isValidationError = false; // For the shouldAttemptFallback example
      console.error('Primary fetchUserData FAILED.');
      throw error;
    }
    return { id: userId, name: `User ${userId}`, source: 'PrimaryDB' };
  }

  async function fetchUserDataFromCache(
    error: Error,
    userId: string
  ): Promise<{ id: string; name: string; source: string }> {
    console.log(`Primary failed (${error.message}). Attempting to fetch user data for ${userId} from cache...`);
    await new Promise(resolve => setTimeout(resolve, 100));
    if (fallbackShouldFail) {
        console.error('Cache fetchUserData FAILED.');
        throw new Error('Cache service also unavailable');
    }
    return { id: userId, name: `User ${userId} (Cached)`, source: 'Cache' };
  }

  // Scenario 1: Primary fails, fallback succeeds
  console.log('\n--- Scenario 1: Primary Fails, Fallback Succeeds ---');
  try {
    const userData1 = await fallbackHandler.executeWithFallback(fetchUserData, fetchUserDataFromCache, 'user123');
    console.log('Final User Data (Scenario 1):', userData1);
  } catch (e: any) {
    console.error('Error in Scenario 1:', e.message);
  }

  // Scenario 2: Primary succeeds
  console.log('\n--- Scenario 2: Primary Succeeds ---');
  primaryShouldFail = false;
  try {
    const userData2 = await fallbackHandler.executeWithFallback(fetchUserData, fetchUserDataFromCache, 'user456');
    console.log('Final User Data (Scenario 2):', userData2);
  } catch (e: any) {
    console.error('Error in Scenario 2:', e.message);
  }

  // Scenario 3: Primary fails, fallback also fails
  console.log('\n--- Scenario 3: Primary Fails, Fallback Also Fails ---');
  primaryShouldFail = true;
  fallbackShouldFail = true;
  try {
    const userData3 = await fallbackHandler.executeWithFallback(fetchUserData, fetchUserDataFromCache, 'user789');
    console.log('Final User Data (Scenario 3):', userData3);
  } catch (e: any) {
    console.error('Error in Scenario 3:', e.message); // Should be the primary error
  }

  // Scenario 4: Primary fails with an error that should not trigger fallback
  console.log('\n--- Scenario 4: Primary Fails (No Fallback Expected) ---');
  primaryShouldFail = true;
  fallbackShouldFail = false; // Reset fallback
  async function operationWithValidationError(userId: string): Promise<any> {
      console.log(`Attempting operation for ${userId} that will cause validation error...`);
      await new Promise(resolve => setTimeout(resolve, 100));
      const validationError: any = new Error('Invalid user ID format');
      validationError.isValidationError = true; // Custom property used by shouldAttemptFallback
      console.error('Operation with validation error FAILED.');
      throw validationError;
  }
   try {
    const userData4 = await fallbackHandler.executeWithFallback(operationWithValidationError, fetchUserDataFromCache, 'invalid-user-id-format');
    console.log('Final User Data (Scenario 4):', userData4);
  } catch (e: any) {
    console.error('Error in Scenario 4:', e.message, e.isValidationError ? '(Validation Error)' : '');
  }
}

// To run the example:
// exampleFallbackUsage().catch(e => console.error("Example usage main error:", e));