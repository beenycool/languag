import { MetricsCollector, OverallMetrics, EngineMetrics } from '../metrics';
import { AnalysisResult, Finding } from '../../types';
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
    ...mockLog,
  };
});

describe('MetricsCollector', () => {
  let metricsCollector: MetricsCollector;
  let mockLogger: jest.Mocked<ReturnType<typeof appLogger.child>>;

  // Helper function to create mock AnalysisResult
  const createMockResult = (
    segmentId: string,
    engine: string,
    findings: Finding[],
    error?: string
  ): AnalysisResult => ({
    segmentId,
    engine,
    findings,
    error,
  });

  const defaultAllowedTypes = ['grammar', 'style', 'spelling', 'unknown'];

  beforeEach(() => {
    metricsCollector = new MetricsCollector(defaultAllowedTypes);
    mockLogger = appLogger.child({ utility: 'MetricsCollector' }) as jest.Mocked<ReturnType<typeof appLogger.child>>;
    // Clear logger mocks
    (appLogger.child as jest.Mock).mockClear();
    Object.values(mockLogger).forEach(mockFn => {
        if (jest.isMockFunction(mockFn)) {
            mockFn.mockClear();
        }
    });
  });

  it('should initialize correctly', () => {
    expect(metricsCollector).toBeDefined();
    expect(mockLogger.info).toHaveBeenCalledWith('MetricsCollector initialized.', { allowedFindingTypes: defaultAllowedTypes });
  });

  describe('addResults (Incremental Processing)', () => {
    it('should add results and increment document count, updating aggregated data', () => {
      const results1: AnalysisResult[] = [createMockResult('s1', 'E1', [{type: 'grammar', message: 'm', severity: 'error'}], undefined)];
      metricsCollector.addResults(results1, 1);
      // Access private members for assertion (generally not ideal, but for testing internal state)
      expect((metricsCollector as any).resultsCount).toBe(1);
      expect((metricsCollector as any).documentCount).toBe(1);
      expect((metricsCollector as any).aggregatedFindingsByType['grammar']).toBe(1);
      expect(mockLogger.debug).toHaveBeenCalledWith(expect.stringContaining('Incrementally processed 1 results. Total results count: 1. Document count: 1'));

      const results2: AnalysisResult[] = [
        createMockResult('s2', 'E1', [{type: 'style', message: 'm', severity: 'warning'}], undefined),
        createMockResult('s2', 'E2', [{type: 'spelling', message: 'm', severity: 'info'}], 'Error E2'),
      ];
      metricsCollector.addResults(results2, 1); // Add results for another document
      expect((metricsCollector as any).resultsCount).toBe(3);
      expect((metricsCollector as any).documentCount).toBe(2);
      expect((metricsCollector as any).aggregatedFindingsByType['style']).toBe(1);
      expect((metricsCollector as any).aggregatedFindingsByType['spelling']).toBe(1);
      expect((metricsCollector as any).aggregatedTotalErrorsAcrossEngines).toBe(1);
      expect(mockLogger.debug).toHaveBeenCalledWith(expect.stringContaining('Incrementally processed 2 results. Total results count: 3. Document count: 2'));
    });

    it('should use default document increment of 1 if not provided', () => {
        const results: AnalysisResult[] = [createMockResult('s1', 'E1', [], undefined)];
        metricsCollector.addResults(results);
        expect((metricsCollector as any).documentCount).toBe(1);
    });

    it('should sanitize finding types to allowed set or "unknown"', () => {
      const allowedTypes = ['typeA', 'typeB'];
      const collectorWithSpecificTypes = new MetricsCollector(allowedTypes);
      const results: AnalysisResult[] = [
        createMockResult('s1', 'E1', [{ type: 'typeA', message: 'm', severity: 'info' }], undefined),
        createMockResult('s1', 'E1', [{ type: 'typeC_unknown', message: 'm', severity: 'info' }], undefined),
      ];
      collectorWithSpecificTypes.addResults(results);
      const metrics = collectorWithSpecificTypes.calculateMetrics();
      expect(metrics.findingsByType['typeA']).toBe(1);
      expect(metrics.findingsByType['unknown']).toBe(1);
      expect(metrics.findingsByType['typeC_unknown']).toBeUndefined();
    });
  });

  describe('reset', () => {
    it('should clear all aggregated data and reset counts', () => {
      metricsCollector.addResults([createMockResult('s1', 'E1', [{type: 'grammar', message: 'm', severity: 'error'}], undefined)], 1);
      metricsCollector.reset();
      expect((metricsCollector as any).resultsCount).toBe(0);
      expect((metricsCollector as any).documentCount).toBe(0);
      expect((metricsCollector as any).aggregatedFindingsByType).toEqual({});
      expect((metricsCollector as any).aggregatedSegmentsProcessed.size).toBe(0);
      expect(mockLogger.info).toHaveBeenCalledWith('MetricsCollector reset.');
    });
  });

  describe('calculateMetrics', () => {
    it('should return default empty metrics if no results are added', () => {
      const metrics = metricsCollector.calculateMetrics(); // No results added yet
      expect(metrics).toEqual({
        totalDocumentsAnalyzed: 0,
        totalSegmentsAnalyzed: 0,
        totalResultsGenerated: 0, // This is resultsCount
        totalErrorsAcrossEngines: 0,
        findingsByType: {},
        findingsBySeverity: { error: 0, warning: 0, info: 0 },
        engineSpecificMetrics: [],
      });
      expect(mockLogger.warn).toHaveBeenCalledWith('No results have been added to calculate metrics.');
    });

    it('should correctly calculate metrics from aggregated data', () => {
      const results: AnalysisResult[] = [
        createMockResult('s1', 'Grammar', [{ type: 'grammar', message: 'm1', severity: 'error' }], undefined),
        createMockResult('s1', 'Style', [{ type: 'style', message: 'm2', severity: 'warning' }], undefined),
        createMockResult('s2', 'Grammar', [{ type: 'grammar', message: 'm3', severity: 'error' }, { type: 'punctuation', message: 'm4', severity: 'warning' }], undefined),
        createMockResult('s2', 'Style', [], 'Style Engine Failed'),
        createMockResult('s3', 'Style', [{ type: 'style', message: 'm5', severity: 'info' }], undefined),
      ];
      // Manually add 'punctuation' to allowed types for this test if not default
      const customCollector = new MetricsCollector([...defaultAllowedTypes, 'punctuation']);
      customCollector.addResults(results, 2);

      const metrics = customCollector.calculateMetrics();

      expect(metrics.totalDocumentsAnalyzed).toBe(2);
      expect(metrics.totalSegmentsAnalyzed).toBe(3);
      expect(metrics.totalResultsGenerated).toBe(5);
      expect(metrics.totalErrorsAcrossEngines).toBe(1);

      expect(metrics.findingsByType).toEqual({ grammar: 2, style: 2, punctuation: 1 });
      expect(metrics.findingsBySeverity).toEqual({ error: 2, warning: 2, info: 1 });

      expect(metrics.engineSpecificMetrics).toHaveLength(2);
      const grammarMetrics = metrics.engineSpecificMetrics.find(m => m.engineName === 'Grammar');
      expect(grammarMetrics?.totalSegmentsProcessed).toBe(2);
      expect(grammarMetrics?.totalFindings).toBe(3);
      expect(grammarMetrics?.averageFindingsPerSegment).toBe(1.5);
      expect(grammarMetrics?.errorCount).toBe(0);

      const styleMetrics = metrics.engineSpecificMetrics.find(m => m.engineName === 'Style');
      expect(styleMetrics?.totalSegmentsProcessed).toBe(3);
      expect(styleMetrics?.totalFindings).toBe(2);
      expect(styleMetrics?.averageFindingsPerSegment).toBeCloseTo(2 / 3);
      expect(styleMetrics?.errorCount).toBe(1);

      expect(mockLogger.info).toHaveBeenCalledWith('Metrics calculated successfully.', expect.any(Object));
    });
  });

  describe('Auto Reset and Dispose', () => {
    jest.useFakeTimers();

    it('should schedule auto-reset if interval is provided', () => {
      const autoResetIntervalMs = 1000;
      const collector = new MetricsCollector(defaultAllowedTypes, autoResetIntervalMs);
      const resetSpy = jest.spyOn(collector, 'reset');
      
      expect((collector as any).resetInterval).toBe(autoResetIntervalMs);
      expect((collector as any).resetTimer).toBeDefined();

      jest.advanceTimersByTime(autoResetIntervalMs -1);
      expect(resetSpy).not.toHaveBeenCalled();
      
      jest.advanceTimersByTime(1);
      expect(resetSpy).toHaveBeenCalledTimes(1);
      expect(mockLogger.info).toHaveBeenCalledWith(`Auto-resetting metrics collector after ${autoResetIntervalMs}ms.`);
      
      // Check if it reschedules
      jest.advanceTimersByTime(autoResetIntervalMs);
      expect(resetSpy).toHaveBeenCalledTimes(2);

      collector.dispose(); // Should clear the timer
      resetSpy.mockRestore();
    });

    it('dispose should clear the auto-reset timer', () => {
      const collector = new MetricsCollector(defaultAllowedTypes, 1000);
      const clearTimeoutSpy = jest.spyOn(global, 'clearTimeout');
      
      collector.dispose();
      expect(clearTimeoutSpy).toHaveBeenCalledWith((collector as any).resetTimer); // Timer ID might be opaque
      expect((collector as any).resetTimer).toBeNull();
      expect(mockLogger.info).toHaveBeenCalledWith('MetricsCollector auto-reset timer cleared.');
      clearTimeoutSpy.mockRestore();
    });

    it('should not schedule auto-reset if interval is not positive', () => {
      const collector1 = new MetricsCollector(defaultAllowedTypes, 0);
      expect((collector1 as any).resetTimer).toBeNull();
      const collector2 = new MetricsCollector(defaultAllowedTypes, -100);
      expect((collector2 as any).resetTimer).toBeNull();
    });

    afterEach(() => {
        jest.clearAllTimers();
    });
    jest.useRealTimers(); // Restore real timers after these tests
  });
});