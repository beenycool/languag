// src/mesh/__tests__/observability/telemetry/metrics-collector.spec.ts
import { MetricsCollector, MetricDefinition, MetricType, MetricLabels } from '../../../observability/telemetry/metrics-collector';
import { ILoggingService, LogLevel } from '../../../../microservices/services/management/logging-service';

const mockLogger: ILoggingService = {
  log: jest.fn(), error: jest.fn(), warn: jest.fn(), info: jest.fn(),
  debug: jest.fn(), trace: jest.fn(), addTransport: jest.fn().mockResolvedValue(undefined),
  removeTransport: jest.fn().mockResolvedValue(undefined), setLogLevel: jest.fn(),
  getLogLevel: jest.fn().mockReturnValue(LogLevel.INFO), getChildLogger: jest.fn().mockReturnThis(),
};

describe('MetricsCollector', () => {
  let metricsCollector: MetricsCollector;

  const counterDef: MetricDefinition = { name: 'http_requests_total', help: 'Total HTTP requests', type: MetricType.COUNTER, labelNames: ['method', 'path', 'status'] };
  const gaugeDef: MetricDefinition = { name: 'active_connections', help: 'Active connections', type: MetricType.GAUGE, labelNames: ['service'] };
  const histogramDef: MetricDefinition = { name: 'request_duration_seconds', help: 'Request duration', type: MetricType.HISTOGRAM, labelNames: ['path'], buckets: [0.1, 0.5, 1, 5] };
  const summaryDef: MetricDefinition = { name: 'response_size_bytes', help: 'Response size', type: MetricType.SUMMARY, labelNames: ['path'], percentiles: [0.5, 0.9, 0.99] };

  beforeEach(() => {
    Object.values(mockLogger).forEach(m => { if(jest.isMockFunction(m)) m.mockClear(); });
    metricsCollector = new MetricsCollector(mockLogger);
  });

  describe('Metric Registration', () => {
    test('should register a new metric definition', () => {
      metricsCollector.registerMetric(counterDef);
      expect(metricsCollector['definitions'].has(counterDef.name)).toBe(true);
      expect(metricsCollector['metrics'].has(counterDef.name)).toBe(true);
      expect(mockLogger.debug).toHaveBeenCalledWith(`[MetricsCollector] Registering metric: ${counterDef.name}`, counterDef);
    });

    test('should not re-register an existing metric', () => {
      metricsCollector.registerMetric(counterDef);
      (mockLogger.debug as jest.Mock).mockClear();
      metricsCollector.registerMetric(counterDef); // Attempt to register again
      expect(mockLogger.warn).toHaveBeenCalledWith(`[MetricsCollector] Metric already registered: ${counterDef.name}. Skipping.`);
      expect(mockLogger.debug).not.toHaveBeenCalled(); // Should not log "Registering metric" again
    });
  });

  describe('Counter Operations', () => {
    beforeEach(() => {
      metricsCollector.registerMetric(counterDef);
    });

    test('should increment a counter', () => {
      const labels: MetricLabels = { method: 'GET', path: '/api/users', status: '200' };
      metricsCollector.incrementCounter(counterDef.name, labels, 1);
      const metricStore = metricsCollector['getMetricStorage'](counterDef.name, labels);
      expect(metricStore?.storage.get(metricStore.labelKey)).toBe(1);

      metricsCollector.incrementCounter(counterDef.name, labels, 2);
      expect(metricStore?.storage.get(metricStore.labelKey)).toBe(3);
    });

    test('should increment a counter without labels', () => {
        const simpleCounter: MetricDefinition = { name: 'simple_count', help: 'A simple counter', type: MetricType.COUNTER };
        metricsCollector.registerMetric(simpleCounter);
        metricsCollector.incrementCounter(simpleCounter.name);
        const metricStore = metricsCollector['getMetricStorage'](simpleCounter.name);
        expect(metricStore?.storage.get(metricStore.labelKey)).toBe(1);
    });

    test('should not increment non-counter or unregistered metric', () => {
      metricsCollector.incrementCounter(gaugeDef.name); // gaugeDef is not a counter
      expect(mockLogger.warn).toHaveBeenCalledWith(`[MetricsCollector] Attempted to increment non-counter or unregistered metric: ${gaugeDef.name}`);
      metricsCollector.incrementCounter('unregistered_counter');
      expect(mockLogger.warn).toHaveBeenCalledWith(`[MetricsCollector] Attempted to increment non-counter or unregistered metric: unregistered_counter`);
    });
  });

  describe('Gauge Operations', () => {
    beforeEach(() => {
      metricsCollector.registerMetric(gaugeDef);
    });

    test('should set a gauge value', () => {
      const labels: MetricLabels = { service: 'auth-service' };
      metricsCollector.setGauge(gaugeDef.name, 15, labels);
      const metricStore = metricsCollector['getMetricStorage'](gaugeDef.name, labels);
      expect(metricStore?.storage.get(metricStore.labelKey)).toBe(15);

      metricsCollector.setGauge(gaugeDef.name, 10, labels);
      expect(metricStore?.storage.get(metricStore.labelKey)).toBe(10);
    });
    
    test('should not set non-gauge or unregistered metric', () => {
      metricsCollector.setGauge(counterDef.name, 10); 
      expect(mockLogger.warn).toHaveBeenCalledWith(`[MetricsCollector] Attempted to set non-gauge or unregistered metric: ${counterDef.name}`);
    });
  });

  describe('Histogram Operations', () => {
    beforeEach(() => {
      metricsCollector.registerMetric(histogramDef);
    });

    test('should observe a value for a histogram', () => {
      const labels: MetricLabels = { path: '/api/data' };
      metricsCollector.observeHistogram(histogramDef.name, 0.5, labels);
      metricsCollector.observeHistogram(histogramDef.name, 1.2, labels);
      const metricStore = metricsCollector['getMetricStorage'](histogramDef.name, labels);
      const observations = metricStore?.storage.get(metricStore.labelKey) as number[];
      expect(observations).toEqual([0.5, 1.2]);
    });
    
    test('should not observe non-histogram or unregistered metric', () => {
      metricsCollector.observeHistogram(counterDef.name, 0.5); 
      expect(mockLogger.warn).toHaveBeenCalledWith(`[MetricsCollector] Attempted to observe non-histogram or unregistered metric: ${counterDef.name}`);
    });
  });

  describe('Summary Operations', () => {
     beforeEach(() => {
      metricsCollector.registerMetric(summaryDef);
    });

    test('should observe a value for a summary', () => {
      const labels: MetricLabels = { path: '/api/files' };
      metricsCollector.observeSummary(summaryDef.name, 1024, labels);
      metricsCollector.observeSummary(summaryDef.name, 2048, labels);
      const metricStore = metricsCollector['getMetricStorage'](summaryDef.name, labels);
      const observations = metricStore?.storage.get(metricStore.labelKey) as number[];
      expect(observations).toEqual([1024, 2048]);
    });

    test('should not observe non-summary or unregistered metric', () => {
      metricsCollector.observeSummary(counterDef.name, 100); 
      expect(mockLogger.warn).toHaveBeenCalledWith(`[MetricsCollector] Attempted to observe non-summary or unregistered metric: ${counterDef.name}`);
    });
  });

  describe('Expose Metrics', () => {
    test('should expose metrics in a simple text format', async () => {
      metricsCollector.registerMetric(counterDef);
      metricsCollector.registerMetric(gaugeDef);
      metricsCollector.registerMetric(histogramDef); // Will be simplified

      metricsCollector.incrementCounter(counterDef.name, { method: 'POST', path: '/submit', status: '201' }, 3);
      metricsCollector.setGauge(gaugeDef.name, 5, { service: 'worker-1' });
      metricsCollector.observeHistogram(histogramDef.name, 0.7, { path: '/test' });
      metricsCollector.observeHistogram(histogramDef.name, 1.5, { path: '/test' });


      const exposed = await metricsCollector.exposeMetrics();
      
      expect(exposed).toContain(`# HELP ${counterDef.name} ${counterDef.help}`);
      expect(exposed).toContain(`# TYPE ${counterDef.name} ${counterDef.type.toLowerCase()}`);
      expect(exposed).toContain(`${counterDef.name}{method="POST",path="/submit",status="201"} 3`);

      expect(exposed).toContain(`# HELP ${gaugeDef.name} ${gaugeDef.help}`);
      expect(exposed).toContain(`# TYPE ${gaugeDef.name} ${gaugeDef.type.toLowerCase()}`);
      expect(exposed).toContain(`${gaugeDef.name}{service="worker-1"} 5`);
      
      expect(exposed).toContain(`# HELP ${histogramDef.name} ${histogramDef.help}`);
      expect(exposed).toContain(`# TYPE ${histogramDef.name} ${histogramDef.type.toLowerCase()}`);
      expect(exposed).toContain(`${histogramDef.name}_sum{path="/test"} 2.2`); // 0.7 + 1.5
      expect(exposed).toContain(`${histogramDef.name}_count{path="/test"} 2`);
    });

    test('should expose metrics with no labels correctly', async () => {
        const simpleGauge: MetricDefinition = { name: 'uptime_seconds', help: 'System uptime', type: MetricType.GAUGE };
        metricsCollector.registerMetric(simpleGauge);
        metricsCollector.setGauge(simpleGauge.name, 12345);
        const exposed = await metricsCollector.exposeMetrics();
        expect(exposed).toContain(`${simpleGauge.name} 12345`);
    });
  });
});