// src/microservices/resilience/stability/bulkhead.ts

import { ILoggingService, LogLevel } from '../../services/management/logging-service'; // Optional

/**
 * @interface BulkheadOptions
 * Configuration options for a bulkhead.
 */
export interface BulkheadOptions {
  /** Maximum number of concurrent executions allowed. */
  maxConcurrent: number;
  /** Maximum number of requests that can be queued if all concurrent slots are busy. 0 means no queue. */
  maxQueueSize?: number;
  /** Timeout (ms) for waiting in the queue. If 0 or undefined, wait indefinitely (if queue exists). */
  queueTimeoutMs?: number;
  /** Optional logger instance. */
  logger?: ILoggingService;
  /** Optional name for logging/identification. */
  bulkheadName?: string;
}

/**
 * @interface IBulkhead
 * Defines the contract for a bulkhead, limiting concurrent executions.
 */
export interface IBulkhead {
  /**
   * Executes an operation protected by the bulkhead.
   * If all concurrent slots are busy, the request might be queued (if configured) or rejected.
   * @param operation - A function that returns a Promise representing the operation to execute.
   * @returns A Promise that resolves or rejects based on the operation's outcome.
   * @throws Error if the bulkhead is full and queue (if any) is full or times out, or if operation itself fails.
   */
  execute<T>(operation: () => Promise<T>): Promise<T>;

  /**
   * Gets the current number of executing operations.
   */
  getExecutingCount(): number;

  /**
   * Gets the current number of queued requests.
   */
  getQueueCount(): number;

  /**
   * Gets the number of available slots for execution.
   */
  getAvailableSlots(): number;
}

const DEFAULT_BULKHEAD_OPTIONS: Required<Omit<BulkheadOptions, 'logger' | 'bulkheadName' | 'queueTimeoutMs'>> & Pick<BulkheadOptions, 'queueTimeoutMs'> = {
  maxConcurrent: 10,
  maxQueueSize: 0, // No queue by default
  queueTimeoutMs: undefined, // Wait indefinitely if queue exists
};

/**
 * @class Bulkhead
 * Implements the bulkhead pattern to limit concurrent calls to a resource or operation,
 * preventing cascading failures.
 */
export class Bulkhead implements IBulkhead {
  private options: Required<Omit<BulkheadOptions, 'logger' | 'bulkheadName' | 'queueTimeoutMs'>> & Pick<BulkheadOptions, 'logger' | 'bulkheadName' | 'queueTimeoutMs'>;
  private executingCount: number;
  private queue: { operation: () => Promise<any>; resolve: (value: any) => void; reject: (reason?: any) => void; timeoutId?: NodeJS.Timeout }[];

  constructor(options: Partial<BulkheadOptions> & { maxConcurrent: number }) {
    this.options = { ...DEFAULT_BULKHEAD_OPTIONS, ...options };
    this.executingCount = 0;
    this.queue = [];
    this.log(LogLevel.INFO, `Bulkhead "${this.options.bulkheadName || 'Unnamed'}" initialized. Max concurrent: ${this.options.maxConcurrent}, Max queue: ${this.options.maxQueueSize}.`);
  }

  private log(level: LogLevel, message: string, context?: Record<string, any>): void {
    if (this.options.logger) {
      this.options.logger.log(level, `[Bulkhead:${this.options.bulkheadName || 'Unnamed'}] ${message}`, context);
    } else if (level === LogLevel.ERROR || level === LogLevel.WARN) {
      (level === LogLevel.ERROR ? console.error : console.warn)(`[Bulkhead:${this.options.bulkheadName || 'Unnamed'}] ${message}`, context || '');
    }
  }

  public getExecutingCount(): number {
    return this.executingCount;
  }

  public getQueueCount(): number {
    return this.queue.length;
  }

  public getAvailableSlots(): number {
    return this.options.maxConcurrent - this.executingCount;
  }

  private tryProcessNextInQueue(): void {
    if (this.executingCount >= this.options.maxConcurrent || this.queue.length === 0) {
      return; // Cannot process more or queue is empty
    }

    const nextItem = this.queue.shift();
    if (nextItem) {
      if (nextItem.timeoutId) {
        clearTimeout(nextItem.timeoutId); // Clear the queue timeout if it hasn't fired
      }
      this.log(LogLevel.DEBUG, 'Dequeuing operation.');
      this.executeInternal(nextItem.operation, nextItem.resolve, nextItem.reject);
    }
  }

  private async executeInternal<T>(
    operation: () => Promise<T>,
    resolve: (value: T) => void,
    reject: (reason?: any) => void
  ): Promise<void> {
    this.executingCount++;
    this.log(LogLevel.DEBUG, `Starting operation. Executing: ${this.executingCount}/${this.options.maxConcurrent}.`);
    try {
      const result = await operation();
      resolve(result);
    } catch (error) {
      reject(error);
    } finally {
      this.executingCount--;
      this.log(LogLevel.DEBUG, `Operation finished. Executing: ${this.executingCount}/${this.options.maxConcurrent}.`);
      this.tryProcessNextInQueue();
    }
  }

