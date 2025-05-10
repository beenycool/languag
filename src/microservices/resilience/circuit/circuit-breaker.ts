// src/microservices/resilience/circuit/circuit-breaker.ts

import { ILoggingService, LogLevel } from '../../services/management/logging-service'; // Optional for logging state changes

/**
 * @enum CircuitBreakerState
 * Represents the state of the circuit breaker.
 */
export enum CircuitBreakerState {
  CLOSED = 'CLOSED',   // Allows operations, monitors for failures.
  OPEN = 'OPEN',     // Rejects operations immediately, short-circuits.
  HALF_OPEN = 'HALF_OPEN', // Allows a limited number of trial operations to see if the underlying issue is resolved.
}

/**
 * @interface CircuitBreakerOptions
 * Configuration options for the circuit breaker.
 */
export interface CircuitBreakerOptions {
  failureThreshold: number; // Number of failures to open the circuit.
  successThreshold: number; // Number of successes in HALF_OPEN state to close the circuit.
  timeout: number;          // Duration (ms) the circuit stays OPEN before transitioning to HALF_OPEN.
  name?: string;            // Optional name for logging/identification.
  logger?: ILoggingService; // Optional logger instance.
  isFailure?: (error: any) => boolean; // Optional function to determine if an error should be considered a failure. Defaults to all errors.
  onStateChange?: (newState: CircuitBreakerState, oldState: CircuitBreakerState, name?: string) => void; // Callback for state changes
}

/**
 * @interface ICircuitBreaker
 * Defines the contract for a circuit breaker.
 */
export interface ICircuitBreaker {
  /**
   * Executes an operation protected by the circuit breaker.
   * @param operation - A function that returns a Promise representing the operation to execute.
   * @returns A Promise that resolves or rejects based on the operation's outcome and circuit state.
   * @throws Error if the circuit is OPEN or if the operation fails and trips the circuit.
   */
  execute<T>(operation: () => Promise<T>): Promise<T>;

  /**
   * Gets the current state of the circuit breaker.
   */
  getState(): CircuitBreakerState;

  /**
   * Manually opens the circuit.
   */
  open(): void;

  /**
   * Manually closes the circuit, resetting failure counts.
   */
  close(): void;

  /**
   * Manually forces the circuit into a half-open state.
   * (Use with caution, typically managed internally).
   */
  halfOpen(): void;
}

const DEFAULT_OPTIONS: Required<Omit<CircuitBreakerOptions, 'name' | 'logger' | 'isFailure' | 'onStateChange'>> = {
  failureThreshold: 5,
  successThreshold: 2,
  timeout: 10000, // 10 seconds
};

/**
 * @class CircuitBreaker
 * Implements the circuit breaker pattern to prevent repeated calls to a failing service.
 */
export class CircuitBreaker implements ICircuitBreaker {
  private state: CircuitBreakerState;
  private options: Required<Omit<CircuitBreakerOptions, 'name' | 'logger' | 'isFailure' | 'onStateChange'>> & Pick<CircuitBreakerOptions, 'name' | 'logger' | 'isFailure' | 'onStateChange'>;
  private failureCount: number;
  private successCount: number;
  private lastFailureTime: number | null;
  private halfOpenTimer: NodeJS.Timeout | null;

  constructor(options?: Partial<CircuitBreakerOptions>) {
    this.options = { ...DEFAULT_OPTIONS, ...options };
    this.state = CircuitBreakerState.CLOSED;
    this.failureCount = 0;
    this.successCount = 0;
    this.lastFailureTime = null;
    this.halfOpenTimer = null;
    this.log(LogLevel.INFO, `CircuitBreaker "${this.options.name || 'Unnamed'}" initialized. State: ${this.state}`);
  }

  private log(level: LogLevel, message: string, context?: Record<string, any>): void {
    if (this.options.logger) {
      this.options.logger.log(level, `[CB:${this.options.name || 'Unnamed'}] ${message}`, context);
    } else if (level === LogLevel.ERROR || level === LogLevel.WARN) {
      (level === LogLevel.ERROR ? console.error : console.warn)(`[CB:${this.options.name || 'Unnamed'}] ${message}`, context || '');
    } else {
      // console.log(`[CB:${this.options.name || 'Unnamed'}] ${message}`, context || '');
    }
  }

