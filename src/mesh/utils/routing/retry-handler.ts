// src/mesh/utils/routing/retry-handler.ts
import { ILoggingService, LogLevel } from '../../../microservices/services/management/logging-service';
import { ConfigurationManager } from '../../core/control/configuration-manager'; // To fetch retry policies

export interface RetryPolicy {
  id: string; // Unique ID for the policy
  maxAttempts: number; // Maximum number of retry attempts
  backoffStrategy: 'FIXED' | 'EXPONENTIAL' | 'RANDOM_JITTER';
  initialIntervalMs: number; // Initial delay for FIXED or base for EXPONENTIAL
  maxIntervalMs?: number;   // Maximum delay for EXPONENTIAL
  multiplier?: number;      // Multiplier for EXPONENTIAL backoff (e.g., 2)
  retryOnHttpStatusCodes?: number[]; // e.g., [500, 502, 503, 504]
  retryOnGrpcStatusCodes?: string[]; // e.g., ['UNAVAILABLE', 'INTERNAL']
  // retryOnExceptions?: string[]; // Names of exception classes to retry on (harder to implement generically)
  // Add other conditions like retryOnConnectFailure, etc.
}

export interface IRetryHandler {
  /**
   * Executes an operation with retry logic based on a named policy.
   * @param operation - A function that returns a Promise representing the operation to execute.
   *                    The operation should throw an error or return a result indicating failure
   *                    that can be checked against the policy (e.g., HTTP status code in error object).
   * @param policyName - The name/ID of the retry policy to apply.
   * @param operationContext - Optional context for logging or identifying the operation.
   * @returns A Promise that resolves with the operation's successful result, or rejects if all retries fail.
   */
  executeWithRetries<T>(
    operation: (attempt: number) => Promise<T>,
    policyName: string,
    operationContext?: Record<string, any>
  ): Promise<T>;

  // loadRetryPolicies(): Promise<void>; // If policies are loaded dynamically
}

/**
 * Handles retry logic for operations based on configurable policies.
 */
export class RetryHandler implements IRetryHandler {
  private logger?: ILoggingService;
  private configManager: ConfigurationManager;
  private policies: Map<string, RetryPolicy>; // In-memory cache of policies

  constructor(configManager: ConfigurationManager, logger?: ILoggingService) {
    this.logger = logger;
    this.configManager = configManager;
    this.policies = new Map();
    this.log(LogLevel.INFO, 'RetryHandler initialized.');
    // this.loadRetryPolicies().catch(err => this.log(LogLevel.ERROR, "Failed to load initial retry policies", { error: err.message }));
  }

  private log(level: LogLevel, message: string, context?: any) {
    this.logger?.log(level, `[RetryHandler] ${message}`, context);
  }

  public async loadRetryPolicies(): Promise<void> { // Made public for explicit loading if needed
    this.log(LogLevel.INFO, 'Loading retry policies...');
    try {
      const config = await this.configManager.getGlobalConfig(); // Assume policies are global for now
      if (config && config.retryPolicies && Array.isArray(config.retryPolicies)) {
        this.policies.clear(); // Clear old policies
        (config.retryPolicies as RetryPolicy[]).forEach(policy => {
          if (policy.id) {
            this.policies.set(policy.id, policy);
          } else {
            this.log(LogLevel.WARN, "Found retry policy without an ID, skipping.", { policy });
          }
        });
        this.log(LogLevel.INFO, `Successfully loaded ${this.policies.size} retry policies.`);
      } else {
        this.log(LogLevel.WARN, 'No retry policies found or in unexpected format.');
        this.policies.clear();
      }
    } catch (error: any) {
      this.log(LogLevel.ERROR, 'Failed to load retry policies', { error: error.message });
      this.policies.clear();
    }
  }

  private getPolicy(policyName: string): RetryPolicy | undefined {
    return this.policies.get(policyName);
  }

