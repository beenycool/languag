// src/main/analysis/pipeline/__tests__/enhanced-pipeline.spec.ts

import { EnhancedAnalysisPipeline, IEnhancedPipelineConfig } from '../enhanced-pipeline';
import { IAnalysisEngine, AnalysisResult, ExtractedFeatures } from '../../types';
import { IDocumentContext, IDocumentSegment } from '../../context/document-context';
import { ContextExtractor } from '../../context/context-extractor';
import { ParagraphSegmenter } from '../../context/paragraph-segmenter';
import { FeatureExtractor } from '../../feature-extractor';
import { ContextCache } from '../../context/context-cache';
import appLogger from '../../../services/logger'; // Use the actual logger or a mock

// Mocks
jest.mock('../../context/context-extractor');
jest.mock('../../context/paragraph-segmenter');
jest.mock('../../feature-extractor');
jest.mock('../../context/context-cache');
jest.mock('../../../services/logger', () => {
  const actualLogger = jest.requireActual('../../../services/logger');
  return {
    ...actualLogger, // Retain other exports if any
    default: { // Assuming appLogger is the default export
      child: jest.fn().mockReturnThis(),
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
      debug: jest.fn(),
    },
    child: jest.fn().mockReturnThis(), // If child is also a top-level export
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
  };
});


