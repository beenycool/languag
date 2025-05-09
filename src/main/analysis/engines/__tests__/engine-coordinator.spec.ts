// src/main/analysis/engines/__tests__/engine-coordinator.spec.ts

import { EngineCoordinator, IEngineCoordinatorConfig } from '../engine-coordinator';
import { IAnalysisEngine, AnalysisResult, ExtractedFeatures } from '../../types';
import { IDocumentSegment, IDocumentContext } from '../../context/document-context';
import appLogger from '../../../services/logger';
import * as winston from 'winston';

// Mock logger
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
  };
});

// Mock IAnalysisEngine
const createMockEngine = (name: string): jest.Mocked<IAnalysisEngine> => ({
  name,
  analyze: jest.fn(),
  dispose: jest.fn(),
});

describe('EngineCoordinator', () => {
  let coordinator: EngineCoordinator;
  let mockEngineA: jest.Mocked<IAnalysisEngine>;
  let mockEngineB: jest.Mocked<IAnalysisEngine>;
  let mockLogger: jest.Mocked<winston.Logger>;

  const mockSegment: IDocumentSegment = { id: 'seg-coord-1', text: 'Test segment', range: { start: 0, end: 12 } };
  const mockDocContext: IDocumentContext = { uri: 'doc-coord.txt', language: 'en' };
  const mockFeatures: ExtractedFeatures = { wordCount: 2, sentenceCount: 1, keywords: ['test'] };


  beforeEach(() => {
    jest.clearAllMocks();
    mockEngineA = createMockEngine('EngineA');
    mockEngineB = createMockEngine('EngineB');
    
    mockLogger = {
        info: jest.fn(),
        warn: jest.fn(),
        error: jest.fn(),
        debug: jest.fn(),
        child: jest.fn().mockReturnThis(),
      } as unknown as jest.Mocked<winston.Logger>;

    coordinator = new EngineCoordinator({}, mockLogger); // Default config, provide mock logger
  });

  describe('Constructor', () => {
    it('should initialize with default config', () => {
      const defaultConfigCoordinator = new EngineCoordinator(); // Uses appLogger.child
      expect(appLogger.child).toHaveBeenCalledWith({ service: 'EngineCoordinator' });
      // @ts-ignore - access private config
      expect(defaultConfigCoordinator.config).toEqual({
        enableCaching: false,
        maxCacheSize: 100,
      });
    });

    it('should initialize with provided config and logger', () => {
      const config: IEngineCoordinatorConfig = { enableCaching: true, maxCacheSize: 50 };
      const coordWithConfig = new EngineCoordinator(config, mockLogger);
      expect(mockLogger.child).toHaveBeenCalledWith({ service: 'EngineCoordinator' });
      // @ts-ignore
      expect(coordWithConfig.config).toEqual(config);
    });
  });

  describe('registerEngine and unregisterEngine', () => {
    it('should register an engine', () => {
      coordinator.registerEngine(mockEngineA);
      // @ts-ignore
      expect(coordinator.registeredEngines.get('EngineA')).toBe(mockEngineA);
      expect(mockLogger.info).toHaveBeenCalledWith("Engine 'EngineA' registered with coordinator.");
    });

    it('should warn if registering an already registered engine', () => {
      coordinator.registerEngine(mockEngineA);
      coordinator.registerEngine(mockEngineA); // Register again
      expect(mockLogger.warn).toHaveBeenCalledWith("Engine 'EngineA' is already registered.");
      // @ts-ignore
      expect(coordinator.registeredEngines.size).toBe(1);
    });

    it('should unregister an engine', () => {
      coordinator.registerEngine(mockEngineA);
      coordinator.unregisterEngine('EngineA');
      // @ts-ignore
      expect(coordinator.registeredEngines.has('EngineA')).toBe(false);
      expect(mockLogger.info).toHaveBeenCalledWith("Engine 'EngineA' unregistered from coordinator.");
    });

    it('should warn if unregistering a non-existent engine', () => {
      coordinator.unregisterEngine('NonExistentEngine');
      expect(mockLogger.warn).toHaveBeenCalledWith("Engine 'NonExistentEngine' not found for unregistration.");
    });
  });

  describe('queryEngine', () => {
    beforeEach(() => {
      coordinator.registerEngine(mockEngineA);
      coordinator.registerEngine(mockEngineB);
    });

    it('should return undefined if target engine is not found', async () => {
      const result = await coordinator.queryEngine('EngineA', 'NonExistentEngine', mockSegment, mockDocContext);
      expect(result).toBeUndefined();
      expect(mockLogger.error).toHaveBeenCalledWith("Target engine 'NonExistentEngine' not found for query by 'EngineA'.");
    });

    it('should call analyze on the target engine and return its result', async () => {
      const expectedAnalysisResult: AnalysisResult = { segmentId: mockSegment.id, engine: 'EngineB', findings: [] };
      mockEngineB.analyze.mockResolvedValue(expectedAnalysisResult);

      const result = await coordinator.queryEngine('EngineA', 'EngineB', mockSegment, mockDocContext, { features: mockFeatures });
      
      expect(mockEngineB.analyze).toHaveBeenCalledWith(mockSegment, mockDocContext, mockFeatures);
      expect(result).toBe(expectedAnalysisResult);
      expect(mockLogger.info).toHaveBeenCalledWith("Engine 'EngineA' querying 'EngineB'.");
    });

    it('should return undefined and log error if target engine analyze method throws', async () => {
      const error = new Error('Analysis failed');
      mockEngineB.analyze.mockRejectedValue(error);

      const result = await coordinator.queryEngine('EngineA', 'EngineB', mockSegment, mockDocContext);
      
      expect(result).toBeUndefined();
      expect(mockLogger.error).toHaveBeenCalledWith(
        "Error during query from 'EngineA' to 'EngineB': Analysis failed",
        { error }
      );
    });
    
    it('should return undefined if target engine does not have an analyze method (conceptual)', async () => {
        const mockEngineCNoAnalyze = { name: 'EngineC' } as IAnalysisEngine; // No analyze method
        coordinator.registerEngine(mockEngineCNoAnalyze);
        
        const result = await coordinator.queryEngine('EngineA', 'EngineC', mockSegment, mockDocContext);
        expect(result).toBeUndefined();
        expect(mockLogger.warn).toHaveBeenCalledWith("Target engine 'EngineC' does not have a standard 'analyze' method for querying.");
    });
  });

  describe('Shared Data Cache (setSharedData, getSharedData, clearSharedCache)', () => {
    it('should not use cache if enableCaching is false (default)', () => {
      coordinator.setSharedData('key1', 'data1');
      expect(coordinator.getSharedData('key1')).toBeUndefined();
      // @ts-ignore
      expect(coordinator.sharedDataCache.size).toBe(0);
    });

    describe('when caching is enabled', () => {
      beforeEach(() => {
        coordinator = new EngineCoordinator({ enableCaching: true, maxCacheSize: 2 }, mockLogger);
      });

      it('should set and get data from shared cache', () => {
        coordinator.setSharedData('key1', 'data1');
        expect(coordinator.getSharedData('key1')).toBe('data1');
        expect(mockLogger.debug).toHaveBeenCalledWith("Data stored in shared cache with key: key1");
      });

      it('should return undefined for non-existent key', () => {
        expect(coordinator.getSharedData('nonExistentKey')).toBeUndefined();
      });

      it('should evict oldest item when maxCacheSize is reached', () => {
        coordinator.setSharedData('key1', 'data1'); // Oldest
        coordinator.setSharedData('key2', 'data2');
        expect(coordinator.getSharedData('key1')).toBe('data1');
        expect(coordinator.getSharedData('key2')).toBe('data2');
        
        coordinator.setSharedData('key3', 'data3'); // This should evict key1
        
        expect(coordinator.getSharedData('key1')).toBeUndefined();
        expect(coordinator.getSharedData('key2')).toBe('data2');
        expect(coordinator.getSharedData('key3')).toBe('data3');
        // @ts-ignore
        expect(coordinator.sharedDataCache.size).toBe(2);
      });

      it('should clear the shared cache', () => {
        coordinator.setSharedData('key1', 'data1');
        coordinator.clearSharedCache();
        expect(coordinator.getSharedData('key1')).toBeUndefined();
        // @ts-ignore
        expect(coordinator.sharedDataCache.size).toBe(0);
        expect(mockLogger.info).toHaveBeenCalledWith('Shared data cache cleared.');
      });

      // TTL logic is marked as TODO in implementation, so not testing expiration yet.
    });
  });
});