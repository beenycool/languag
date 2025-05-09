/**
 * @file Manages a pool of worker processes for parallel task execution.
 */
import { ChildProcess } from 'child_process';
import { ProcessManager } from '../../common/process-manager';
import { ProcessConfig, ProcessId, ProcessState } from '../../types/process-types';
import { Message, MessageType } from '../../types/message-types';
// import { logger } from '../../../services/logger';
// import { ConfigManager } from '../../../services/config-manager'; // For pool configuration

export interface WorkerProcess extends ProcessConfig {
  // Additional properties specific to worker processes in the pool
  lastUsed?: number;
  taskCount?: number;
}

export interface ProcessPoolConfig {
  minWorkers: number;
  maxWorkers: number;
  workerConfigBase: Omit<ProcessConfig, 'id'>; // Base config for workers, ID will be generated
  idleTimeoutMs?: number; // Time before an idle worker is considered for termination
  maxTasksPerWorker?: number; // Max tasks before a worker is recycled
}

const DEFAULT_POOL_CONFIG: ProcessPoolConfig = {
  minWorkers: 1,
  maxWorkers: Math.max(1, require('os').cpus().length - 1), // Default to numCPUs - 1
  workerConfigBase: {
    name: 'worker-process',
    path: 'path/to/worker-script.js', // This MUST be configured
    args: [],
    env: {},
  },
  idleTimeoutMs: 60000, // 1 minute
  maxTasksPerWorker: 100,
};

export class ProcessPool {
  private processManager: ProcessManager;
  private config: ProcessPoolConfig;
  private availableWorkers: ProcessId[] = [];
  private busyWorkers: Map<ProcessId, number> = new Map(); // ProcessId -> active tasks
  private allWorkers: Map<ProcessId, WorkerProcess> = new Map();
  private workerCounter = 0;

  constructor(
    processManager: ProcessManager,
    poolConfig?: Partial<ProcessPoolConfig>
    // configManager?: ConfigManager
  ) {
    this.processManager = processManager;
    // const loadedConfig = configManager?.get('integration.processPool') || {};
    const loadedConfig = {}; // Placeholder
    this.config = { ...DEFAULT_POOL_CONFIG, ...loadedConfig, ...poolConfig };

    if (this.config.workerConfigBase.path === 'path/to/worker-script.js') {
        // logger.warn('ProcessPool: workerConfigBase.path is not configured. Using placeholder which will likely fail.');
        console.warn('ProcessPool: workerConfigBase.path is not configured. Using placeholder which will likely fail.');
    }

    // logger.info('ProcessPool initialized with config:', this.config);
    console.info('ProcessPool initialized with config:', this.config);
    this.initializePool();
  }

  private async initializePool(): Promise<void> {
    // logger.info(`Initializing process pool with ${this.config.minWorkers} workers.`);
    console.info(`Initializing process pool with ${this.config.minWorkers} workers.`);
    for (let i = 0; i < this.config.minWorkers; i++) {
      await this.addNewWorker();
    }
    // Start monitoring or cleanup tasks if needed
    // setInterval(() => this.maintainPool(), this.config.idleTimeoutMs / 2);
  }

  private async addNewWorker(): Promise<ProcessId | null> {
    if (this.allWorkers.size >= this.config.maxWorkers) {
      // logger.warn('ProcessPool: Max worker limit reached. Cannot add new worker.');
      console.warn('ProcessPool: Max worker limit reached. Cannot add new worker.');
      return null;
    }

    this.workerCounter++;
    const workerId = `worker-${this.config.workerConfigBase.name}-${this.workerCounter}`;
    const workerConfig: WorkerProcess = {
      ...this.config.workerConfigBase,
      id: workerId,
      taskCount: 0,
      lastUsed: Date.now(),
    };

    const startedId = await this.processManager.startProcess(workerConfig);
    if (startedId) {
      this.allWorkers.set(startedId, workerConfig);
      this.availableWorkers.push(startedId);
      // logger.info(`ProcessPool: Added new worker ${startedId}. Total workers: ${this.allWorkers.size}. Available: ${this.availableWorkers.length}`);
      console.info(`ProcessPool: Added new worker ${startedId}. Total workers: ${this.allWorkers.size}. Available: ${this.availableWorkers.length}`);
      return startedId;
    } else {
      // logger.error(`ProcessPool: Failed to start new worker with base config: ${workerConfig.name}`);
      console.error(`ProcessPool: Failed to start new worker with base config: ${workerConfig.name}`);
      return null;
    }
  }

