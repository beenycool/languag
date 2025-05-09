// Implements strategies for recovering from non-fatal errors or attempting graceful degradation.
// TODO: Integrate with feature flags or configuration to enable/disable recovery strategies.
// TODO: Add more sophisticated retry mechanisms (e.g., exponential backoff with jitter).

import { ErrorReporter } from '../reporting/error-reporter';
// import { LogManager, LogLevel } from '../../logging/core/log-manager';

export type RecoveryAction = 'retry' | 'fallback' | 'ignore' | 'escalate' | 'restart_component';

export interface RecoveryAttempt {
  error: Error | any;
  timestamp: Date;
  actionTaken: RecoveryAction;
  details?: Record<string, any>;
  success?: boolean; // Was the recovery action successful?
}

export interface RecoveryStrategy {
  canHandle(error: Error | any, context?: Record<string, any>): boolean;
  attemptRecovery(error: Error | any, context?: Record<string, any>): Promise<RecoveryAttempt>;
}

export class RecoveryHandler {
  private errorReporter: ErrorReporter;
  // private logger: LogManager;
  private strategies: RecoveryStrategy[] = [];
  private recoveryHistory: RecoveryAttempt[] = [];

  constructor(errorReporter: ErrorReporter) {
    this.errorReporter = errorReporter;
    // this.logger = LogManager.getInstance();
    // Add default strategies or allow them to be registered
  }

  public addStrategy(strategy: RecoveryStrategy): void {
    this.strategies.unshift(strategy); // Add to the beginning to allow overriding general strategies
  }

  /**
   * Attempts to handle an error using registered recovery strategies.
   * If a strategy handles it, its recovery attempt is recorded.
   * If no strategy handles it, or recovery fails, the error can be re-thrown or escalated.
   * @param error The error object or value.
   * @param context Additional context about the error.
   * @param rethrowIfNotHandled If true, and no strategy successfully recovers, the original error is re-thrown.
   * @returns True if a recovery action was successfully attempted, false otherwise.
   */
  public async tryRecover(
    error: Error | any,
    context?: Record<string, any>,
    rethrowIfNotHandled: boolean = false
  ): Promise<boolean> {
    // this.logger.warn('Attempting recovery for error:', error, context);

    for (const strategy of this.strategies) {
      if (strategy.canHandle(error, context)) {
        // this.logger.info(`Strategy ${strategy.constructor.name} can handle the error. Attempting recovery.`);
        try {
          const attempt = await strategy.attemptRecovery(error, context);
          this.recordAttempt(attempt);
          if (attempt.success) {
            // this.logger.info(`Recovery successful via ${strategy.constructor.name}. Action: ${attempt.actionTaken}`, attempt.details);
            return true; // Recovery was successful
          } else {
            // this.logger.warn(`Recovery attempt by ${strategy.constructor.name} failed. Action: ${attempt.actionTaken}`, attempt.details);
            // Continue to next strategy or fail
          }
        } catch (recoveryError: any) {
          // this.logger.error(`Error during recovery attempt by ${strategy.constructor.name}`, recoveryError, { originalError: error });
          this.recordAttempt({
            error: recoveryError,
            timestamp: new Date(),
            actionTaken: 'escalate', // Recovery itself failed
            details: { strategy: strategy.constructor.name, originalError: error },
            success: false,
          });
          // The recovery strategy itself threw an error, report this new error
          this.errorReporter.reportError(recoveryError, {
            originalError: error,
            recoveryStrategy: strategy.constructor.name,
          }, { severity: 'error', recoveryFailure: true });
        }
      }
    }

    // If no strategy handled it or all failed attempts were not successful
    // this.logger.error('No recovery strategy successfully handled the error.', error, context);
    if (rethrowIfNotHandled) {
      throw error; // Re-throw the original error
    }
    return false; // No successful recovery
  }

