import { AnalysisOrchestrator, getAnalysisOrchestrator } from '../orchestrator';
import { AnalysisPipeline } from '../pipeline';
import { LlmService, getLlmService as actualGetLlmService } from '../../services/llm-service';
import { ConfigurationManager, configManager as actualConfigManager } from '../../services/config-manager';
import { GrammarEngine } from '../engines/grammar-engine';
import { StyleEngine } from '../engines/style-engine';
import appLogger from '../../services/logger';
import { AppConfig, AnalysisConfig, ConfigChange, ChangeCallback } from '../../../shared/types/config'; // Added ChangeCallback
import { AnalysisResult, IAnalysisEngine, AnalysisPipelineConfig } from '../types';
import winston from 'winston';
import { RateLimiter } from '../../../shared/utils/rate-limiter';
import { sanitizeError } from '../../../shared/utils/sanitization';


// Mocks
jest.mock('../pipeline');
jest.mock('../../services/llm-service');
jest.mock('../../services/config-manager');
jest.mock('../engines/grammar-engine');
jest.mock('../engines/style-engine');
jest.mock('../../../shared/utils/rate-limiter');
jest.mock('../../../shared/utils/sanitization', () => ({
  sanitizeError: jest.fn((msg, _ctx) => `sanitized: ${msg}`),
}));


// Helper for deep object access (simplified for tests)
const getPropertyInTest = <T>(obj: any, path: string, defaultValue?: T): T | undefined => {
  const keys = path.split('.');
  let current = obj;
  for (const key of keys) {
    if (current === null || typeof current !== 'object' || !(key in current)) {
      return defaultValue;
    }
    current = current[key];
  }
  return current as T;
};


// Mock for the configManager singleton
const mockDefaultConfigManagerMethods = {
  // Properties
  config: {} as AppConfig, // Add missing properties
  configPath: 'dummy/path/config.json',
  changeListeners: new Map<string, ChangeCallback[]>(),
  // Private methods that might be indirectly called or part of type
  loadSync: jest.fn(),
  saveSync: jest.fn(),
  notifyChange: jest.fn(),
  notifyChangesForObject: jest.fn(),
  mergeDeep: jest.fn((target, source) => ({...target, ...source})),
  isObject: jest.fn(item => (item && typeof item === 'object' && !Array.isArray(item))),
  // Public methods
  load: jest.fn().mockResolvedValue(undefined),
  save: jest.fn().mockResolvedValue(undefined),
  reset: jest.fn().mockResolvedValue(undefined),
  get: jest.fn(),
  getFullConfig: jest.fn(),
  update: jest.fn(),
  set: jest.fn(),
  has: jest.fn().mockReturnValue(false),
  delete: jest.fn(),
  validate: jest.fn().mockReturnValue([]),
  validateSection: jest.fn().mockReturnValue([]),
  onChange: jest.fn().mockReturnValue(jest.fn()), // onChange returns an unsubscribe function
  batch: jest.fn(),
  exportToFile: jest.fn().mockResolvedValue(undefined),
  importFromFile: jest.fn().mockResolvedValue(undefined),
};
const mockDefaultConfigManager = mockDefaultConfigManagerMethods as unknown as jest.Mocked<ConfigurationManager>; // Use unknown for broader compatibility initially

jest.mock('../../services/config-manager', () => ({
  __esModule: true,
  configManager: mockDefaultConfigManager,
  ConfigurationManager: jest.fn().mockImplementation(() => mockDefaultConfigManager)
}));

// Mock for LlmService
const mockLlmServiceMethods = {
  // Properties
  providers: new Map<string, import('../../../shared/types/llm').LLMProvider>(),
  activeProviderName: null as string | null,
  llmConfig: {} as import('../../../shared/types/config').LLMConfig,
  rateLimiter: { isAllowed: jest.fn().mockReturnValue(true) } as any, // Simplified RateLimiter mock
  // Private methods
  initializeProviders: jest.fn(), // Keep as jest.fn()
  determineProvider: jest.fn().mockReturnValue(null), // Keep as jest.fn()
  // Public methods
  registerProvider: jest.fn(),
  unregisterProvider: jest.fn(),
  setActiveProvider: jest.fn().mockResolvedValue(true),
  getActiveProvider: jest.fn().mockReturnValue(null),
  getProvider: jest.fn().mockReturnValue(undefined),
  listProviders: jest.fn().mockReturnValue([]),
  process: jest.fn().mockResolvedValue({ success: true, content: '' }),
  streamResponse: jest.fn() as jest.Mock<AsyncIterableIterator<string | import('../../../shared/types/llm').ChatMessage | import('../../../shared/types/llm').ModelResponse>, [import('../../../shared/types/llm').LLMRequest]>,
  listModels: jest.fn().mockResolvedValue([]),
  getModel: jest.fn().mockResolvedValue(undefined),
  getActiveProviderHealth: jest.fn().mockResolvedValue({ available: true }),
  getProviderHealth: jest.fn().mockResolvedValue({ available: true }),
  getProviderName: jest.fn().mockReturnValue('mockProvider'),
};
const mockLlmServiceInstance = mockLlmServiceMethods as unknown as jest.Mocked<LlmService>; // Use unknown

