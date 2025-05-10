// Mock for a MetricsStorage (e.g., Prometheus, InfluxDB, or a simple store)
const mockMetricsStorage = {
  incrementCounter: jest.fn(), // (name: string, labels?: Record<string, string>, value?: number) => Promise<void>
  setGauge: jest.fn(), // (name: string, value: number, labels?: Record<string, string>) => Promise<void>
  observeHistogram: jest.fn(), // (name: string, value: number, labels?: Record<string, string>, buckets?: number[]) => Promise<void>
  getMetricValue: jest.fn(), // (name: string, labels?: Record<string, string>) => Promise<any | null>
};

// Placeholder for actual MetricsCollector implementation
// import { MetricsCollector } from '../../../../utils/analytics/metrics-collector';

interface MetricLabels {
  [key: string]: string | number; // Prometheus-style labels
}

class MetricsCollector {
  private defaultLabels: MetricLabels;
  constructor(
    private storage: typeof mockMetricsStorage,
    defaultLabels: MetricLabels = {}
  ) {
    this.defaultLabels = defaultLabels;
  }

  private mergeLabels(labels?: MetricLabels): MetricLabels {
    return { ...this.defaultLabels, ...labels };
  }

  async incrementCounter(name: string, labels?: MetricLabels, value: number = 1): Promise<void> {
    if (!name) throw new Error('Metric name is required for counter.');
    if (value <= 0) throw new Error('Counter increment value must be positive.');
    const mergedLabels = this.mergeLabels(labels);
    await this.storage.incrementCounter(name, mergedLabels, value);
  }

  async setGauge(name: string, value: number, labels?: MetricLabels): Promise<void> {
    if (!name) throw new Error('Metric name is required for gauge.');
    const mergedLabels = this.mergeLabels(labels);
    await this.storage.setGauge(name, value, mergedLabels);
  }

  async observeHistogram(name: string, value: number, labels?: MetricLabels, buckets?: number[]): Promise<void> {
    if (!name) throw new Error('Metric name is required for histogram.');
    const mergedLabels = this.mergeLabels(labels);
    await this.storage.observeHistogram(name, value, mergedLabels, buckets);
  }
  
  async measureDuration(name: string, labels?: MetricLabels, startTimeMs?: number): Promise<() => void> {
    const start = startTimeMs || Date.now();
    const mergedLabels = this.mergeLabels(labels);

    return () => {
        const durationMs = Date.now() - start;
        // Typically, duration is observed in a histogram or summary
        this.storage.observeHistogram(`${name}_duration_ms`, durationMs, mergedLabels);
        // console.log(`Duration for ${name} with labels ${JSON.stringify(mergedLabels)}: ${durationMs}ms`);
    };
  }

  async getMetric(name: string, labels?: MetricLabels): Promise<any | null> {
    if (!name) throw new Error('Metric name is required.');
    const mergedLabels = this.mergeLabels(labels);
    return this.storage.getMetricValue(name, mergedLabels);
  }
}

describe('MetricsCollector', () => {
  const defaultLabels = { service: 'iot-platform', region: 'us-east-1' };
  let metricsCollector: MetricsCollector;

  beforeEach(() => {
    mockMetricsStorage.incrementCounter.mockReset();
    mockMetricsStorage.setGauge.mockReset();
    mockMetricsStorage.observeHistogram.mockReset();
    mockMetricsStorage.getMetricValue.mockReset();

    metricsCollector = new MetricsCollector(mockMetricsStorage, defaultLabels);
  });

  describe('incrementCounter', () => {
    it('should increment a counter with default and custom labels', async () => {
      const metricName = 'api_requests_total';
      const customLabels = { endpoint: '/devices', method: 'POST' };
      await metricsCollector.incrementCounter(metricName, customLabels, 2);
      expect(mockMetricsStorage.incrementCounter).toHaveBeenCalledWith(
        metricName,
        { ...defaultLabels, ...customLabels },
        2
      );
    });

    it('should increment by 1 if value is not provided', async () => {
        await metricsCollector.incrementCounter('login_attempts');
        expect(mockMetricsStorage.incrementCounter).toHaveBeenCalledWith(
            'login_attempts',
            defaultLabels,
            1
        );
    });
    
    it('should throw if counter increment value is not positive', async () => {
        await expect(metricsCollector.incrementCounter('test_counter', {}, 0)).rejects.toThrow('Counter increment value must be positive.');
        await expect(metricsCollector.incrementCounter('test_counter', {}, -1)).rejects.toThrow('Counter increment value must be positive.');
    });
  });

  describe('setGauge', () => {
    it('should set a gauge value with labels', async () => {
      const metricName = 'connected_devices_current';
      const value = 150;
      const customLabels = { protocol: 'mqtt' };
      await metricsCollector.setGauge(metricName, value, customLabels);
      expect(mockMetricsStorage.setGauge).toHaveBeenCalledWith(
        metricName,
        value,
        { ...defaultLabels, ...customLabels }
      );
    });
  });

  describe('observeHistogram', () => {
    it('should observe a value in a histogram with labels and buckets', async () => {
      const metricName = 'request_latency_seconds';
      const value = 0.15; // 150ms
      const customLabels = { endpoint: '/status' };
      const buckets = [0.01, 0.05, 0.1, 0.25, 0.5, 1];
      await metricsCollector.observeHistogram(metricName, value, customLabels, buckets);
      expect(mockMetricsStorage.observeHistogram).toHaveBeenCalledWith(
        metricName,
        value,
        { ...defaultLabels, ...customLabels },
        buckets
      );
    });
  });
  
  describe('measureDuration', () => {
    jest.useFakeTimers(); // Use Jest's fake timers

    it('should record duration in a histogram when the returned function is called', async () => {
        const metricName = 'db_query';
        const customLabels = { table: 'users' };
        const startTime = Date.now();

        const endTimer = await metricsCollector.measureDuration(metricName, customLabels, startTime);
        
        const simulatedDuration = 123;
        jest.advanceTimersByTime(simulatedDuration); // Advance time by 123ms
        
        endTimer(); // Call the function returned by measureDuration

        expect(mockMetricsStorage.observeHistogram).toHaveBeenCalledWith(
            `${metricName}_duration_ms`,
            simulatedDuration,
            { ...defaultLabels, ...customLabels }
        );
    });

    it('should work without explicit startTimeMs', async () => {
        const endTimer = await metricsCollector.measureDuration('short_op');
        jest.advanceTimersByTime(50);
        endTimer();
        expect(mockMetricsStorage.observeHistogram).toHaveBeenCalledWith(
            'short_op_duration_ms',
            50,
            defaultLabels
        );
    });
    jest.useRealTimers(); // Restore real timers after these tests
  });


  describe('getMetric', () => {
    it('should retrieve a metric value with labels', async () => {
      const metricName = 'api_requests_total';
      const customLabels = { endpoint: '/devices' };
      const expectedValue = 1024;
      mockMetricsStorage.getMetricValue.mockResolvedValue(expectedValue);

      const value = await metricsCollector.getMetric(metricName, customLabels);
      expect(value).toBe(expectedValue);
      expect(mockMetricsStorage.getMetricValue).toHaveBeenCalledWith(
        metricName,
        { ...defaultLabels, ...customLabels }
      );
    });
  });
});