  /**
   * Acquires an available worker from the pool.
   * If no worker is available and the pool is not at max capacity, a new worker may be started.
   * @returns A Promise resolving to the ProcessId of an available worker, or null if none can be acquired.
   */
  async acquireWorker(): Promise<ProcessId | null> {
    if (this.availableWorkers.length > 0) {
      const workerId = this.availableWorkers.shift()!;
      this.busyWorkers.set(workerId, (this.busyWorkers.get(workerId) || 0) + 1);
      const worker = this.allWorkers.get(workerId);
      if (worker) {
        worker.lastUsed = Date.now();
        worker.taskCount = (worker.taskCount || 0) + 1;
      }
      // logger.debug(`ProcessPool: Acquired worker ${workerId}. Available: ${this.availableWorkers.length}`);
      console.debug(`ProcessPool: Acquired worker ${workerId}. Available: ${this.availableWorkers.length}`);
      return workerId;
    }

    if (this.allWorkers.size < this.config.maxWorkers) {
      // logger.info('ProcessPool: No available workers, attempting to start a new one.');
      console.info('ProcessPool: No available workers, attempting to start a new one.');
      const newWorkerId = await this.addNewWorker();
      if (newWorkerId) {
        return this.acquireWorker(); // Recurse to acquire the newly added worker
      }
    }

    // logger.warn('ProcessPool: No worker available and max capacity reached or failed to start new worker.');
    console.warn('ProcessPool: No worker available and max capacity reached or failed to start new worker.');
    return null; // Or wait with a timeout if implementing a queue
  }

  /**
   * Releases a worker back to the pool.
   * @param workerId The ID of the worker to release.
   */
  releaseWorker(workerId: ProcessId): void {
    const tasks = (this.busyWorkers.get(workerId) || 1) - 1;
    if (tasks <= 0) {
      this.busyWorkers.delete(workerId);
      this.availableWorkers.push(workerId);
    } else {
      this.busyWorkers.set(workerId, tasks);
    }

    const worker = this.allWorkers.get(workerId);
    if (worker) {
      worker.lastUsed = Date.now();
      // Check if worker needs recycling
      if (this.config.maxTasksPerWorker && worker.taskCount && worker.taskCount >= this.config.maxTasksPerWorker) {
        // logger.info(`ProcessPool: Worker ${workerId} reached max tasks (${worker.taskCount}). Recycling.`);
        console.info(`ProcessPool: Worker ${workerId} reached max tasks (${worker.taskCount}). Recycling.`);
        this.recycleWorker(workerId);
        return; // Don't add to available if recycling
      }
    }
    // logger.debug(`ProcessPool: Released worker ${workerId}. Available: ${this.availableWorkers.length}. Busy: ${this.busyWorkers.size}`);
    console.debug(`ProcessPool: Released worker ${workerId}. Available: ${this.availableWorkers.length}. Busy: ${this.busyWorkers.size}`);
  }

  private async recycleWorker(workerId: ProcessId): Promise<void> {
    // logger.info(`ProcessPool: Recycling worker ${workerId}.`);
    console.info(`ProcessPool: Recycling worker ${workerId}.`);
    await this.processManager.stopProcess(workerId);
    this.allWorkers.delete(workerId);
    this.availableWorkers = this.availableWorkers.filter(id => id !== workerId);
    this.busyWorkers.delete(workerId);

    // Maintain minimum worker count
    if (this.allWorkers.size < this.config.minWorkers) {
      // logger.info('ProcessPool: Worker count below minimum due to recycling. Adding new worker.');
      console.info('ProcessPool: Worker count below minimum due to recycling. Adding new worker.');
      await this.addNewWorker();
    }
  }

  /**
   * Sends a message to a specific worker in the pool.
   * @param workerId The ID of the target worker.
   * @param message The message to send.
   * @returns True if the message was sent, false otherwise.
   */
  sendMessageToWorker<T>(workerId: ProcessId, message: Message<T>): boolean {
    if (!this.allWorkers.has(workerId)) {
      // logger.warn(`ProcessPool: Worker ${workerId} not found in pool. Cannot send message.`);
      console.warn(`ProcessPool: Worker ${workerId} not found in pool. Cannot send message.`);
      return false;
    }
    return this.processManager.sendMessage(workerId, message);
  }