describe('EnhancedAnalysisPipeline', () => {
  let mockEngines: jest.Mocked<IAnalysisEngine>[];
  let mockContextExtractor: jest.Mocked<ContextExtractor>;
  let mockParagraphSegmenter: jest.Mocked<ParagraphSegmenter>;
  let mockFeatureExtractor: jest.Mocked<FeatureExtractor>;
  let mockResultCache: jest.Mocked<ContextCache<AnalysisResult[]>>;

  const mockDocUri = 'test-doc.txt';
  const mockRawText = 'This is a sentence. This is another sentence.';
  const mockDocumentContext: IDocumentContext = { uri: mockDocUri, language: 'en' };
  const mockSegments: IDocumentSegment[] = [
    { id: 'seg1', text: 'This is a sentence.', range: { start: 0, end: 20 }, context: mockDocumentContext },
    { id: 'seg2', text: 'This is another sentence.', range: { start: 21, end: 45 }, context: mockDocumentContext },
  ];
  const mockFeatures: ExtractedFeatures = { wordCount: 5, sentenceCount: 1, keywords: ['test'] };
  const mockAnalysisResult: AnalysisResult = { segmentId: 'seg1', engine: 'test-engine', findings: [] };

  beforeEach(() => {
    jest.clearAllMocks();

    mockEngines = [
      { name: 'engine1', analyze: jest.fn().mockResolvedValue(mockAnalysisResult), dispose: jest.fn().mockResolvedValue(undefined) },
      { name: 'engine2', analyze: jest.fn().mockResolvedValue({ ...mockAnalysisResult, engine: 'engine2' }), dispose: jest.fn().mockResolvedValue(undefined) },
    ];

    // Mock implementations for constructor-called methods or properties
    (ContextExtractor as jest.Mock).mockImplementation(() => ({
      extractDocumentContext: jest.fn().mockReturnValue(mockDocumentContext),
    }));
    (ParagraphSegmenter as jest.Mock).mockImplementation(() => ({
      segment: jest.fn().mockReturnValue(mockSegments),
    }));
    (FeatureExtractor as jest.Mock).mockImplementation(() => ({
      extractFeatures: jest.fn().mockReturnValue(mockFeatures),
    }));
    (ContextCache as jest.Mock).mockImplementation(() => ({
      get: jest.fn().mockReturnValue(undefined),
      set: jest.fn(),
      clear: jest.fn(),
    }));
    
    // Assign mocked instances
    mockContextExtractor = new ContextExtractor() as jest.Mocked<ContextExtractor>;
    mockParagraphSegmenter = new ParagraphSegmenter() as jest.Mocked<ParagraphSegmenter>;
    mockFeatureExtractor = new FeatureExtractor() as jest.Mocked<FeatureExtractor>;
    mockResultCache = new ContextCache() as jest.Mocked<ContextCache<AnalysisResult[]>>;
  });

  const getDefaultConfig = (): IEnhancedPipelineConfig => ({
    engines: mockEngines,
    contextExtractorConfig: {},
    paragraphSegmenterConfig: {},
    featureExtractorConfig: {},
    contextCacheConfig: {}, // Enable cache by default for tests
  });

  describe('Constructor', () => {
    it('should initialize components correctly', () => {
      const config = getDefaultConfig();
      new EnhancedAnalysisPipeline(config);

      expect(ContextExtractor).toHaveBeenCalledWith(config.contextExtractorConfig);
      expect(ParagraphSegmenter).toHaveBeenCalledWith(config.paragraphSegmenterConfig);
      expect(FeatureExtractor).toHaveBeenCalledWith(
        config.featureExtractorConfig?.maxSegmentSize,
        config.featureExtractorConfig?.maxKeywordsInputLength,
        config.featureExtractorConfig?.sanitizeKeywords
      );
      expect(ContextCache).toHaveBeenCalledWith(config.contextCacheConfig);
      expect(appLogger.child).toHaveBeenCalledWith({ service: 'EnhancedAnalysisPipeline' });
    });

    it('should initialize without cache if contextCacheConfig is not provided', () => {
      const config: IEnhancedPipelineConfig = { engines: mockEngines };
      new EnhancedAnalysisPipeline(config);
      expect(ContextCache).not.toHaveBeenCalled();
    });

    it('should log a warning if initialized with no engines', () => {
      new EnhancedAnalysisPipeline({ engines: [] });
      expect(appLogger.warn).toHaveBeenCalledWith('EnhancedAnalysisPipeline initialized with no analysis engines.');
    });
  });

  describe('analyzeDocument', () => {
    it('should perform full analysis flow', async () => {
      const pipeline = new EnhancedAnalysisPipeline(getDefaultConfig());
      const results = await pipeline.analyzeDocument(mockRawText, { uri: mockDocUri });

      expect(mockContextExtractor.extractDocumentContext).toHaveBeenCalledWith(mockDocUri, mockRawText, { uri: mockDocUri });
      expect(mockResultCache.get).toHaveBeenCalledWith(mockDocumentContext);
      expect(mockParagraphSegmenter.segment).toHaveBeenCalledWith(mockRawText, mockDocumentContext);
      expect(mockFeatureExtractor.extractFeatures).toHaveBeenCalledTimes(mockSegments.length);
      expect(mockFeatureExtractor.extractFeatures).toHaveBeenCalledWith(mockSegments[0]); // Temporary cast in implementation
      expect(mockEngines[0].analyze).toHaveBeenCalledTimes(mockSegments.length);
      expect(mockEngines[1].analyze).toHaveBeenCalledTimes(mockSegments.length);
      // Example for one segment and one engine
      expect(mockEngines[0].analyze).toHaveBeenCalledWith(mockSegments[0], mockFeatures); // Temporary cast in implementation

      expect(results.length).toBe(mockSegments.length * mockEngines.length);
      expect(mockResultCache.set).toHaveBeenCalledWith(mockDocumentContext, results);
      expect(appLogger.info).toHaveBeenCalledWith(expect.stringContaining(`Completed enhanced analysis for document: ${mockDocUri}`));
    });

    it('should return cached results if available', async () => {
      const cachedResults: AnalysisResult[] = [{ segmentId: 'cachedSeg', engine: 'cachedEngine', findings: [] }];
      mockResultCache.get.mockReturnValue(cachedResults);
      
      const pipeline = new EnhancedAnalysisPipeline(getDefaultConfig());
      const results = await pipeline.analyzeDocument(mockRawText, { uri: mockDocUri });

      expect(results).toBe(cachedResults);
      expect(mockParagraphSegmenter.segment).not.toHaveBeenCalled();
      expect(appLogger.info).toHaveBeenCalledWith(expect.stringContaining(`Returning cached results for document: ${mockDocUri}`));
    });

    it('should return empty array if no segments found', async () => {
      mockParagraphSegmenter.segment.mockReturnValue([]);
      const pipeline = new EnhancedAnalysisPipeline(getDefaultConfig());
      const results = await pipeline.analyzeDocument(mockRawText, { uri: mockDocUri });
      expect(results).toEqual([]);
      expect(appLogger.info).toHaveBeenCalledWith(expect.stringContaining(`No segments found for document: ${mockDocUri}`));
    });

    it('should truncate segments if exceeding maxSegmentsToProcess', async () => {
      const manySegments = Array(5).fill(mockSegments[0]).map((s, i) => ({ ...s, id: `seg${i}`}));
      mockParagraphSegmenter.segment.mockReturnValue(manySegments);
      const config = { ...getDefaultConfig(), maxSegmentsToProcess: 2 };
      const pipeline = new EnhancedAnalysisPipeline(config);
      
      await pipeline.analyzeDocument(mockRawText, { uri: mockDocUri });
      
      expect(appLogger.warn).toHaveBeenCalledWith(expect.stringContaining(`exceeding limit of 2. Truncating.`));
      expect(mockFeatureExtractor.extractFeatures).toHaveBeenCalledTimes(2); // Only for processed segments
      expect(mockEngines[0].analyze).toHaveBeenCalledTimes(2);
    });

    it('should handle feature extraction failure for a segment', async () => {
      const error = new Error('Feature extraction failed');
      mockFeatureExtractor.extractFeatures.mockImplementationOnce(() => { throw error; }); // Fail for the first segment
      
      const pipeline = new EnhancedAnalysisPipeline(getDefaultConfig());
      const results = await pipeline.analyzeDocument(mockRawText, { uri: mockDocUri });

      expect(appLogger.error).toHaveBeenCalledWith(
        `Feature extraction failed for segment ${mockSegments[0].id} in document ${mockDocUri}: ${error.message}`,
        { error }
      );
      // Results for the failed segment should indicate feature extraction error for all engines
      const failedSegmentResults = results.filter(r => r.segmentId === mockSegments[0].id);
      expect(failedSegmentResults.length).toBe(mockEngines.length);
      failedSegmentResults.forEach(res => {
        expect(res.error).toBe(`Feature extraction failed: ${error.message}`);
        expect(res.findings).toEqual([]);
      });
      // Ensure analysis proceeds for other segments
      expect(mockFeatureExtractor.extractFeatures).toHaveBeenCalledWith(mockSegments[1]);
      expect(mockEngines[0].analyze).toHaveBeenCalledWith(mockSegments[1], mockFeatures);
    });

    it('should handle engine analysis failure for a segment', async () => {
      const error = new Error('Engine failed');
      mockEngines[0].analyze.mockImplementationOnce(async () => { throw error; }); // First engine fails on first segment
      
      const pipeline = new EnhancedAnalysisPipeline(getDefaultConfig());
      const results = await pipeline.analyzeDocument(mockRawText, { uri: mockDocUri });

      expect(appLogger.error).toHaveBeenCalledWith(
        `Engine '${mockEngines[0].name}' failed for segment '${mockSegments[0].id}': ${error.message}`,
        { error }
      );
      const firstEngineFirstSegmentResult = results.find(r => r.segmentId === mockSegments[0].id && r.engine === mockEngines[0].name);
      expect(firstEngineFirstSegmentResult?.error).toBe(`Engine ${mockEngines[0].name} execution failed. Check engine logs.`);
      
      // Ensure other engines/segments are processed
      expect(mockEngines[1].analyze).toHaveBeenCalledWith(mockSegments[0], mockFeatures);
      expect(mockEngines[0].analyze).toHaveBeenCalledWith(mockSegments[1], mockFeatures); // Called for the second segment
    });
  });

  describe('addEngine/removeEngine', () => {
    it('should add an engine', () => {
      const pipeline = new EnhancedAnalysisPipeline(getDefaultConfig());
      const newEngine: jest.Mocked<IAnalysisEngine> = { name: 'newEngine', analyze: jest.fn(), dispose: jest.fn() };
      pipeline.addEngine(newEngine);
      // @ts-ignore // Access private member for test
      expect(pipeline.engines).toContain(newEngine);
      expect(appLogger.info).toHaveBeenCalledWith(`Added engine '${newEngine.name}'.`);
    });

    it('should not add an engine if name already exists', () => {
      const pipeline = new EnhancedAnalysisPipeline(getDefaultConfig());
      const existingEngineName = mockEngines[0].name;
      const newEngineSameName: jest.Mocked<IAnalysisEngine> = { name: existingEngineName, analyze: jest.fn(), dispose: jest.fn() };
      pipeline.addEngine(newEngineSameName);
       // @ts-ignore
      expect(pipeline.engines.filter(e => e.name === existingEngineName).length).toBe(1); // Assuming mockEngines[0] was there
      expect(appLogger.warn).toHaveBeenCalledWith(`Engine with name '${existingEngineName}' already exists. Not adding.`);
    });

    it('should remove an engine', () => {
      const pipeline = new EnhancedAnalysisPipeline(getDefaultConfig());
      const engineNameToRemove = mockEngines[0].name;
      pipeline.removeEngine(engineNameToRemove);
       // @ts-ignore
      expect(pipeline.engines.find(e => e.name === engineNameToRemove)).toBeUndefined();
      expect(appLogger.info).toHaveBeenCalledWith(`Removed engine '${engineNameToRemove}'.`);
    });

    it('should warn if removing a non-existent engine', () => {
      const pipeline = new EnhancedAnalysisPipeline(getDefaultConfig());
      pipeline.removeEngine('nonExistentEngine');
      expect(appLogger.warn).toHaveBeenCalledWith(`Engine 'nonExistentEngine' not found for removal.`);
    });
  });

  describe('dispose', () => {
    it('should call dispose on all engines and clear cache', async () => {
      const pipeline = new EnhancedAnalysisPipeline(getDefaultConfig());
      await pipeline.dispose();

      mockEngines.forEach(engine => expect(engine.dispose).toHaveBeenCalled());
      expect(mockResultCache.clear).toHaveBeenCalled();
       // @ts-ignore
      expect(pipeline.engines.length).toBe(0);
      expect(appLogger.info).toHaveBeenCalledWith('EnhancedAnalysisPipeline disposed.');
    });

    it('should handle engine disposal errors', async () => {
      if (mockEngines[0]?.dispose) {
        (mockEngines[0].dispose as jest.Mock).mockRejectedValueOnce(new Error('Disposal error'));
      } else {
        // This case should ideally not happen if dispose is intended to be tested for errors
        // Or, the mock setup for mockEngines[0] should guarantee dispose is a jest.fn()
        mockEngines[0].dispose = jest.fn().mockRejectedValueOnce(new Error('Disposal error'));
      }
      const pipeline = new EnhancedAnalysisPipeline(getDefaultConfig());
      
      await pipeline.dispose();
      
      expect(appLogger.error).toHaveBeenCalledWith(
        `Error disposing engine ${mockEngines[0].name}: Disposal error`,
        { error: expect.any(Error) }
      );
      expect(mockEngines[1].dispose).toHaveBeenCalled(); // Other engines still disposed
    });
  });
});