  public execute<T>(operation: () => Promise<T>): Promise<T> {
    return new Promise<T>((resolve, reject) => {
      if (this.executingCount < this.options.maxConcurrent) {
        this.executeInternal(operation, resolve, reject);
      } else if (this.options.maxQueueSize > 0 && this.queue.length < this.options.maxQueueSize) {
        this.log(LogLevel.INFO, `Bulkhead full, queuing operation. Queue size: ${this.queue.length + 1}/${this.options.maxQueueSize}.`);
        const queueItem = { operation, resolve, reject, timeoutId: undefined as NodeJS.Timeout | undefined };

        if (this.options.queueTimeoutMs && this.options.queueTimeoutMs > 0) {
          queueItem.timeoutId = setTimeout(() => {
            // Remove from queue and reject if still there
            const index = this.queue.indexOf(queueItem);
            if (index !== -1) {
              this.queue.splice(index, 1);
              const errMsg = `Operation timed out in bulkhead queue after ${this.options.queueTimeoutMs}ms.`;
              this.log(LogLevel.WARN, errMsg);
              reject(new Error(errMsg));
            }
          }, this.options.queueTimeoutMs);
        }
        this.queue.push(queueItem);

      } else {
        const errMsg = `Bulkhead "${this.options.bulkheadName || 'Unnamed'}" is full. Max concurrent: ${this.options.maxConcurrent}, Queue: ${this.queue.length}/${this.options.maxQueueSize}. Operation rejected.`;
        this.log(LogLevel.ERROR, errMsg);
        reject(new Error(errMsg));
      }
    });
  }

  /**
   * Clears the queue of pending operations. Rejected promises will be triggered for queued items.
   * Does not affect currently executing operations.
   */
  public clearQueue(rejectionReason: string = 'Bulkhead queue cleared administratively.'): void {
    this.log(LogLevel.WARN, `Clearing bulkhead queue. ${this.queue.length} items will be rejected.`, { reason: rejectionReason });
    while(this.queue.length > 0) {
        const item = this.queue.shift();
        if (item) {
            if (item.timeoutId) clearTimeout(item.timeoutId);
            item.reject(new Error(rejectionReason));
        }
    }
  }
}


// Example Usage:
async function exampleBulkheadUsage() {
  // const logger = new LoggingService();
  // await logger.addTransport(new ConsoleTransport());
  // logger.setLogLevel(LogLevel.DEBUG);

  const bulkhead = new Bulkhead({
    maxConcurrent: 2,
    maxQueueSize: 2,
    queueTimeoutMs: 2000, // 2 seconds queue timeout
    bulkheadName: 'ResourceIntensiveOp',
    // logger
  });

  let operationIdCounter = 0;
  async function resourceIntensiveOperation(durationMs: number): Promise<string> {
    const opId = ++operationIdCounter;
    console.log(`[Op-${opId}] Starting operation (will take ${durationMs}ms). Executing: ${bulkhead.getExecutingCount()}, Queued: ${bulkhead.getQueueCount()}`);
    await new Promise(resolve => setTimeout(resolve, durationMs));
    console.log(`[Op-${opId}] Finished operation.`);
    return `Operation ${opId} completed successfully after ${durationMs}ms.`;
  }

  const promises: Promise<string>[] = [];

  // Launch 5 operations. Max 2 concurrent, max 2 in queue. 1 should be rejected immediately or after queue timeout.
  console.log('\n--- Launching 5 operations ---');
  for (let i = 0; i < 5; i++) {
    promises.push(
      bulkhead.execute(() => resourceIntensiveOperation(1500 + Math.random() * 1000))
        .then(result => {
          console.log(`SUCCESS: ${result}`);
          return result;
        })
        .catch(error => {
          console.error(`FAILURE: ${error.message}`);
          return `Error: ${error.message}`;
        })
    );
    await new Promise(r => setTimeout(r, 100)); // Stagger launches slightly
  }


  console.log('\nWaiting for all launched operations to settle...');
  const results = await Promise.allSettled(promises);
  console.log('\n--- All operations settled ---');
  results.forEach((result, index) => {
    if (result.status === 'fulfilled') {
      console.log(`Result for call ${index + 1}: Fulfilled - ${result.value}`);
    } else {
      console.log(`Result for call ${index + 1}: Rejected - ${result.reason}`);
    }
  });

  console.log(`\nFinal state: Executing: ${bulkhead.getExecutingCount()}, Queued: ${bulkhead.getQueueCount()}`);

  // Example of queue timeout
  console.log('\n--- Testing Queue Timeout ---');
  const bulkheadQuickTimeout = new Bulkhead({ maxConcurrent: 1, maxQueueSize: 1, queueTimeoutMs: 500, bulkheadName: 'QuickTimeoutTest'});
  const opPromises: Promise<any>[] = [];
  opPromises.push(bulkheadQuickTimeout.execute(() => resourceIntensiveOperation(2000)).catch(e => console.error("Op1 Error:", e.message))); // Occupies the slot
  await new Promise(r => setTimeout(r, 50));
  opPromises.push(bulkheadQuickTimeout.execute(() => resourceIntensiveOperation(500)).catch(e => console.error("Op2 (queued) Error:", e.message))); // Queued, should timeout
  opPromises.push(bulkheadQuickTimeout.execute(() => resourceIntensiveOperation(500)).catch(e => console.error("Op3 (rejected) Error:", e.message))); // Should be rejected (queue full)

  await Promise.allSettled(opPromises);
  console.log(`QuickTimeoutTest Final state: Executing: ${bulkheadQuickTimeout.getExecutingCount()}, Queued: ${bulkheadQuickTimeout.getQueueCount()}`);


}

// To run the example:
// exampleBulkheadUsage().catch(e => console.error("Example usage main error:", e));