jest.mock('../../services/llm-service', () => ({
    __esModule: true,
    getLlmService: jest.fn().mockReturnValue(mockLlmServiceInstance),
    LlmService: jest.fn().mockImplementation(() => mockLlmServiceInstance)
}));

jest.mock('../../services/logger', () => {
  const mockLog = {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
  };
  return {
    child: jest.fn().mockReturnValue(mockLog),
    ...mockLog,
  };
});

describe('AnalysisOrchestrator', () => {
  let mockPipeline: jest.Mocked<AnalysisPipeline>;
  let mockLlmService: jest.Mocked<LlmService>;
  let mockCustomConfigManager: jest.Mocked<ConfigurationManager>; // Renamed for clarity
  let mockGrammarEngine: jest.Mocked<GrammarEngine>;
  let mockStyleEngine: jest.Mocked<StyleEngine>;
  let mockLogger: jest.Mocked<winston.Logger>;

  let defaultConfig: AppConfig;
  let onChangeCallback: ((change: ConfigChange) => void) | undefined;

  beforeEach(() => {
    // mockLlmService is now mockLlmServiceInstance, configured by the module mock
    // (actualGetLlmService as jest.Mock).mockReturnValue(mockLlmServiceInstance); // This line is redundant due to module mock
    mockLlmService = mockLlmServiceInstance; // Use the instance from module mock

    defaultConfig = {
      version: 'test',
      logging: { level: 'info' },
      engine: { maxConcurrentTasks: 1, streamingEnabled: false },
      llm: {
        provider: 'ollama',
        model: 'test-model',
        contextSize: 2048,
        temperature: 0.7,
        ollamaHost: 'http://localhost:11434'
      },
      pipeline: { stages: [], batchSize: 1, timeout: 1000 },
      resources: { memory: {} as any, compute: {} as any, storage: {} as any},
      persistence: { storageType: 'file', location: '', backupEnabled: false, autoSaveIntervalMs: 0},
      analysis: {
        engines: {
          grammar: { enabled: true },
          style: { enabled: true },
        },
        textProcessor: { maxInputSize: 100000 },
        featureExtractor: { maxSegmentSize: 10000, maxKeywordsInputLength: 5000, sanitizeKeywords: true },
        maxSegmentsToProcess: 100,
      },
    };

    onChangeCallback = undefined;

    // Configure the mocked default singleton (mockDefaultConfigManagerMethods refers to its methods)
    mockDefaultConfigManagerMethods.getFullConfig.mockReturnValue(defaultConfig);
    mockDefaultConfigManagerMethods.get.mockImplementation((key: string, defVal?: any) => getPropertyInTest(defaultConfig, key, defVal));
    mockDefaultConfigManagerMethods.onChange.mockImplementation((path: string, cb: ChangeCallback): (() => void) => {
        if (path === 'analysis') {
          onChangeCallback = cb;
        }
        return jest.fn(); // Return an unsubscribe function
      });
    
    // Clear calls on the methods of the default singleton mock
    Object.values(mockDefaultConfigManagerMethods).forEach(mockFn => {
        if (jest.isMockFunction(mockFn)) {
            mockFn.mockClear();
        }
    });
    
    // This mock is for when we pass a custom config manager to the constructor
    mockCustomConfigManager = {
      ...mockDefaultConfigManagerMethods, // Spread all methods
      getFullConfig: jest.fn().mockReturnValue(defaultConfig), // Override specific methods for the custom mock
      get: jest.fn().mockImplementation((key: string, defVal?: any) => getPropertyInTest(defaultConfig, key, defVal)),
      onChange: jest.fn().mockImplementation((path: string, cb: ChangeCallback): (() => void) => {
        if (path === 'analysis') {
          onChangeCallback = cb;
        }
        return jest.fn();
      }),
      // Ensure all properties from mockDefaultConfigManagerMethods are here if needed for type assertion
    } as unknown as jest.Mocked<ConfigurationManager>;


    // Mock constructors of engines and pipeline
    (GrammarEngine as jest.Mock).mockImplementation(() => mockGrammarEngine);
    (StyleEngine as jest.Mock).mockImplementation(() => mockStyleEngine);
    (AnalysisPipeline as jest.Mock).mockImplementation(() => mockPipeline);

    mockPipeline = {
      analyzeText: jest.fn(),
      addEngine: jest.fn(),
      removeEngine: jest.fn(),
      getEngineNames: jest.fn().mockReturnValue([]),
      dispose: jest.fn().mockResolvedValue(undefined), // Mock dispose
    } as unknown as jest.Mocked<AnalysisPipeline>;

    mockGrammarEngine = {
        name: 'GrammarEngine',
        analyze: jest.fn(),
        dispose: jest.fn().mockResolvedValue(undefined),
    } as unknown as jest.Mocked<GrammarEngine>;
    
    mockStyleEngine = {
        name: 'StyleEngine',
        analyze: jest.fn(),
        dispose: jest.fn().mockResolvedValue(undefined),
    } as unknown as jest.Mocked<StyleEngine>;


    mockLogger = appLogger.child({ service: 'AnalysisOrchestrator' }) as jest.Mocked<winston.Logger>;
    (appLogger.child as jest.Mock).mockClear(); // Clear calls from previous tests or setups
    Object.values(mockLogger).forEach(mockFn => (mockFn as jest.Mock).mockClear());


    // Ensure AnalysisPipeline mock constructor is used by Orchestrator
    (AnalysisPipeline as jest.Mock).mockClear().mockImplementation(() => mockPipeline);
    (RateLimiter as jest.Mock).mockClear().mockImplementation(() => ({
        isAllowed: jest.fn().mockReturnValue(true), // Default to allowed
    }));
  });

  afterEach(() => {
    jest.clearAllMocks();
     // Reset the singleton instance for getAnalysisOrchestrator
     jest.resetModules(); // This will clear caches and allow re-evaluation of the module
     (sanitizeError as jest.Mock).mockClear();
  });

  describe('Constructor and Initialization', () => {
    it('should initialize with default services if none provided', () => {
      new AnalysisOrchestrator();
      expect(actualGetLlmService).toHaveBeenCalled();
      // Orchestrator calls getFullConfig on the (default) configManager instance
      expect(mockDefaultConfigManager.getFullConfig).toHaveBeenCalled();
      expect(appLogger.child).toHaveBeenCalledWith({ service: 'AnalysisOrchestrator' });
      expect(mockLogger.info).toHaveBeenCalledWith('AnalysisOrchestrator initialized.');
    });

    it('should initialize with custom services if provided', () => {
      new AnalysisOrchestrator(mockLlmService, mockCustomConfigManager);
      expect(actualGetLlmService).not.toHaveBeenCalled();
      expect(mockCustomConfigManager.getFullConfig).toHaveBeenCalled(); // Custom one is used
      expect(mockDefaultConfigManager.getFullConfig).not.toHaveBeenCalled(); // Default is not used
      expect(appLogger.child).toHaveBeenCalledWith({ service: 'AnalysisOrchestrator' });
    });

    it('should build pipeline config and instantiate AnalysisPipeline', () => {
      new AnalysisOrchestrator(mockLlmService, mockCustomConfigManager);
      expect(mockCustomConfigManager.getFullConfig).toHaveBeenCalled();
      expect(AnalysisPipeline).toHaveBeenCalledTimes(1);
      const expectedPipelineConfig: AnalysisPipelineConfig = {
        engines: [expect.any(GrammarEngine), expect.any(StyleEngine)],
        textProcessorConfig: { maxInputSize: defaultConfig.analysis?.textProcessor?.maxInputSize },
        featureExtractorConfig: {
          maxSegmentSize: defaultConfig.analysis?.featureExtractor?.maxSegmentSize,
          maxKeywordsInputLength: defaultConfig.analysis?.featureExtractor?.maxKeywordsInputLength,
          sanitizeKeywords: defaultConfig.analysis?.featureExtractor?.sanitizeKeywords
        },
        maxSegmentsToProcess: defaultConfig.analysis?.maxSegmentsToProcess,
      };
      expect(AnalysisPipeline).toHaveBeenCalledWith(expectedPipelineConfig, expect.anything()); // Second arg is logger
      expect(mockLogger.info).toHaveBeenCalledWith('Building pipeline with engines: GrammarEngine, StyleEngine', expect.any(Object));
    });

    it('should register an onChange listener for analysis configuration', () => {
      new AnalysisOrchestrator(mockLlmService, mockCustomConfigManager);
      expect(mockCustomConfigManager.onChange).toHaveBeenCalledWith('analysis', expect.any(Function));
    });
  });

  describe('buildPipelineConfig', () => {
    it('should enable GrammarEngine and StyleEngine by default', () => {
      // Test with the default config manager (mockDefaultConfigManagerMethods refers to its methods)
      new AnalysisOrchestrator(mockLlmService, undefined); // Uses default config manager
      expect(mockDefaultConfigManagerMethods.getFullConfig).toHaveBeenCalled();
      // The constructor will call buildPipelineConfig, which then creates engines.
      // We check the args to AnalysisPipeline constructor.
      const pipelineArgs = (AnalysisPipeline as jest.Mock).mock.calls[0][0] as { engines: any[] };
      expect(pipelineArgs.engines).toHaveLength(2);
      // expect(config.engines).toHaveLength(2); // This line was incorrect, 'config' is not defined here.
      expect(GrammarEngine).toHaveBeenCalledWith(mockLlmService, mockLogger.child({ engine: 'GrammarEngine' }));
      expect(StyleEngine).toHaveBeenCalledWith(mockLlmService, mockLogger.child({ engine: 'StyleEngine' }));
    });

    it('should disable GrammarEngine if config.analysis.engines.grammar.enabled is false', () => {
      mockDefaultConfigManager.getFullConfig.mockReturnValue({ // Configure the default singleton
        ...defaultConfig,
        analysis: { engines: { grammar: { enabled: false }, style: { enabled: true } } },
      });
      // AnalysisPipeline mock will be called with the engines list
      (AnalysisPipeline as jest.Mock).mockClear(); // Clear previous constructor calls
      new AnalysisOrchestrator(mockLlmService, undefined); // Uses default config manager
      
      const pipelineArgs = (AnalysisPipeline as jest.Mock).mock.calls[0][0] as { engines: any[] };
      expect(pipelineArgs.engines.some((e: any) => e instanceof GrammarEngine)).toBe(false);
      expect(pipelineArgs.engines.some((e: any) => e instanceof StyleEngine)).toBe(true);
    });

    it('should disable StyleEngine if config.analysis.engines.style.enabled is false', () => {
      mockDefaultConfigManager.getFullConfig.mockReturnValue({
        ...defaultConfig,
        analysis: { engines: { grammar: { enabled: true }, style: { enabled: false } } },
      });
      (AnalysisPipeline as jest.Mock).mockClear();
      new AnalysisOrchestrator(mockLlmService, undefined);
      
      const pipelineArgs = (AnalysisPipeline as jest.Mock).mock.calls[0][0] as { engines: any[] };
      expect(pipelineArgs.engines.some((e: any) => e instanceof GrammarEngine)).toBe(true);
      expect(pipelineArgs.engines.some((e: any) => e instanceof StyleEngine)).toBe(false);
    });

    it('should handle missing engine configuration gracefully (enable by default)', () => {
        mockDefaultConfigManager.getFullConfig.mockReturnValue({
            ...defaultConfig,
            analysis: { engines: {} },
          });
        (AnalysisPipeline as jest.Mock).mockClear();
        new AnalysisOrchestrator(mockLlmService, undefined);
        const pipelineArgs = (AnalysisPipeline as jest.Mock).mock.calls[0][0] as { engines: any[] };
        expect(pipelineArgs.engines).toHaveLength(2);
    });

    it('should handle missing analysis configuration gracefully (enable by default)', () => {
        mockDefaultConfigManager.getFullConfig.mockReturnValue({
            ...defaultConfig,
            analysis: undefined,
          });
        (AnalysisPipeline as jest.Mock).mockClear();
        new AnalysisOrchestrator(mockLlmService, undefined);
        const pipelineArgs = (AnalysisPipeline as jest.Mock).mock.calls[0][0] as { engines: any[] };
        expect(pipelineArgs.engines).toHaveLength(2);
    });
  });

  describe('analyze', () => {
    it('should call pipeline.analyzeText and return its results', async () => {
      const orchestrator = new AnalysisOrchestrator(mockLlmService, mockCustomConfigManager);
      const mockResults: AnalysisResult[] = [{ segmentId: 's1', engine: 'E1', findings: [] }];
      (mockPipeline.analyzeText as jest.Mock).mockResolvedValue(mockResults);

      const results = await orchestrator.analyze('Test text', 'doc1');
      
      expect(mockPipeline.analyzeText).toHaveBeenCalledWith('Test text', 'doc1');
      expect(results).toEqual(mockResults);
      expect(mockLogger.info).toHaveBeenCalledWith('Orchestrating analysis for document: doc1');
      expect(mockLogger.info).toHaveBeenCalledWith(`Analysis completed for document doc1. ${mockResults.length} results generated.`);
    });

    it('should log and return an error result if pipeline.analyzeText throws an error', async () => {
      const orchestrator = new AnalysisOrchestrator(mockLlmService, mockCustomConfigManager);
      const error = new Error('Pipeline failure');
      (mockPipeline.analyzeText as jest.Mock).mockRejectedValue(error);
      (sanitizeError as jest.Mock).mockImplementation((msg, _ctx) => `sanitized: ${msg}`);


      const results = await orchestrator.analyze('Test text', 'doc1');

      expect(results).toEqual([{
        segmentId: 'orchestration-error',
        engine: 'AnalysisOrchestrator',
        findings: [],
        error: 'sanitized: Pipeline failure',
      }]);
      expect(sanitizeError).toHaveBeenCalledWith('Pipeline failure', 'analysis for document doc1');
      expect(mockLogger.error).toHaveBeenCalledWith(
        'Error during analysis orchestration for document doc1: Pipeline failure',
        { error, documentId: 'doc1' }
      );
    });
  });

  describe('getPipeline', () => {
    it('should return the current pipeline instance', () => {
      const orchestrator = new AnalysisOrchestrator(mockLlmService, mockCustomConfigManager);
      expect(orchestrator.getPipeline()).toBe(mockPipeline);
    });
  });

  describe('Configuration Change Handling', () => {
    let orchestrator: AnalysisOrchestrator;
    let rateLimiterInstance: jest.Mocked<RateLimiter>;

    beforeEach(() => {
        rateLimiterInstance = { isAllowed: jest.fn().mockReturnValue(true) } as unknown as jest.Mocked<RateLimiter>;
        (RateLimiter as jest.Mock).mockImplementation(() => rateLimiterInstance);
        // orchestrator is created here to ensure the RateLimiter mock is in place
        orchestrator = new AnalysisOrchestrator(mockLlmService, undefined); // Uses default config manager
    });

    it('should re-initialize pipeline and dispose old one when analysis config changes', async () => {
      expect(AnalysisPipeline).toHaveBeenCalledTimes(1); // Initial
      const initialPipelineInstance = mockPipeline; // Grab the first instance

      expect(onChangeCallback).toBeDefined();
      if (onChangeCallback) {
        const newAnalysisConfig: AnalysisConfig = {
            ...defaultConfig.analysis,
            engines: { grammar: { enabled: false } }
        };
        mockDefaultConfigManager.getFullConfig.mockReturnValue({
            ...defaultConfig,
            analysis: newAnalysisConfig
        });
        
        // Create a new mock pipeline instance for the re-initialization
        const newMockPipeline = {
            ...mockPipeline,
            getEngineNames: jest.fn().mockReturnValue(['StyleEngine']),
            dispose: jest.fn().mockResolvedValue(undefined), // Ensure dispose is mocked
        } as unknown as jest.Mocked<AnalysisPipeline>; // Use unknown as intermediate cast
        (AnalysisPipeline as jest.Mock).mockImplementationOnce(() => newMockPipeline);


        await onChangeCallback({ path: 'analysis', oldValue: defaultConfig.analysis, newValue: newAnalysisConfig, timestamp: Date.now() });
        
        expect(rateLimiterInstance.isAllowed).toHaveBeenCalledWith('configUpdate');
        expect(mockLogger.info).toHaveBeenCalledWith('Analysis configuration changed. Re-initializing pipeline.', expect.any(Object));
        expect(AnalysisPipeline).toHaveBeenCalledTimes(2); // Re-initialized
        
        const lastCallArgs = (AnalysisPipeline as jest.Mock).mock.calls[1][0] as AnalysisPipelineConfig;
        expect(lastCallArgs.engines.find(e => (e as any).name === 'GrammarEngine')).toBeUndefined();
        expect(lastCallArgs.engines.find(e => (e as any).name === 'StyleEngine')).toBeDefined();

        expect(mockLogger.info).toHaveBeenCalledWith('AnalysisPipeline re-initialized with new configuration.');
        expect(initialPipelineInstance.dispose).toHaveBeenCalledTimes(1); // Old pipeline disposed
        expect(mockLogger.info).toHaveBeenCalledWith('Old pipeline disposed.');
      }
    });

    it('should skip re-initialization if rate limited', async () => {
        rateLimiterInstance.isAllowed.mockReturnValue(false); // Simulate rate limit
        expect(AnalysisPipeline).toHaveBeenCalledTimes(1); // Initial

        expect(onChangeCallback).toBeDefined();
        if (onChangeCallback) {
            await onChangeCallback({ path: 'analysis', oldValue: {}, newValue: {}, timestamp: Date.now() });
            expect(mockLogger.warn).toHaveBeenCalledWith('Pipeline re-initialization skipped due to rate limiting on config changes.');
            expect(AnalysisPipeline).toHaveBeenCalledTimes(1); // Not re-initialized
        }
    });
    
    it('should restore old pipeline if re-initialization fails', async () => {
        expect(AnalysisPipeline).toHaveBeenCalledTimes(1);
        const originalPipeline = mockPipeline;

        (AnalysisPipeline as jest.Mock).mockImplementationOnce(() => {
            throw new Error("Failed to create new pipeline");
        });

        expect(onChangeCallback).toBeDefined();
        if (onChangeCallback) {
            await onChangeCallback({ path: 'analysis', oldValue: {}, newValue: {}, timestamp: Date.now() });
            expect(mockLogger.error).toHaveBeenCalledWith('Failed to re-initialize pipeline after config change:', expect.any(Object));
            expect(orchestrator.getPipeline()).toBe(originalPipeline); // Check if old pipeline is restored
            expect(mockLogger.info).toHaveBeenCalledWith('Restored old pipeline due to re-initialization error.');
        }
    });
  });

  describe('getAnalysisOrchestrator Singleton', () => {
    // Need to re-import to test singleton behavior correctly after jest.resetModules()
    // These tests for the singleton `getAnalysisOrchestrator` need careful handling
    // of module caching with jest.resetModules() in afterEach.
    
    // These tests need to be adapted because the singleton pattern in orchestrator.ts
    // makes it hard to re-mock dependencies effectively after the first import.
    // For true isolation, the singleton might need a reset method or different testing strategy.

    it('should create a new instance if one does not exist', () => {
      const { getAnalysisOrchestrator: getOrch, AnalysisOrchestrator: OrchClass } = require('../orchestrator');
      const orchestrator1 = getOrch();
      expect(orchestrator1).toBeInstanceOf(OrchClass);
    });

    it('should return the existing instance on subsequent calls', () => {
      const { getAnalysisOrchestrator: getOrch } = require('../orchestrator');
      const orchestrator1 = getOrch();
      const orchestrator2 = getOrch();
      expect(orchestrator2).toBe(orchestrator1);
    });
  });

  describe('disposeAnalysisOrchestrator', () => {
    it('should call dispose on the singleton instance and set it to null', async () => {
        const { getAnalysisOrchestrator: getOrch, disposeAnalysisOrchestrator, AnalysisOrchestrator: OrchClass } = require('../orchestrator');
        const orchestrator = getOrch() as jest.Mocked<AnalysisOrchestrator>; // Cast to access dispose mock
        
        // Ensure dispose is a mock if not already by AnalysisOrchestrator mock
        // This is tricky because orchestrator is a real instance.
        // We rely on the pipeline's dispose being called.
        orchestrator.dispose = jest.fn().mockResolvedValue(undefined); // Mock dispose on the instance

        await disposeAnalysisOrchestrator();
        expect(orchestrator.dispose).toHaveBeenCalled();
        
        // Try to get it again, should be a new instance or null if logic was to nullify
        // The current implementation re-creates.
        const newOrchestrator = getOrch();
        expect(newOrchestrator).not.toBe(orchestrator); // Should be a new instance
        expect(newOrchestrator).toBeInstanceOf(OrchClass);
    });
  });
});