  /**
   * Executes a task on a worker process. Acquires a worker, sends the task message,
   * and waits for a response message.
   * @param taskMessage The message representing the task to execute.
   * @param responseMessageType The expected MessageType of the response.
   * @param timeoutMs Timeout for waiting for the response.
   * @returns A Promise resolving to the response message.
   * @throws Error if no worker is available, task fails, or times out.
   */
  async executeTask<TaskPayload, ResponsePayload>(
    taskMessage: Omit<Message<TaskPayload>, 'header'> & { header?: Partial<Message<TaskPayload>['header']> },
    responseMessageType: MessageType, // e.g., MessageType.RESPONSE or a custom type
    timeoutMs: number = 10000
  ): Promise<Message<ResponsePayload>> {
    const workerId = await this.acquireWorker();
    if (!workerId) {
      throw new Error('ProcessPool: No worker available to execute task.');
    }

    const fullTaskMessage: Message<TaskPayload> = {
      header: {
        messageId: `task-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`,
        type: MessageType.COMMAND, // Assuming tasks are commands
        source: 'ProcessPool',
        target: String(workerId), // Ensure workerId is a string for message header
        timestamp: Date.now(),
        ...taskMessage.header,
      },
      payload: taskMessage.payload,
    };

    return new Promise<Message<ResponsePayload>>((resolve, reject) => {
      let responseListener: ((msg: Message<any>) => void) | null = null;
      const timer = setTimeout(() => {
        if (responseListener) {
          // Assuming processManager allows removing listeners or MessageBus handles it
          // this.processManager.unsubscribeFromWorkerMessages(workerId, responseListener);
        }
        this.releaseWorker(workerId);
        reject(new Error(`ProcessPool: Task on worker ${workerId} timed out after ${timeoutMs}ms.`));
      }, timeoutMs);

      responseListener = (responseMsg: Message<any>) => {
        if (responseMsg.header.correlationId === fullTaskMessage.header.messageId) {
          clearTimeout(timer);
          // this.processManager.unsubscribeFromWorkerMessages(workerId, responseListener); // Clean up
          this.releaseWorker(workerId);

          if (responseMsg.header.type === MessageType.ERROR) {
            // logger.error(`ProcessPool: Task on worker ${workerId} failed:`, responseMsg.payload);
            console.error(`ProcessPool: Task on worker ${workerId} failed:`, responseMsg.payload);
            reject(new Error(responseMsg.payload?.message || 'Task execution failed'));
          } else if (responseMsg.header.type === responseMessageType) {
            resolve(responseMsg as Message<ResponsePayload>);
          } else {
            // logger.warn(`ProcessPool: Received unexpected message type ${responseMsg.header.type} from worker ${workerId} for task ${fullTaskMessage.header.messageId}`);
            console.warn(`ProcessPool: Received unexpected message type ${responseMsg.header.type} from worker ${workerId} for task ${fullTaskMessage.header.messageId}`);
            // Not rejecting here, might be other messages, but timeout will eventually hit if expected one doesn't arrive.
          }
        }
      };

      // This assumes ProcessManager or MessageBus can route messages from workers
      // and allow subscription based on workerId or correlationId.
      // For simplicity, this part is conceptual. A real implementation needs robust message handling.
      // Example: this.messageBus.subscribeToWorker(workerId, responseListener);
      // Or: this.processManager.onMessageFrom(workerId, responseListener);
      // logger.debug(`ProcessPool: Subscribing for response from worker ${workerId} for task ${fullTaskMessage.header.messageId}`);
      console.debug(`ProcessPool: Subscribing for response from worker ${workerId} for task ${fullTaskMessage.header.messageId}`);


      const sent = this.sendMessageToWorker(workerId, fullTaskMessage);
      if (!sent) {
        clearTimeout(timer);
        // this.processManager.unsubscribeFromWorkerMessages(workerId, responseListener);
        this.releaseWorker(workerId);
        reject(new Error(`ProcessPool: Failed to send task to worker ${workerId}.`));
      }
    });
  }


  /**
   * Shuts down the process pool, stopping all worker processes.
   */
  async shutdown(): Promise<void> {
    // logger.info('ProcessPool: Shutting down all workers...');
    console.info('ProcessPool: Shutting down all workers...');
    const stopPromises: Promise<boolean>[] = [];
    this.allWorkers.forEach(worker => {
      stopPromises.push(this.processManager.stopProcess(worker.id));
    });
    await Promise.all(stopPromises);
    this.availableWorkers = [];
    this.busyWorkers.clear();
    this.allWorkers.clear();
    // logger.info('ProcessPool: Shutdown complete.');
    console.info('ProcessPool: Shutdown complete.');
  }

  // TODO: Implement maintainPool to handle idle timeouts and min/max worker adjustments.
  // private maintainPool(): void {
  //   const now = Date.now();
  //   // Scale down idle workers
  //   if (this.availableWorkers.length > this.config.minWorkers) {
  //     this.availableWorkers.forEach(workerId => {
  //       const worker = this.allWorkers.get(workerId);
  //       if (worker && worker.lastUsed && (now - worker.lastUsed > this.config.idleTimeoutMs!)) {
  //         if (this.allWorkers.size > this.config.minWorkers) {
  //           logger.info(`ProcessPool: Worker ${workerId} idle too long. Terminating.`);
  //           this.recycleWorker(workerId); // recycle also removes from available
  //         }
  //       }
  //     });
  //   }
  //   // TODO: Scale up if demand is high (requires tracking task queue or wait times)
  // }
}