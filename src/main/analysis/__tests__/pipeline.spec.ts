import { AnalysisPipeline } from '../pipeline';
import { TextProcessor } from '../text-processor';
import { FeatureExtractor } from '../feature-extractor';
import { ParallelProcessor } from '../utils/parallel-processor';
import { IAnalysisEngine, TextSegment, AnalysisResult, AnalysisPipelineConfig, Finding } from '../types';
import appLogger from '../../services/logger';
import winston from 'winston';

// Mocks
jest.mock('../text-processor');
jest.mock('../feature-extractor');
jest.mock('../utils/parallel-processor');
jest.mock('../../services/logger', () => {
  const mockLog = {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
  };
  return {
    child: jest.fn().mockReturnValue(mockLog), // child returns the mock logger
    ...mockLog, // also allow direct calls if appLogger is used without child
  };
});

// Helper to create a mock engine
const createMockEngine = (name: string, analyzeFn?: jest.Mock): jest.Mocked<IAnalysisEngine> => {
  return {
    name,
    analyze: analyzeFn || jest.fn().mockImplementation(async (segment: TextSegment): Promise<AnalysisResult> => ({
      segmentId: segment.id,
      engine: name,
      findings: [{ type: 'test', message: `Finding from ${name}`, severity: 'info' }],
    })),
  };
};

