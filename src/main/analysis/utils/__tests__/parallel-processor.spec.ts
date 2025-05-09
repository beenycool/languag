import { ParallelProcessor } from '../parallel-processor';
import appLogger from '../../../services/logger';

jest.mock('../../../services/logger', () => {
  const mockLog = {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
  };
  return {
    child: jest.fn().mockReturnValue(mockLog),
    ...mockLog, // Allow direct calls if appLogger is used without child
  };
});

// Helper to create a task that resolves after a delay
// Now accepts TestOutput or Error for the value
type TestOutputValue = { value?: string; error?: string };
const createDelayedTask = (id: number, delay: number, value: TestOutputValue | Error): (() => Promise<TestOutputValue>) => {
  return () => new Promise<TestOutputValue>((resolve, reject) => {
    setTimeout(() => {
      if (value instanceof Error) {
        // console.log(`Task ${id} rejecting with error: ${value.message} after ${delay}ms`);
        reject(value); // The processor's catch block will handle this and create a TestOutput error object
      } else {
        // console.log(`Task ${id} resolving with value: ${JSON.stringify(value)} after ${delay}ms`);
        resolve(value as TestOutputValue);
      }
    }, delay);
  });
};


describe('ParallelProcessor', () => {
  let mockLogger: jest.Mocked<ReturnType<typeof appLogger.child>>;

  beforeEach(() => {
     // Get the mocked child logger instance
    mockLogger = appLogger.child({ utility: 'ParallelProcessor' }) as jest.Mocked<ReturnType<typeof appLogger.child>>;
    // Clear all mock calls for the logger methods before each test
    (appLogger.child as jest.Mock).mockClear();
    Object.values(mockLogger).forEach(mockFn => {
        if (jest.isMockFunction(mockFn)) {
            mockFn.mockClear();
        }
    });
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should initialize with default concurrency if none provided (and navigator is undefined)', () => {
    const originalNavigator = global.navigator;
    // @ts-ignore
    delete global.navigator; // Simulate navigator not being present
    new ParallelProcessor();
    expect(mockLogger.info).toHaveBeenCalledWith('Initialized with concurrency: 4');
    global.navigator = originalNavigator; // Restore navigator
  });

  it('should initialize with specified concurrency', () => {
    new ParallelProcessor(2);
    expect(mockLogger.info).toHaveBeenCalledWith('Initialized with concurrency: 2');
  });

  it('should initialize with navigator.hardwareConcurrency if available', () => {
    const originalNavigator = global.navigator;
    global.navigator = { hardwareConcurrency: 8 } as any;
    new ParallelProcessor();
    expect(mockLogger.info).toHaveBeenCalledWith('Initialized with concurrency: 8');
    global.navigator = originalNavigator;
  });

  it('should return an empty array if no tasks are provided', async () => {
    const processor = new ParallelProcessor<string>(2);
    const results = await processor.process([]);
    expect(results).toEqual([]);
  });

  it('should process tasks in parallel up to the concurrency limit', async () => {
    const processor = new ParallelProcessor<TestOutputValue>(2);
    const taskCreators = [
      createDelayedTask(1, 100, {value: 'Task 1 Result'}),
      createDelayedTask(2, 50, {value: 'Task 2 Result'}), // Finishes first
      createDelayedTask(3, 150, {value: 'Task 3 Result'}),
      createDelayedTask(4, 20, {value: 'Task 4 Result'}), // Finishes second (after task 2)
    ];

    const results = await processor.process(taskCreators);
    
    expect(results).toHaveLength(4);
    expect(results[0]).toEqual({value: 'Task 1 Result'});
    expect(results[1]).toEqual({value: 'Task 2 Result'});
    expect(results[2]).toEqual({value: 'Task 3 Result'});
    expect(results[3]).toEqual({value: 'Task 4 Result'}); // Results are in original order

    expect(mockLogger.debug).toHaveBeenCalledWith(expect.stringContaining('Processing 4 tasks with concurrency 2'));
    expect(mockLogger.debug).toHaveBeenCalledWith('Starting task 1/4');
    expect(mockLogger.debug).toHaveBeenCalledWith('Starting task 2/4');
  });

  it('should handle tasks that complete in different orders but return results in original order', async () => {
    const processor = new ParallelProcessor<TestOutputValue>(3);
    const taskCreators = [
      createDelayedTask(1, 200, {value: 'Result A'}), // Slowest
      createDelayedTask(2, 50, {value: 'Result B'}),  // Fastest
      createDelayedTask(3, 100, {value: 'Result C'}), // Middle
    ];
    const results = await processor.process(taskCreators);
    expect(results).toEqual([{value: 'Result A'}, {value: 'Result B'}, {value: 'Result C'}]);
  });

  it('should process more tasks than concurrency limit sequentially in batches', async () => {
    const processor = new ParallelProcessor<TestOutputValue>(1); // Concurrency of 1
    const taskCreators = [
      createDelayedTask(1, 50, {value: 'One'}),
      createDelayedTask(2, 50, {value: 'Two'}),
      createDelayedTask(3, 50, {value: 'Three'}),
    ];
    const results = await processor.process(taskCreators);
    expect(results).toEqual([{value: 'One'}, {value: 'Two'}, {value: 'Three'}]);
  });

  // Updated test to reflect that TOutput should contain the error.
  it('should handle tasks that reject and place an error object in results array', async () => {
    type TestOutput = { value?: string; error?: string };

    const processor = new ParallelProcessor<TestOutput>(2);
    const errorMsg2 = 'Failure Task 2';
    const errorMsg3 = 'Failure Task 3';

    const taskCreators: (() => Promise<TestOutput>)[] = [
      () => new Promise<TestOutput>(res => setTimeout(() => res({ value: 'Success 1' }), 50)),
      () => new Promise<TestOutput>((_res, rej) => setTimeout(() => rej(new Error(errorMsg2)), 100)),
      () => new Promise<TestOutput>((_res, rej) => setTimeout(() => rej(new Error(errorMsg3)), 20)),
      () => new Promise<TestOutput>(res => setTimeout(() => res({ value: 'Success 4' }), 70)),
    ];

    const results = await processor.process(taskCreators);

    expect(results).toHaveLength(4);
    expect(results[0]).toEqual({ value: 'Success 1' });
    expect(results[1]).toEqual({ error: `Task failed: ${errorMsg2}` });
    expect(results[2]).toEqual({ error: `Task failed: ${errorMsg3}` });
    expect(results[3]).toEqual({ value: 'Success 4' });

    expect(mockLogger.error).toHaveBeenCalledWith(expect.stringContaining(errorMsg2), expect.anything());
    expect(mockLogger.error).toHaveBeenCalledWith(expect.stringContaining(errorMsg3), expect.anything());
  });
  
  it('should resolve even if some tasks fail, with error objects in their respective places', async () => {
    type TestOutput = { value?: string; error?: string };
    const processor = new ParallelProcessor<TestOutput>(2);
    const taskErrorMsg = 'Task failed';
    const tasks: (() => Promise<TestOutput>)[] = [
      () => new Promise<TestOutput>(res => setTimeout(() => res({ value: 'Success 1' }), 10)),
      () => new Promise<TestOutput>((_res, rej) => setTimeout(() => rej(new Error(taskErrorMsg)), 20)),
      () => new Promise<TestOutput>(res => setTimeout(() => res({ value: 'Success 3' }), 5)),
    ];
  
    const results = await processor.process(tasks);
    expect(results).toEqual([
        { value: 'Success 1' },
        { error: `Task failed: ${taskErrorMsg}` },
        { value: 'Success 3' }
    ]);
  });

  it('should correctly log start and completion of tasks', async () => {
    const processor = new ParallelProcessor<TestOutputValue>(1);
    const task = createDelayedTask(1, 10, {value: 'done'});
    await processor.process([task]);

    expect(mockLogger.debug).toHaveBeenCalledWith(expect.stringContaining('Processing 1 tasks with concurrency 1'));
    expect(mockLogger.debug).toHaveBeenCalledWith('Starting task 1/1');
    expect(mockLogger.debug).toHaveBeenCalledWith('Task 1 completed.');
  });

  it('should correctly log failing tasks', async () => {
    type TestOutput = { error?: string };
    const processor = new ParallelProcessor<TestOutput>(1);
    const error = new Error('Test failure');
    const task = () => new Promise<TestOutput>((_res, rej) => setTimeout(() => rej(error), 10));
    await processor.process([task]);

    expect(mockLogger.error).toHaveBeenCalledWith(expect.stringContaining('Task 1/1 failed critically or timed out: Test failure'), { error });
  });

  it('should respect per-task timeout', async () => {
    type TestOutput = { value?: string; error?: string };
    const processor = new ParallelProcessor<TestOutput>(2, 5000); // Default timeout 5s

    const tasks: (() => Promise<TestOutput>)[] = [
      createDelayedTask(1, 20, {value: "Task 1 done"}), // Completes
      createDelayedTask(2, 100, {value: "Task 2 done"}), // Times out
    ];

    const results = await processor.process(tasks, 50); // Per-task timeout 50ms

    expect(results[0]).toEqual({value: "Task 1 done"});
    expect(results[1]?.error).toContain("Task 2 timed out after 50ms");
    expect(mockLogger.error).toHaveBeenCalledWith(expect.stringContaining("Task 2 timed out after 50ms"), expect.anything());
  });

  it('should use default timeout if per-task timeout is not provided', async () => {
    type TestOutput = { value?: string; error?: string };
    const processor = new ParallelProcessor<TestOutput>(1, 30); // Default timeout 30ms

    const tasks: (() => Promise<TestOutput>)[] = [
      createDelayedTask(1, 100, {value: "Task 1 done"}), // Times out based on default
    ];

    const results = await processor.process(tasks);
    expect(results[0]?.error).toContain("Task 1 timed out after 30ms");
  });

});