  private recordAttempt(attempt: RecoveryAttempt): void {
    this.recoveryHistory.push(attempt);
    if (this.recoveryHistory.length > 100) { // Keep a limited history
      this.recoveryHistory.shift();
    }
  }

  public getRecoveryHistory(): RecoveryAttempt[] {
    return [...this.recoveryHistory];
  }
}

// --- Example Recovery Strategies (could be in separate files) ---

/**
 * A simple retry strategy.
 */
export class RetryStrategy implements RecoveryStrategy {
  private maxRetries: number;
  private delayMs: number;

  constructor(maxRetries: number = 3, delayMs: number = 1000) {
    this.maxRetries = maxRetries;
    this.delayMs = delayMs;
  }

  canHandle(error: any, context?: Record<string, any>): boolean {
    // Can handle if context suggests retrying is viable (e.g., network error, specific error codes)
    return context?.isRetryable === true || (error instanceof Error && error.message.toLowerCase().includes('network'));
  }

  async attemptRecovery(error: any, context?: Record<string, any>): Promise<RecoveryAttempt> {
    const operation = context?.operation as (() => Promise<any>) | undefined;
    if (!operation) {
      return { error, timestamp: new Date(), actionTaken: 'retry', details: { message: 'No operation provided for retry.' }, success: false };
    }

    for (let i = 0; i < this.maxRetries; i++) {
      // console.log(`Retry attempt ${i + 1}/${this.maxRetries} for: ${context?.operationName || 'operation'}`);
      try {
        await new Promise(resolve => setTimeout(resolve, this.delayMs * (i + 1))); // Incremental backoff
        const result = await operation();
        return { error, timestamp: new Date(), actionTaken: 'retry', details: { retries: i + 1, result }, success: true };
      } catch (retryError) {
        if (i === this.maxRetries - 1) { // Last retry failed
          return { error: retryError, timestamp: new Date(), actionTaken: 'retry', details: { retries: i + 1, finalError: retryError }, success: false };
        }
      }
    }
    // Should not be reached if loop logic is correct
    return { error, timestamp: new Date(), actionTaken: 'retry', details: { message: 'Max retries reached, but loop logic error.' }, success: false };
  }
}

/**
 * A fallback strategy for a known optional feature.
 */
export class FallbackStrategy implements RecoveryStrategy {
  private featureName: string;
  private fallbackValue: any;

  constructor(featureName: string, fallbackValue: any = null) {
    this.featureName = featureName;
    this.fallbackValue = fallbackValue;
  }

  canHandle(error: any, context?: Record<string, any>): boolean {
    return context?.feature === this.featureName && context?.isOptional === true;
  }

  async attemptRecovery(error: any, context?: Record<string, any>): Promise<RecoveryAttempt> {
    // console.warn(`Feature '${this.featureName}' failed. Using fallback value. Error:`, error);
    return {
      error,
      timestamp: new Date(),
      actionTaken: 'fallback',
      details: { feature: this.featureName, fallbackValue: this.fallbackValue, originalError: error },
      success: true, // Fallback is considered a "successful" recovery in this context
    };
  }
}

// Usage Example:
// const reporter = new ErrorReporter(); // ... setup reporter
// const recovery = new RecoveryHandler(reporter);
// recovery.addStrategy(new RetryStrategy());
// recovery.addStrategy(new FallbackStrategy('optionalAnalytics', { data: 'unavailable' }));

// async function someRiskyOperation() {
//   // ...
//   throw new Error("Network failed!");
// }

// async function main() {
//   try {
//     await someRiskyOperation();
//   } catch (e) {
//     const recovered = await recovery.tryRecover(e, {
//       isRetryable: true,
//       operationName: 'someRiskyOperation',
//       operation: someRiskyOperation // Pass the function to retry
//     }, true); // Rethrow if not handled
//     if (!recovered) {
//       // Error was not handled by recovery, or rethrown
//       console.error("Main: Operation failed permanently after recovery attempts.", e);
//     }
//   }
// }