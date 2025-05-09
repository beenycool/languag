// src/main/analysis/pipeline/__tests__/pipeline-coordinator.spec.ts

import { PipelineCoordinator, IPipelineCoordinatorConfig } from '../pipeline-coordinator';
import appLogger from '../../../services/logger'; // Actual logger or mock

// Mock the logger
jest.mock('../../../services/logger', () => {
    const actualLogger = jest.requireActual('../../../services/logger');
    return {
      ...actualLogger,
      default: {
        child: jest.fn().mockReturnThis(),
        info: jest.fn(),
        warn: jest.fn(),
        error: jest.fn(),
        debug: jest.fn(),
      },
      child: jest.fn().mockReturnThis(),
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
      debug: jest.fn(),
    };
  });

// Helper to create a mock task
const createMockTask = <T>(id: number | string, delay: number, result: T, shouldFail: boolean = false, failMessage: string = `Task ${id} failed`): (() => Promise<T>) => {
  return jest.fn(() => new Promise((resolve, reject) => {
    setTimeout(() => {
      if (shouldFail) {
        reject(new Error(failMessage));
      } else {
        resolve(result);
      }
    }, delay);
  }));
};

describe('PipelineCoordinator', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  describe('Constructor', () => {
    it('should initialize with default config if none provided', () => {
      const coordinator = new PipelineCoordinator();
      expect(appLogger.child).toHaveBeenCalledWith({ service: 'PipelineCoordinator' });
      // Default concurrency is os.cpus().length - 1, or 1 if cpus().length is 1.
      // This is hard to test precisely without mocking 'os', so we check it's a number.
      // @ts-ignore - access private config
      expect(typeof coordinator.config.maxConcurrentTasks).toBe('number');
      // @ts-ignore
      expect(coordinator.config.maxConcurrentTasks).toBeGreaterThanOrEqual(1);
      // @ts-ignore
      expect(coordinator.config.taskTimeoutMs).toBeUndefined();
    });

    it('should initialize with provided config', () => {
      const config: IPipelineCoordinatorConfig = {
        maxConcurrentTasks: 5,
        taskTimeoutMs: 1000,
      };
      const coordinator = new PipelineCoordinator(config);
      // @ts-ignore
      expect(coordinator.config).toEqual(config);
    });
  });

  describe('processBatch', () => {
    it('should return an empty array for empty tasks', async () => {
      const coordinator = new PipelineCoordinator();
      const results = await coordinator.processBatch([]);
      expect(results).toEqual([]);
    });

    it('should process tasks sequentially if maxConcurrentTasks is 1', async () => {
      const coordinator = new PipelineCoordinator({ maxConcurrentTasks: 1 });
      const tasks = [
        createMockTask(1, 100, 'res1'),
        createMockTask(2, 50, 'res2'),
      ];
      const promise = coordinator.processBatch(tasks);
      
      // Expect task 1 to be called first
      expect(tasks[0]).toHaveBeenCalled();
      expect(tasks[1]).not.toHaveBeenCalled();

      jest.advanceTimersByTime(100); // Complete task 1
      await Promise.resolve(); // Allow microtasks to run

      // Now task 2 should be called
      expect(tasks[1]).toHaveBeenCalled();

      jest.advanceTimersByTime(50); // Complete task 2
      const results = await promise;
      expect(results).toEqual(['res1', 'res2']);
    });

    it('should process tasks in parallel up to maxConcurrentTasks', async () => {
      const coordinator = new PipelineCoordinator({ maxConcurrentTasks: 2 });
      const tasks = [
        createMockTask(1, 100, 'res1'),
        createMockTask(2, 150, 'res2'),
        createMockTask(3, 50, 'res3'),
      ];
      const promise = coordinator.processBatch(tasks);

      // Tasks 1 and 2 should start immediately
      expect(tasks[0]).toHaveBeenCalled();
      expect(tasks[1]).toHaveBeenCalled();
      expect(tasks[2]).not.toHaveBeenCalled();
      expect(coordinator.getActiveTasks()).toBe(2);

      jest.advanceTimersByTime(100); // Task 1 finishes
      await Promise.resolve(); // Allow microtasks

      // Task 3 should start now
      expect(tasks[2]).toHaveBeenCalled();
      expect(coordinator.getActiveTasks()).toBe(2); // Task 2 still running, Task 3 started

      jest.advanceTimersByTime(50); // Task 3 finishes (total 150ms)
      await Promise.resolve();
      expect(coordinator.getActiveTasks()).toBe(1); // Task 2 still running

      jest.advanceTimersByTime(0); // Task 2 finishes (total 150ms, already passed)
      const results = await promise;
      expect(results).toEqual(['res1', 'res2', 'res3']);
      expect(coordinator.getActiveTasks()).toBe(0);
    });

    it('should handle task failures gracefully and return error objects', async () => {
      const coordinator = new PipelineCoordinator({ maxConcurrentTasks: 2 });
      const tasks = [
        createMockTask(1, 50, 'res1'),
        createMockTask(2, 100, 'res2', true, 'Task 2 Error'),
        createMockTask(3, 70, 'res3'),
      ];
      const promise = coordinator.processBatch(tasks);

      jest.advanceTimersByTime(50); // Task 1 finishes
      await Promise.resolve();
      
      jest.advanceTimersByTime(50); // Task 2 fails (total 100ms), Task 3 finishes (total 70ms, already passed)
      const results = await promise;
      
      expect(results.length).toBe(3);
      expect(results[0]).toBe('res1');
      expect(results[1]).toEqual({ error: 'Task 2 Error', failed: true });
      expect(results[2]).toBe('res3');
      expect(appLogger.error).toHaveBeenCalledWith('Task 2 failed: Task 2 Error', { error: expect.any(Error) });
    });

    it('should handle task timeouts', async () => {
      const coordinator = new PipelineCoordinator({ maxConcurrentTasks: 1, taskTimeoutMs: 100 });
      const tasks = [
        createMockTask(1, 200, 'res1'), // This task will timeout
        createMockTask(2, 50, 'res2'),
      ];
      const promise = coordinator.processBatch(tasks);

      jest.advanceTimersByTime(100); // Task 1 times out
      await Promise.resolve(); // Allow microtasks to run for timeout handling

      // Task 2 should start after task 1 (due to timeout or completion)
      expect(tasks[1]).toHaveBeenCalled();
      jest.advanceTimersByTime(50); // Task 2 completes

      const results = await promise;
      expect(results.length).toBe(2);
      expect(results[0]).toEqual({ error: 'Task 1 timed out after 100ms', failed: true });
      expect(results[1]).toBe('res2');
      expect(appLogger.error).toHaveBeenCalledWith('Task 1 failed: Task 1 timed out after 100ms', { error: expect.any(Error) });
    });
    
    it('should maintain original order of results even with varying task durations', async () => {
        const coordinator = new PipelineCoordinator({ maxConcurrentTasks: 3 });
        const tasks = [
          createMockTask('A', 200, 'Result A'),
          createMockTask('B', 50,  'Result B'),
          createMockTask('C', 150, 'Result C'),
          createMockTask('D', 100, 'Result D'),
        ];
        const promise = coordinator.processBatch(tasks);
  
        // Advance time enough for all tasks to complete
        jest.advanceTimersByTime(200);
        const results = await promise;
  
        expect(results).toEqual(['Result A', 'Result B', 'Result C', 'Result D']);
      });

      it('should correctly report active tasks', async () => {
        const coordinator = new PipelineCoordinator({ maxConcurrentTasks: 2 });
        const tasks = [
          createMockTask(1, 100, 'res1'),
          createMockTask(2, 150, 'res2'),
          createMockTask(3, 50, 'res3'),
        ];
        
        expect(coordinator.getActiveTasks()).toBe(0);
        const batchPromise = coordinator.processBatch(tasks);
        expect(coordinator.getActiveTasks()).toBe(2); // Tasks 1 and 2 start

        jest.advanceTimersByTime(100); // Task 1 finishes, Task 3 starts
        await Promise.resolve(); // Allow microtasks
        expect(coordinator.getActiveTasks()).toBe(2); // Task 2 and 3 running

        jest.advanceTimersByTime(50); // Task 2 and 3 finish (Task 2 at 150ms, Task 3 at 50ms from its start)
        await batchPromise;
        expect(coordinator.getActiveTasks()).toBe(0);
      });
  });

  describe('getActiveTasks', () => {
    it('should return the number of currently active tasks', async () => {
      const coordinator = new PipelineCoordinator({ maxConcurrentTasks: 1 });
      expect(coordinator.getActiveTasks()).toBe(0);
      
      const task1 = createMockTask(1, 100, 'res1');
      const promise = coordinator.processBatch([task1]);
      
      expect(coordinator.getActiveTasks()).toBe(1);
      jest.advanceTimersByTime(100);
      await promise;
      expect(coordinator.getActiveTasks()).toBe(0);
    });
  });
});