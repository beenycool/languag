// src/mesh/__tests__/observability/monitoring/performance-monitor.spec.ts
import { PerformanceMonitor, PerformanceAlertConfig } from '../../../observability/monitoring/performance-monitor';
import { MetricsCollector, MetricLabels, MetricType, MetricDefinition } from '../../../observability/telemetry/metrics-collector';
import { ILoggingService, LogLevel } from '../../../../microservices/services/management/logging-service';

jest.mock('../../../observability/telemetry/metrics-collector'); // Mock MetricsCollector

const mockLogger: ILoggingService = {
  log: jest.fn(), error: jest.fn(), warn: jest.fn(), info: jest.fn(),
  debug: jest.fn(), trace: jest.fn(), addTransport: jest.fn().mockResolvedValue(undefined),
  removeTransport: jest.fn().mockResolvedValue(undefined), setLogLevel: jest.fn(),
  getLogLevel: jest.fn().mockReturnValue(LogLevel.INFO), getChildLogger: jest.fn().mockReturnThis(),
};

describe('PerformanceMonitor', () => {
  let performanceMonitor: PerformanceMonitor;
  let mockMetricsCollector: jest.Mocked<MetricsCollector>;

  beforeEach(() => {
    Object.values(mockLogger).forEach(m => { if(jest.isMockFunction(m)) m.mockClear(); });
    
    // Create a new mock instance for MetricsCollector for each test
    // The constructor of MetricsCollector is mocked by jest.mock above.
    // We need to ensure its methods are also mocks.
    mockMetricsCollector = new MetricsCollector(mockLogger) as jest.Mocked<MetricsCollector>;
    // Ensure all methods on the instance are jest.fn()
    mockMetricsCollector.registerMetric = jest.fn();
    mockMetricsCollector.incrementCounter = jest.fn();
    mockMetricsCollector.setGauge = jest.fn();
    mockMetricsCollector.observeHistogram = jest.fn();
    mockMetricsCollector.observeSummary = jest.fn();
    mockMetricsCollector.exposeMetrics = jest.fn().mockResolvedValue("");


    performanceMonitor = new PerformanceMonitor(mockMetricsCollector, mockLogger);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('Initialization', () => {
    test('should initialize with MetricsCollector and register default metrics', () => {
      expect(performanceMonitor['metricsCollector']).toBe(mockMetricsCollector);
      expect(mockLogger.info).toHaveBeenCalledWith('[PerfMonitor] PerformanceMonitor initialized.');
      // Check if default metrics were registered
      expect(mockMetricsCollector.registerMetric).toHaveBeenCalledWith(
        expect.objectContaining({ name: 'mesh_request_duration_ms', type: MetricType.HISTOGRAM })
      );
      expect(mockMetricsCollector.registerMetric).toHaveBeenCalledWith(
        expect.objectContaining({ name: 'mesh_request_count_total', type: MetricType.COUNTER })
      );
       expect(mockMetricsCollector.registerMetric).toHaveBeenCalledWith(
        expect.objectContaining({ name: 'mesh_error_rate_percent', type: MetricType.GAUGE })
      );
       expect(mockMetricsCollector.registerMetric).toHaveBeenCalledWith(
        expect.objectContaining({ name: 'mesh_throughput_rps', type: MetricType.GAUGE })
      );
      expect(mockLogger.debug).toHaveBeenCalledWith('[PerfMonitor] Default performance metrics registered with MetricsCollector.');
    });
  });

  describe('recordDataPoint', () => {
    const labels: MetricLabels = { service: 's1', path: '/p1' };

    test('should call incrementCounter on MetricsCollector for COUNTER type', () => {
      performanceMonitor.recordDataPoint('test_counter', MetricType.COUNTER, 1, labels);
      expect(mockMetricsCollector.incrementCounter).toHaveBeenCalledWith('test_counter', labels, 1);
    });

    test('should call setGauge on MetricsCollector for GAUGE type', () => {
      performanceMonitor.recordDataPoint('test_gauge', MetricType.GAUGE, 100, labels);
      expect(mockMetricsCollector.setGauge).toHaveBeenCalledWith('test_gauge', 100, labels);
    });

    test('should call observeHistogram on MetricsCollector for HISTOGRAM type', () => {
      performanceMonitor.recordDataPoint('test_hist', MetricType.HISTOGRAM, 0.5, labels);
      expect(mockMetricsCollector.observeHistogram).toHaveBeenCalledWith('test_hist', 0.5, labels);
    });

    test('should call observeSummary on MetricsCollector for SUMMARY type', () => {
      performanceMonitor.recordDataPoint('test_summary', MetricType.SUMMARY, 1234, labels);
      expect(mockMetricsCollector.observeSummary).toHaveBeenCalledWith('test_summary', 1234, labels);
    });
    
    test('should log warning for unknown metric type', () => {
        performanceMonitor.recordDataPoint('test_unknown', 'UNKNOWN_TYPE' as MetricType, 1, labels);
        expect(mockLogger.warn).toHaveBeenCalledWith(
            '[PerfMonitor] Unknown metric type for data point: UNKNOWN_TYPE',
            { metricName: 'test_unknown' }
        );
    });
  });

  describe('analyzePerformance (Placeholder)', () => {
    test('should call exposeMetrics and attempt to parse (placeholder logic)', async () => {
      const metricName = 'mesh_request_duration_ms';
      const filterLabels: MetricLabels = { service: 's1' };
      mockMetricsCollector.exposeMetrics.mockResolvedValueOnce(
        `# HELP ${metricName} ...\n# TYPE ${metricName} histogram\n${metricName}{service="s1",path="/p1",le="0.1"} 0\n${metricName}_sum{service="s1"} 150\n${metricName}_count{service="s1"} 10`
      );
      
      const analysis = await performanceMonitor.analyzePerformance(metricName, filterLabels, 60);
      expect(mockMetricsCollector.exposeMetrics).toHaveBeenCalledTimes(1);
      // The current placeholder parsing is very basic and might not find sum/count correctly.
      // This test mainly verifies the interaction.
      // If lineMatchesLabels was more robust, we could test value.
      // For now, check that it returns something.
      expect(analysis).toEqual(expect.objectContaining({ metricName, analysis: expect.stringContaining("placeholder") }));
    });
  });

  describe('Alert Rule Management and Checking (Placeholder)', () => {
    const alertRule1: PerformanceAlertConfig = {
      metricName: 'mesh_error_rate_percent',
      threshold: 5,
      comparison: 'ABOVE',
      durationSeconds: 60,
      severity: 'CRITICAL',
      labelsFilter: { service: 'checkout' }
    };

    test('addAlertRule should store the alert rule', () => {
      performanceMonitor.addAlertRule('errorRateCheckout', alertRule1);
      expect(performanceMonitor['alertRules'].get('errorRateCheckout')).toEqual(alertRule1);
      expect(mockLogger.info).toHaveBeenCalledWith('[PerfMonitor] Adding alert rule: errorRateCheckout', alertRule1);
    });

    test('removeAlertRule should remove a stored rule', () => {
      performanceMonitor.addAlertRule('errorRateCheckout', alertRule1);
      performanceMonitor.removeAlertRule('errorRateCheckout');
      expect(performanceMonitor['alertRules'].has('errorRateCheckout')).toBe(false);
      expect(mockLogger.info).toHaveBeenCalledWith('[PerfMonitor] Removed alert rule: errorRateCheckout');
    });
    
    test('removeAlertRule should warn if rule does not exist', () => {
      performanceMonitor.removeAlertRule('nonExistentRule');
      expect(mockLogger.warn).toHaveBeenCalledWith('[PerfMonitor] Attempted to remove non-existent alert rule: nonExistentRule');
    });

    test('checkAlerts should return empty array (placeholder logic)', async () => {
      performanceMonitor.addAlertRule('errorRateCheckout', alertRule1);
      // Mock analyzePerformance to simulate data that does NOT trigger the alert
      jest.spyOn(performanceMonitor, 'analyzePerformance').mockResolvedValue({ currentValue: 2 }); // Below threshold

      const triggered = await performanceMonitor.checkAlerts();
      expect(triggered).toEqual([]);
      expect(mockLogger.info).toHaveBeenCalledWith('[PerfMonitor] 0 alerts triggered (placeholder logic).');
    });

    // TODO: More detailed tests for checkAlerts when its logic is implemented
    // For example, mock analyzePerformance to return breaching values and check if alerts are triggered.
    // test('checkAlerts should trigger alert if threshold breached', async () => {
    //   performanceMonitor.addAlertRule('errorRateCheckout', alertRule1);
    //   jest.spyOn(performanceMonitor, 'analyzePerformance').mockResolvedValue({ currentValue: 10 }); // Breaches threshold of 5
    //   const triggered = await performanceMonitor.checkAlerts();
    //   expect(triggered).toEqual([alertRule1]);
    // });
  });
});