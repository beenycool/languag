// src/renderer/workers/worker-pool.ts

import {
  WorkerInstance,
  WorkerTask,
  WorkerResponse,
  WorkerResponseType,
  AnalysisWorkerTask,
  AnalysisWorkerResponse,
  WorkerTaskType // Added import
} from './worker-types';

const DEFAULT_POOL_SIZE = Math.max(1, (navigator.hardwareConcurrency || 4) - 1);

interface TaskQueueItem<T, R> {
  task: WorkerTask<T>;
  resolve: (result: R) => void;
  reject: (error: any) => void;
  creationTime: number;
}

/**
 * Manages a pool of Web Workers to distribute tasks.
 */
export class WorkerPool {
  private workerInstances: WorkerInstance[] = [];
  private taskQueue: TaskQueueItem<any, any>[] = [];
  private nextWorkerId = 0;
  private workerScriptURL: string;
  private poolSize: number;
  private activeTasks = 0;

  constructor(workerScriptURL: string, poolSize: number = DEFAULT_POOL_SIZE) {
    this.workerScriptURL = workerScriptURL;
    this.poolSize = Math.max(1, poolSize); // Ensure at least one worker
    console.log(`WorkerPool: Initializing with pool size ${this.poolSize} for script ${workerScriptURL}`);
    this.initializePool();
  }

  private initializePool(): void {
    for (let i = 0; i < this.poolSize; i++) {
      this.addNewWorker();
    }
  }

  private addNewWorker(): WorkerInstance | null {
    if (this.workerInstances.length >= this.poolSize && this.poolSize !== 0) { // poolSize 0 for unlimited (not recommended generally)
        // console.warn("WorkerPool: Max pool size reached. Cannot add new worker.");
        return null;
    }
    try {
      const worker = new Worker(this.workerScriptURL, { type: 'module' }); // type: 'module' for ES module workers
      const workerId = this.nextWorkerId++;
      const instance: WorkerInstance = { worker, isBusy: false, id: workerId };

      worker.onmessage = (event: MessageEvent<WorkerResponse<any, any>>) => {
        this.handleWorkerMessage(instance, event.data);
      };

      worker.onerror = (error: ErrorEvent) => {
        this.handleWorkerError(instance, error);
      };
      this.workerInstances.push(instance);
      console.log(`WorkerPool: Worker ${workerId} created. Total workers: ${this.workerInstances.length}`);
      return instance;
    } catch (error) {
      console.error("WorkerPool: Failed to create new worker:", error);
      return null;
    }
  }

  private handleWorkerMessage(instance: WorkerInstance, response: WorkerResponse<any, any>): void {
    const { taskId, type, result, error } = response;

    if (type === WorkerResponseType.WORKER_READY) {
        console.log(`WorkerPool: Worker ${instance.id} reported ready.`);
        instance.isBusy = false; // Mark as ready for tasks
        this.dispatchNextTask();
        return;
    }
    
    const taskIndex = this.taskQueue.findIndex(item => item.task.taskId === taskId);

    // If the type is not WORKER_READY (already handled) and taskId is not in queue
    if (taskIndex === -1) {
      // This might happen if a task was cancelled or timed out but worker still processed it.
      // Or if it's a generic message not tied to a specific task in the queue (e.g. progress updates not yet handled this way)
      console.warn(`WorkerPool: Received message for unknown or completed task ID: ${taskId}`, response);
      // If it was a task that was running, ensure the worker is freed
      if (instance.isBusy) { // Check if this instance was the one running *a* task
          this.activeTasks--;
          instance.isBusy = false;
      }
      this.dispatchNextTask();
      return;
    }
    
    const taskItem = this.taskQueue.splice(taskIndex, 1)[0];
    this.activeTasks--;
    instance.isBusy = false;

    if (type === WorkerResponseType.TASK_COMPLETE) {
      taskItem.resolve(result);
    } else if (type === WorkerResponseType.TASK_ERROR) {
      taskItem.reject(error);
    } else if (type === WorkerResponseType.TASK_PROGRESS) {
      // TODO: Implement progress handling if needed (e.g., update UI)
      console.log(`WorkerPool: Task ${taskId} progress: ${response.progress}%`);
      // Note: A progress update should not remove the task from the queue or mark worker as not busy.
      // This part needs refinement if progress is actively used. For now, it assumes progress is part of final message or not used.
      // To handle intermediate progress, the task should remain in an "active" state, not spliced from queue yet.
      // For simplicity, this template assumes TASK_PROGRESS is not an intermediate message.
      // If it were, we'd need a way to identify the task without removing it from queue.
    }
    this.dispatchNextTask();
  }

