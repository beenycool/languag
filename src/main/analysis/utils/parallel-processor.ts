// src/main/analysis/utils/parallel-processor.ts

import appLogger from '../../services/logger';

const logger = appLogger.child({ utility: 'ParallelProcessor' });

/**
 * A utility class to process a list of asynchronous tasks in parallel.
 * It can be configured with a concurrency limit.
 *
 * @template TOutput The type of the output from each task. Each task should resolve to this type,
 *                   or an object of this type that includes an error field if an error occurred.
 */
export class ParallelProcessor<TOutput> {
  private concurrency: number;
  private defaultTaskTimeoutMs: number;

  /**
   * Creates an instance of ParallelProcessor.
   * @param concurrency The maximum number of tasks to run in parallel. Defaults to `navigator.hardwareConcurrency` or 4.
   * @param defaultTaskTimeoutMs Optional default timeout for each task in milliseconds. Defaults to 0 (no timeout).
   */
  constructor(concurrency?: number, defaultTaskTimeoutMs: number = 0) {
    this.concurrency = concurrency || (typeof navigator !== 'undefined' && navigator.hardwareConcurrency) || 4;
    this.defaultTaskTimeoutMs = defaultTaskTimeoutMs;
    logger.info(`Initialized with concurrency: ${this.concurrency}, default task timeout: ${defaultTaskTimeoutMs}ms`);
  }

  /**
   * Processes an array of task-creating functions in parallel.
   * Each function in the `taskCreators` array should return a Promise that resolves to TOutput.
   * TOutput itself should be structured to include an error field if a task fails.
   *
   * @param taskCreators An array of functions, where each function returns a Promise that resolves to TOutput.
   * @param perTaskTimeoutMs Optional timeout for each individual task, overriding the default.
   * @returns A Promise that resolves to an array of TOutput (or TOutput | Error if tasks can throw directly),
   *          maintaining the original order of tasks.
   *          It's recommended that TOutput includes an error field for task-specific errors.
   */
  async process(
    taskCreators: (() => Promise<TOutput>)[],
    perTaskTimeoutMs?: number
  ): Promise<TOutput[]> {
    if (!taskCreators || taskCreators.length === 0) {
      return [];
    }

    const taskTimeout = perTaskTimeoutMs !== undefined ? perTaskTimeoutMs : this.defaultTaskTimeoutMs;

    logger.debug(`Processing ${taskCreators.length} tasks with concurrency ${this.concurrency} and timeout ${taskTimeout}ms.`);
    // The results array will hold TOutput directly, as tasks are expected to return TOutput
    // with an error field if they fail, rather than throwing an error that changes the type.
    const results: Array<TOutput> = new Array(taskCreators.length);
    let currentIndex = 0;
    let runningTasks = 0;
    // This errors array is for catastrophic errors or direct rejections not handled by TOutput structure.
    const criticalErrors: Error[] = [];


    return new Promise<TOutput[]>((resolve) => {
      const runNextTask = () => {
        if (currentIndex >= taskCreators.length && runningTasks === 0) {
          if (criticalErrors.length > 0) {
            logger.error(`Parallel processing completed with ${criticalErrors.length} critical unhandled errors.`);
            // If tasks are designed to always return TOutput (with an error field),
            // criticalErrors should ideally be empty. If not, this indicates a problem.
            // For robustness, we still resolve with the results array, which might contain
            // undefined entries or TOutput error objects for failed tasks.
          }
          resolve(results); // Resolve with whatever results were collected.
          return;
        }

        while (runningTasks < this.concurrency && currentIndex < taskCreators.length) {
          const taskIndex = currentIndex;
          const taskCreator = taskCreators[taskIndex];
          currentIndex++;
          runningTasks++;

          logger.debug(`Starting task ${taskIndex + 1}/${taskCreators.length}`);
          
          let taskPromise = taskCreator();

          if (taskTimeout > 0) {
            const timeoutPromise = new Promise<TOutput>((_, rejectTimeout) =>
              setTimeout(() => rejectTimeout(new Error(`Task ${taskIndex + 1} timed out after ${taskTimeout}ms`)), taskTimeout)
            );
            taskPromise = Promise.race([taskPromise, timeoutPromise]);
          }

          taskPromise
            .then(result => {
              results[taskIndex] = result; // result is TOutput
              logger.debug(`Task ${taskIndex + 1} completed.`);
            })
            .catch(error => {
              logger.error(`Task ${taskIndex + 1} failed critically or timed out: ${error.message}`, { error });
              // This catch block is for errors that are not part of the TOutput structure
              // (e.g. network errors, timeouts, or if a task promise rejects directly).
              // We need to construct a TOutput-compatible error representation if possible,
              // or mark this task as failed in a way the caller expects.
              // For AnalysisResult, it has an 'error' field.
              // We'll assume TOutput is like { error?: string, ...otherProps }
              results[taskIndex] = {
                error: `Task failed: ${error.message}`,
                // Add other default/empty properties of TOutput if necessary
                // This is a simplification; a more robust solution might involve a factory for error TOutput objects.
              } as unknown as TOutput; // Cast needed if TOutput structure isn't known to have 'error'
              criticalErrors.push(error);
            })
            .finally(() => {
              runningTasks--;
              runNextTask();
            });
        }
      };

      runNextTask();
    });
  }
}