describe('AnalysisPipeline', () => {
  let mockTextProcessor: jest.Mocked<TextProcessor>;
  let mockFeatureExtractor: jest.Mocked<FeatureExtractor>;
  let mockParallelProcessor: jest.Mocked<ParallelProcessor<AnalysisResult>>;
  let mockLogger: jest.Mocked<winston.Logger>;

  const docId = 'test-doc-1';

  beforeEach(() => {
    mockTextProcessor = new TextProcessor() as jest.Mocked<TextProcessor>;
    mockFeatureExtractor = new FeatureExtractor() as jest.Mocked<FeatureExtractor>;
    mockParallelProcessor = new ParallelProcessor<AnalysisResult>() as jest.Mocked<ParallelProcessor<AnalysisResult>>;
    
    // Reset the logger mocks before each test
    // The logger is mocked at the module level, so we access its mocked methods
    // AnalysisPipeline calls child with { service: 'AnalysisPipeline' }
    mockLogger = appLogger.child({ service: 'AnalysisPipeline' }) as jest.Mocked<winston.Logger>;
    (appLogger.child as jest.Mock).mockClear(); // Clear calls to child itself
    // Clear calls on the returned mockLogger instance
    (mockLogger.info as jest.Mock).mockClear();
    (mockLogger.warn as jest.Mock).mockClear();
    (mockLogger.error as jest.Mock).mockClear();
    (mockLogger.debug as jest.Mock).mockClear();


    (mockTextProcessor.segmentText as jest.Mock).mockReturnValue([]);
    (mockParallelProcessor.process as jest.Mock).mockResolvedValue([]);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('Constructor', () => {
    it('should initialize with given engines and log their names', () => {
      const engine1 = createMockEngine('Engine1');
      const engine2 = createMockEngine('Engine2');
      const config: AnalysisPipelineConfig = { engines: [engine1, engine2] };
      
      new AnalysisPipeline(config);

      expect(appLogger.child).toHaveBeenCalledWith({ service: 'AnalysisPipeline' });
      expect(mockLogger.info).toHaveBeenCalledWith('AnalysisPipeline initialized with engines: Engine1, Engine2');
    });

    it('should log a warning if initialized with no engines', () => {
      const config: AnalysisPipelineConfig = { engines: [] };
      new AnalysisPipeline(config);
      expect(mockLogger.warn).toHaveBeenCalledWith('AnalysisPipeline initialized with no analysis engines.');
    });
  });

  describe('analyzeText', () => {
    const segment1: TextSegment = { id: `${docId}-s1`, text: 'Segment 1 text.', metadata: {} };
    const segment2: TextSegment = { id: `${docId}-s2`, text: 'Segment 2 text.', metadata: {} };

    it('should return empty results if no segments are produced', async () => {
      (mockTextProcessor.segmentText as jest.Mock).mockReturnValue([]);
      const pipeline = new AnalysisPipeline({ engines: [createMockEngine('E1')] });
      const results = await pipeline.analyzeText('No segments here', docId);
      
      expect(results).toEqual([]);
      expect(mockLogger.info).toHaveBeenCalledWith(`No segments found for document: ${docId}. Skipping analysis.`);
    });

    it('should process each segment through all engines using ParallelProcessor', async () => {
      (mockTextProcessor.segmentText as jest.Mock).mockReturnValue([segment1, segment2]);
      
      const engine1Analyze = jest.fn().mockResolvedValue({ segmentId: segment1.id, engine: 'E1', findings: [] });
      const engine2Analyze = jest.fn().mockResolvedValue({ segmentId: segment1.id, engine: 'E2', findings: [] });
      const engine1 = createMockEngine('E1', engine1Analyze);
      const engine2 = createMockEngine('E2', engine2Analyze);
      
      const pipeline = new AnalysisPipeline({ engines: [engine1, engine2] });

      // Mock parallelProcessor to return results for each segment
      (mockParallelProcessor.process as jest.Mock)
        .mockResolvedValueOnce([ // For segment1
          { segmentId: segment1.id, engine: 'E1', findings: [{type: 'e1', message: 'e1s1', severity: 'info'}] },
          { segmentId: segment1.id, engine: 'E2', findings: [{type: 'e2', message: 'e2s1', severity: 'info'}] }
        ])
        .mockResolvedValueOnce([ // For segment2
          { segmentId: segment2.id, engine: 'E1', findings: [{type: 'e1', message: 'e1s2', severity: 'info'}] },
          { segmentId: segment2.id, engine: 'E2', findings: [{type: 'e2', message: 'e2s2', severity: 'info'}] }
        ]);

      const results = await pipeline.analyzeText('Text with two segments.', docId);

      expect(mockTextProcessor.segmentText).toHaveBeenCalledWith('Text with two segments.', docId);
      expect(mockParallelProcessor.process).toHaveBeenCalledTimes(2); // Once per segment

      // Check tasks passed to parallelProcessor for the first segment
      const firstCallTasks = (mockParallelProcessor.process as jest.Mock).mock.calls[0][0] as (() => Promise<AnalysisResult>)[];
      expect(firstCallTasks).toHaveLength(2); // Two engines
      
      // Execute tasks to ensure engine.analyze would be called (though ParallelProcessor is mocked)
      // This also tests the task creation logic within analyzeText
      await firstCallTasks[0](); // Simulates E1 for segment1
      expect(engine1.analyze).toHaveBeenCalledWith(segment1);
      await firstCallTasks[1](); // Simulates E2 for segment1
      expect(engine2.analyze).toHaveBeenCalledWith(segment1);
      
      // Check tasks passed to parallelProcessor for the second segment
      const secondCallTasks = (mockParallelProcessor.process as jest.Mock).mock.calls[1][0] as (() => Promise<AnalysisResult>)[];
      expect(secondCallTasks).toHaveLength(2);
      await secondCallTasks[0](); // Simulates E1 for segment2
      expect(engine1.analyze).toHaveBeenCalledWith(segment2);
      await secondCallTasks[1](); // Simulates E2 for segment2
      expect(engine2.analyze).toHaveBeenCalledWith(segment2);

      expect(results).toHaveLength(4); // 2 segments * 2 engines
      expect(results.some(r => r.engine === 'E1' && r.segmentId === segment1.id)).toBe(true);
      expect(results.some(r => r.engine === 'E2' && r.segmentId === segment1.id)).toBe(true);
      expect(results.some(r => r.engine === 'E1' && r.segmentId === segment2.id)).toBe(true);
      expect(results.some(r => r.engine === 'E2' && r.segmentId === segment2.id)).toBe(true);
    });

    it('should handle errors from individual engine.analyze calls', async () => {
      (mockTextProcessor.segmentText as jest.Mock).mockReturnValue([segment1]);
      const failingEngineAnalyze = jest.fn().mockRejectedValue(new Error('Engine failure!'));
      const workingEngineAnalyze = jest.fn().mockResolvedValue({ segmentId: segment1.id, engine: 'WorkingEngine', findings: [] });
      
      const failingEngine = createMockEngine('FailingEngine', failingEngineAnalyze);
      const workingEngine = createMockEngine('WorkingEngine', workingEngineAnalyze);
      
      const pipeline = new AnalysisPipeline({ engines: [failingEngine, workingEngine] });

      // Mock parallelProcessor to simulate one task failing and one succeeding
      (mockParallelProcessor.process as jest.Mock).mockImplementation(async (tasks: (() => Promise<AnalysisResult>)[]) => {
        const results: AnalysisResult[] = [];
        for (const task of tasks) {
          // The task itself in AnalysisPipeline catches errors from engine.analyze
          results.push(await task());
        }
        return results;
      });

      const results = await pipeline.analyzeText('Test text', docId);
      
      expect(results).toHaveLength(2);
      const failingResult = results.find(r => r.engine === 'FailingEngine');
      const workingResult = results.find(r => r.engine === 'WorkingEngine');

      expect(failingResult).toBeDefined();
      expect(failingResult?.error).toBe('Engine FailingEngine execution failed: Engine failure!');
      expect(failingResult?.findings).toEqual([]);
      
      expect(workingResult).toBeDefined();
      expect(workingResult?.error).toBeUndefined();
      
      expect(mockLogger.error).toHaveBeenCalledWith(
        "Engine 'FailingEngine' failed for segment 'test-doc-1-s1': Engine failure!",
        { error: expect.any(Error) }
      );
    });

    it('should handle errors from parallelProcessor.process itself', async () => {
      (mockTextProcessor.segmentText as jest.Mock).mockReturnValue([segment1]);
      const engine1 = createMockEngine('E1');
      const engine2 = createMockEngine('E2');
      const pipeline = new AnalysisPipeline({ engines: [engine1, engine2] });

      const parallelProcessorError = new Error('ParallelProcessor exploded!');
      (mockParallelProcessor.process as jest.Mock).mockRejectedValue(parallelProcessorError);

      const results = await pipeline.analyzeText('Test text', docId);

      expect(results).toHaveLength(2); // One error result per engine for that segment
      results.forEach(result => {
        expect(result.segmentId).toBe(segment1.id);
        expect(result.error).toBe(`Parallel processing failed for segment: ${parallelProcessorError.message}`);
        expect(result.findings).toEqual([]);
      });
      expect(mockLogger.error).toHaveBeenCalledWith(
        `Error processing segment ${segment1.id} with parallelProcessor: ${parallelProcessorError.message}`,
        { error: parallelProcessorError }
      );
    });
  });

  describe('addEngine', () => {
    it('should add a new engine to the pipeline', () => {
      const pipeline = new AnalysisPipeline({ engines: [] });
      const engine1 = createMockEngine('NewEngine');
      pipeline.addEngine(engine1);
      
      expect(pipeline.getEngineNames()).toContain('NewEngine');
      expect(mockLogger.info).toHaveBeenCalledWith("Added engine 'NewEngine' to the pipeline.");
    });

    it('should not add an engine if one with the same name exists and log a warning', () => {
      const engine1 = createMockEngine('ExistingEngine');
      const pipeline = new AnalysisPipeline({ engines: [engine1] });
      const engine2 = createMockEngine('ExistingEngine'); // Same name
      
      pipeline.addEngine(engine2);
      
      expect(pipeline.getEngineNames()).toHaveLength(1);
      expect(pipeline.getEngineNames()[0]).toBe('ExistingEngine');
      expect(mockLogger.warn).toHaveBeenCalledWith("Engine with name 'ExistingEngine' already exists in the pipeline. Not adding.");
    });
  });

  describe('removeEngine', () => {
    it('should remove an existing engine from the pipeline', () => {
      const engine1 = createMockEngine('EngineToRemove');
      const engine2 = createMockEngine('EngineToKeep');
      const pipeline = new AnalysisPipeline({ engines: [engine1, engine2] });
      
      pipeline.removeEngine('EngineToRemove');
      
      expect(pipeline.getEngineNames()).toEqual(['EngineToKeep']);
      expect(mockLogger.info).toHaveBeenCalledWith("Removed engine 'EngineToRemove' from the pipeline.");
    });

    it('should log a warning if trying to remove a non-existent engine', () => {
      const pipeline = new AnalysisPipeline({ engines: [createMockEngine('E1')] });
      pipeline.removeEngine('NonExistentEngine');
      
      expect(pipeline.getEngineNames()).toEqual(['E1']);
      expect(mockLogger.warn).toHaveBeenCalledWith("Engine 'NonExistentEngine' not found in the pipeline for removal.");
    });
  });

  describe('getEngineNames', () => {
    it('should return an array of current engine names', () => {
      const engine1 = createMockEngine('Alpha');
      const engine2 = createMockEngine('Beta');
      const pipeline = new AnalysisPipeline({ engines: [engine1, engine2] });
      
      expect(pipeline.getEngineNames()).toEqual(['Alpha', 'Beta']);
    });

    it('should return an empty array if no engines are configured', () => {
      const pipeline = new AnalysisPipeline({ engines: [] });
      expect(pipeline.getEngineNames()).toEqual([]);
    });
  });
});