  private handleWorkerError(instance: WorkerInstance, error: ErrorEvent): void {
    console.error(`WorkerPool: Error in Worker ${instance.id}:`, error.message, error);
    
    // Attempt to find a task that might have been running on this worker.
    // This is tricky because we don't directly map tasks to workers in this simple queue.
    // A more robust pool might maintain such a mapping.
    // For now, we'll reject the oldest task in the queue if this worker was busy.
    if (instance.isBusy) {
        this.activeTasks--;
        instance.isBusy = false; // Mark as not busy
        
        const oldestTask = this.taskQueue.shift(); // Take the oldest task
        if (oldestTask) {
            console.warn(`WorkerPool: Worker ${instance.id} errored. Rejecting task ${oldestTask.task.taskId} as a precaution.`);
            oldestTask.reject({ message: `Worker ${instance.id} failed: ${error.message}` });
        }
    }

    // Optionally, try to replace the failed worker
    console.log(`WorkerPool: Attempting to replace crashed worker ${instance.id}.`);
    this.workerInstances = this.workerInstances.filter(w => w.id !== instance.id);
    instance.worker.terminate(); // Ensure it's terminated
    this.addNewWorker(); // Try to maintain pool size

    this.dispatchNextTask(); // Try to dispatch any pending tasks
  }

  public submitTask<T, R>(taskPayload: T, type: string): Promise<R> {
    const taskId = `${type}-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
    const task: WorkerTask<T> = { taskId, type: type as any, payload: taskPayload };

    return new Promise<R>((resolve, reject) => {
      this.taskQueue.push({ task, resolve, reject, creationTime: Date.now() });
      this.dispatchNextTask();
    });
  }

  // Specific submitter for Analysis tasks for type safety
  public submitAnalysisTask(payload: AnalysisWorkerTask['payload']): Promise<AnalysisWorkerResponse['result']> {
    const taskId = `analysis-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
    const task: AnalysisWorkerTask = { taskId, type: WorkerTaskType.ANALYZE_CONTENT, payload };
    
    return new Promise((resolve, reject) => {
        this.taskQueue.push({ task, resolve, reject, creationTime: Date.now() });
        this.dispatchNextTask();
    });
  }


  private dispatchNextTask(): void {
    if (this.taskQueue.length === 0) {
      return; // No tasks to dispatch
    }

    let availableWorker: WorkerInstance | undefined = this.workerInstances.find(w => !w.isBusy);
    
    if (!availableWorker && this.workerInstances.length < this.poolSize) {
        // Try to create a new worker if below pool size and all are busy
        const newWorker = this.addNewWorker();
        if (newWorker) {
            availableWorker = newWorker;
        }
    }

    if (availableWorker) {
      const taskItem = this.taskQueue.shift(); // FIFO
      if (taskItem) {
        availableWorker.isBusy = true;
        this.activeTasks++;
        try {
            console.log(`WorkerPool: Dispatching task ${taskItem.task.taskId} to worker ${availableWorker.id}`);
            availableWorker.worker.postMessage(taskItem.task);
        } catch (error) {
            console.error(`WorkerPool: Error dispatching task ${taskItem.task.taskId} to worker ${availableWorker.id}:`, error);
            // Put task back in queue (or handle error differently)
            this.taskQueue.unshift(taskItem); 
            availableWorker.isBusy = false;
            this.activeTasks--;
            // Potentially try to recover or log critical failure
        }
      }
    } else {
        // console.log("WorkerPool: No available workers, task remains in queue.");
    }
  }

  public getTaskQueueSize(): number {
    return this.taskQueue.length;
  }

  public getActiveWorkerCount(): number {
    return this.workerInstances.filter(w => w.isBusy).length;
  }
  
  public getIdleWorkerCount(): number {
    return this.workerInstances.filter(w => !w.isBusy).length;
  }

  public getTotalWorkerCount(): number {
    return this.workerInstances.length;
  }

  public terminateAll(): void {
    console.log("WorkerPool: Terminating all workers.");
    this.workerInstances.forEach(instance => {
      instance.worker.terminate();
    });
    this.workerInstances = [];
    this.taskQueue.forEach(taskItem => taskItem.reject('Worker pool terminated.'));
    this.taskQueue = [];
    this.activeTasks = 0;
  }
}

// Example Usage:
// const analysisWorkerPool = new WorkerPool('./analysis-worker.js'); // Path to your compiled worker script
//
// async function runAnalysisOnContent(content: string, filePath: string) {
//   try {
//     const result = await analysisWorkerPool.submitAnalysisTask({ content, filePath });
//     console.log('Analysis complete:', result);
//   } catch (error) {
//     console.error('Analysis failed:', error);
//   }
// }