  private setState(newState: CircuitBreakerState): void {
    if (this.state === newState) return;

    const oldState = this.state;
    this.state = newState;
    this.log(LogLevel.WARN, `State changed from ${oldState} to ${newState}.`);

    if (this.options.onStateChange) {
        try {
            this.options.onStateChange(newState, oldState, this.options.name);
        } catch (e) {
            this.log(LogLevel.ERROR, 'Error in onStateChange callback', { error: e });
        }
    }

    switch (newState) {
      case CircuitBreakerState.CLOSED:
        this.resetCounts();
        if (this.halfOpenTimer) clearTimeout(this.halfOpenTimer);
        break;
      case CircuitBreakerState.OPEN:
        this.successCount = 0; // Reset success count when opening
        this.lastFailureTime = Date.now();
        this.scheduleHalfOpen();
        break;
      case CircuitBreakerState.HALF_OPEN:
        this.successCount = 0; // Reset success count for trial requests
        // Failure count is not reset here, it's reset if HALF_OPEN succeeds
        if (this.halfOpenTimer) clearTimeout(this.halfOpenTimer); // Stop previous timer if any
        break;
    }
  }

  private scheduleHalfOpen(): void {
    if (this.halfOpenTimer) clearTimeout(this.halfOpenTimer);
    this.halfOpenTimer = setTimeout(() => {
      this.setState(CircuitBreakerState.HALF_OPEN);
    }, this.options.timeout);
    this.log(LogLevel.INFO, `Scheduled transition to HALF_OPEN in ${this.options.timeout}ms.`);
  }

  private resetCounts(): void {
    this.failureCount = 0;
    this.successCount = 0;
    this.lastFailureTime = null;
  }

  private recordSuccess(): void {
    if (this.state === CircuitBreakerState.HALF_OPEN) {
      this.successCount++;
      this.log(LogLevel.DEBUG, `Success recorded in HALF_OPEN state. Count: ${this.successCount}/${this.options.successThreshold}`);
      if (this.successCount >= this.options.successThreshold) {
        this.log(LogLevel.INFO, 'Threshold for successes in HALF_OPEN met. Closing circuit.');
        this.setState(CircuitBreakerState.CLOSED);
      }
    } else if (this.state === CircuitBreakerState.CLOSED) {
      // Optionally reset failure count on success in CLOSED state, or let it decay
      // For simplicity, we reset it here.
      if (this.failureCount > 0) {
        this.log(LogLevel.DEBUG, 'Success recorded in CLOSED state. Resetting failure count.');
        this.resetCounts();
      }
    }
  }

  private recordFailure(error: any): void {
    // Check if this error type should be considered a failure
    if (this.options.isFailure && !this.options.isFailure(error)) {
      this.log(LogLevel.DEBUG, 'Error occurred but not considered a failure by custom logic.', { error });
      return; // Don't count this as a failure for tripping the circuit
    }

    this.failureCount++;
    this.lastFailureTime = Date.now();
    this.log(LogLevel.WARN, `Failure recorded. Count: ${this.failureCount}/${this.options.failureThreshold}`, { error: error?.message });

    if (this.state === CircuitBreakerState.HALF_OPEN) {
      this.log(LogLevel.WARN, 'Failure in HALF_OPEN state. Re-opening circuit.');
      this.setState(CircuitBreakerState.OPEN);
    } else if (this.state === CircuitBreakerState.CLOSED && this.failureCount >= this.options.failureThreshold) {
      this.log(LogLevel.ERROR, 'Failure threshold met in CLOSED state. Opening circuit.');
      this.setState(CircuitBreakerState.OPEN);
    }
  }