  private shouldRetry(error: any, policy: RetryPolicy): boolean {
    // Check HTTP status codes
    if (policy.retryOnHttpStatusCodes && error?.httpStatusCode && policy.retryOnHttpStatusCodes.includes(error.httpStatusCode)) {
      return true;
    }
    // Check gRPC status codes (assuming error object might have a grpcStatusCode field)
    if (policy.retryOnGrpcStatusCodes && error?.grpcStatusCode && policy.retryOnGrpcStatusCodes.includes(String(error.grpcStatusCode).toUpperCase())) {
      return true;
    }
    // Add more conditions here (e.g., specific exception types if possible, connection errors)
    // If no specific conditions match, and the policy is generic, it might retry on any error.
    // For now, if no specific code matches, we don't retry unless policy is very broad (not implemented here).
    // A common default is to retry on transient network errors or specific server errors.
    // If error is not an object or has no relevant status codes, assume not retryable by default for safety.
    if (typeof error !== 'object' || error === null) return false;

    // Fallback: if no specific retry conditions are met, don't retry.
    // A more advanced policy might have a default "retry on any server error" if not specified.
    // For now, explicit conditions must be met.
    return false; 
  }

  private calculateDelay(attempt: number, policy: RetryPolicy): number {
    let delay = policy.initialIntervalMs;
    switch (policy.backoffStrategy) {
      case 'EXPONENTIAL':
        delay = policy.initialIntervalMs * Math.pow(policy.multiplier || 2, attempt -1);
        if (policy.maxIntervalMs) {
          delay = Math.min(delay, policy.maxIntervalMs);
        }
        // Add jitter: +/- some percentage of delay
        const jitter = delay * 0.2 * (Math.random() * 2 - 1); // +/- 20% jitter
        delay += jitter;
        break;
      case 'FIXED':
        delay = policy.initialIntervalMs;
        break;
      case 'RANDOM_JITTER': // Fixed interval + random jitter up to initialInterval
        delay = policy.initialIntervalMs + Math.random() * policy.initialIntervalMs;
        break;
      default: // Defaults to fixed
        delay = policy.initialIntervalMs;
    }
    return Math.max(0, Math.round(delay)); // Ensure non-negative and integer
  }

  public async executeWithRetries<T>(
    operation: (attempt: number) => Promise<T>,
    policyName: string,
    operationContext?: Record<string, any>
  ): Promise<T> {
    const policy = this.getPolicy(policyName);
    if (!policy) {
      this.log(LogLevel.WARN, `Retry policy "${policyName}" not found. Executing operation once without retry.`, operationContext);
      return operation(1);
    }

    this.log(LogLevel.DEBUG, `Executing operation with retry policy: ${policyName}`, { policy, operationContext });
    let lastError: any;

    for (let attempt = 1; attempt <= policy.maxAttempts; attempt++) {
      try {
        this.log(LogLevel.TRACE, `Attempt ${attempt}/${policy.maxAttempts} for policy ${policyName}`, operationContext);
        return await operation(attempt);
      } catch (error: any) {
        lastError = error;
        this.log(LogLevel.WARN, `Attempt ${attempt}/${policy.maxAttempts} failed for policy ${policyName}. Error: ${error?.message || String(error)}`, { error, operationContext });

        if (attempt < policy.maxAttempts && this.shouldRetry(error, policy)) {
          const delayMs = this.calculateDelay(attempt, policy);
          this.log(LogLevel.INFO, `Retrying after ${delayMs}ms (attempt ${attempt + 1}/${policy.maxAttempts}) for policy ${policyName}.`, operationContext);
          await new Promise(resolve => setTimeout(resolve, delayMs));
        } else {
          this.log(LogLevel.ERROR, `All ${policy.maxAttempts} attempts failed or error not retryable for policy ${policyName}. Last error: ${error?.message || String(error)}`, { lastError, operationContext });
          throw lastError; // Re-throw the last error if all retries exhausted or error not retryable
        }
      }
    }
    // Should not be reached if maxAttempts > 0, as loop will throw or return.
    // But to satisfy TypeScript if maxAttempts could be 0 (though policy should prevent this).
    this.log(LogLevel.ERROR, `Exhausted retries for policy ${policyName} without success.`, { lastError, operationContext });
    throw lastError;
  }
}