  public async execute<T>(operation: () => Promise<T>): Promise<T> {
    if (this.state === CircuitBreakerState.OPEN) {
      // Check if timeout has passed to transition to HALF_OPEN
      // This is usually handled by the timer, but as a safeguard:
      if (this.lastFailureTime && (Date.now() - this.lastFailureTime) > this.options.timeout) {
          this.log(LogLevel.INFO, 'Open state timeout passed during execute call, transitioning to HALF_OPEN.');
          this.setState(CircuitBreakerState.HALF_OPEN);
          // Fall through to HALF_OPEN logic
      } else {
        this.log(LogLevel.ERROR, 'Circuit is OPEN. Operation rejected.');
        throw new Error(`CircuitBreaker "${this.options.name || 'Unnamed'}" is OPEN. Operation rejected.`);
      }
    }

    if (this.state === CircuitBreakerState.HALF_OPEN) {
      // Allow one trial request. More sophisticated HALF_OPEN might allow N requests.
      // For simplicity, any call in HALF_OPEN is a trial.
      this.log(LogLevel.INFO, 'Circuit is HALF_OPEN. Attempting trial operation.');
    }

    try {
      const result = await operation();
      this.recordSuccess();
      return result;
    } catch (error: any) {
      this.recordFailure(error);
      throw error; // Re-throw the original error
    }
  }

  public getState(): CircuitBreakerState {
    return this.state;
  }

  public open(): void {
    this.log(LogLevel.WARN, 'Circuit manually opened.');
    this.setState(CircuitBreakerState.OPEN);
  }

  public close(): void {
    this.log(LogLevel.WARN, 'Circuit manually closed.');
    this.setState(CircuitBreakerState.CLOSED);
  }

  public halfOpen(): void {
    this.log(LogLevel.WARN, 'Circuit manually set to HALF_OPEN.');
    this.setState(CircuitBreakerState.HALF_OPEN);
  }

  /**
   * Cleans up any timers.
   */
  public dispose(): void {
    if (this.halfOpenTimer) {
      clearTimeout(this.halfOpenTimer);
      this.halfOpenTimer = null;
    }
    this.log(LogLevel.INFO, 'CircuitBreaker disposed.');
  }
}

// Example Usage:
async function exampleUsage() {
  const cb = new CircuitBreaker({
    name: 'MyServiceCB',
    failureThreshold: 2,
    successThreshold: 1,
    timeout: 3000, // 3 seconds
    // logger: new LoggingService() // Assuming LoggingService is set up
    onStateChange: (newState, oldState, name) => {
        console.log(`CALLBACK: Circuit Breaker "${name}" changed from ${oldState} to ${newState}`);
    }
  });

  let callCount = 0;
  async function potentiallyFailingOperation(): Promise<string> {
    callCount++;
    console.log(`Attempting operation (call #${callCount}). Current CB state: ${cb.getState()}`);
    return new Promise((resolve, reject) => {
      setTimeout(() => {
        if (callCount <= 2) { // Fail first 2 times
          console.error(`Operation call #${callCount} FAILED.`);
          reject(new Error(`Simulated failure #${callCount}`));
        } else if (callCount === 3 && cb.getState() === CircuitBreakerState.HALF_OPEN) { // Fail once in half-open
          console.error(`Operation call #${callCount} (HALF_OPEN trial) FAILED.`);
          reject(new Error(`Simulated HALF_OPEN failure #${callCount}`));
        }
        else {
          console.log(`Operation call #${callCount} SUCCEEDED.`);
          resolve(`Success on call #${callCount}`);
        }
      }, 500);
    });
  }

  for (let i = 0; i < 10; i++) {
    try {
      console.log(`\n--- Iteration ${i + 1} ---`);
      const result = await cb.execute(potentiallyFailingOperation);
      console.log(`Result from execute: ${result}`);
    } catch (e: any) {
      console.error(`Error from execute: ${e.message}`);
    }
    await new Promise(resolve => setTimeout(resolve, 1000)); // Wait 1 second between attempts
    if (i === 4) { // After some failures and open state
        console.log("Waiting for CB timeout to allow HALF_OPEN...");
        await new Promise(resolve => setTimeout(resolve, cb['options'].timeout + 500)); // Wait for timeout + buffer
    }
  }
  cb.dispose();
}

// To run the example:
// exampleUsage().catch(e => console.error("Example usage main error:", e));