// src/microservices/utils/monitoring/performance-monitor.ts

import { IMetricsService, MetricLabels } from '../../services/management/metrics-service'; // Assuming MetricsService is available
import { ILoggingService, LogLevel } from '../../services/management/logging-service'; // Optional

/**
 * @interface PerformanceMonitorOptions
 * Configuration options for the PerformanceMonitor.
 */
export interface PerformanceMonitorOptions {
  metricsService?: IMetricsService;
  logger?: ILoggingService;
  monitorName?: string;
  defaultLabels?: MetricLabels;
  histogramBuckets?: number[]; // e.g., [0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5, 10] for seconds
}

/**
 * @interface IPerformanceMonitor
 * Defines a contract for monitoring the performance of operations.
 */
export interface IPerformanceMonitor {
  /**
   * Measures the execution time of a given operation.
   * Records metrics like duration (histogram/summary) and counts (counter for success/failure).
   * @param operationName - A descriptive name for the operation being monitored (used in metric names/labels).
   * @param operation - A function that returns a Promise representing the operation to execute.
   * @param customLabels - Optional custom labels to add to the metrics for this specific call.
   * @returns A Promise that resolves with the result of the operation.
   */
  measure<T>(
    operationName: string,
    operation: () => Promise<T>,
    customLabels?: MetricLabels
  ): Promise<T>;

  /**
   * Starts a timer for a specific operation.
   * @param operationName - Name of the operation.
   * @param customLabels - Optional custom labels.
   * @returns A function that, when called, stops the timer and records the duration.
   *          The stop function can optionally take an error argument to record failures.
   */
  startTimer(operationName: string, customLabels?: MetricLabels): (error?: any) => void;
}

const DEFAULT_HISTOGRAM_BUCKETS = [0.001, 0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5, 10]; // In seconds

/**
 * @class PerformanceMonitor
 * Utility for monitoring the performance of code blocks and operations.
 * It integrates with a MetricsService to record relevant metrics.
 */
export class PerformanceMonitor implements IPerformanceMonitor {
  private metricsService?: IMetricsService;
  private logger?: ILoggingService;
  private monitorName: string;
  private defaultLabels: MetricLabels;
  private histogramBuckets: number[];

  private durationMetricName: string;
  private countMetricName: string;
  private errorMetricName: string;

  constructor(options?: PerformanceMonitorOptions) {
    this.metricsService = options?.metricsService;
    this.logger = options?.logger;
    this.monitorName = options?.monitorName || 'AppPerformance';
    this.defaultLabels = options?.defaultLabels || {};
    this.histogramBuckets = options?.histogramBuckets || DEFAULT_HISTOGRAM_BUCKETS;

    // Define metric names
    const prefix = this.monitorName.toLowerCase().replace(/[^a-z0-9_]/gi, '_');
    this.durationMetricName = `${prefix}_operation_duration_seconds`;
    this.countMetricName = `${prefix}_operations_total`;
    this.errorMetricName = `${prefix}_operation_errors_total`;

    this.initializeMetrics();
    this.log(LogLevel.INFO, `PerformanceMonitor "${this.monitorName}" initialized.`);
  }

  private log(level: LogLevel, message: string, context?: Record<string, any>): void {
    if (this.logger) {
      this.logger.log(level, `[PerfMon:${this.monitorName}] ${message}`, context);
    } else if (level === LogLevel.ERROR || level === LogLevel.WARN) {
      (level === LogLevel.ERROR ? console.error : console.warn)(`[PerfMon:${this.monitorName}] ${message}`, context || '');
    }
  }

  private initializeMetrics(): void {
    if (!this.metricsService) {
      this.log(LogLevel.WARN, 'MetricsService not provided. Performance metrics will not be recorded.');
      return;
    }

    // Ensure default labels from MetricsService are merged if this monitor has its own
    const baseLabels = { ...this.metricsService.getDefaultLabels(), ...this.defaultLabels };


    if (!this.metricsService.getMetric(this.durationMetricName)) {
      this.metricsService.createHistogram(
        this.durationMetricName,
        'Duration of operations in seconds.',
        ['operation_name', 'status', ...Object.keys(baseLabels)], // status: success/error
        this.histogramBuckets
      );
      this.log(LogLevel.DEBUG, `Metric registered: ${this.durationMetricName}`);
    }

    if (!this.metricsService.getMetric(this.countMetricName)) {
      this.metricsService.createCounter(
        this.countMetricName,
        'Total number of operations.',
        ['operation_name', 'status', ...Object.keys(baseLabels)]
      );
      this.log(LogLevel.DEBUG, `Metric registered: ${this.countMetricName}`);
    }

    // Note: errorMetricName is essentially a filtered view of countMetricName where status='error'.
    // Some systems prefer a separate error counter. For simplicity, we'll rely on the 'status' label.
    // If a distinct error counter is needed:
    // if (!this.metricsService.getMetric(this.errorMetricName)) {
    //   this.metricsService.createCounter(
    //     this.errorMetricName,
    //     'Total number of failed operations.',
    //     ['operation_name', 'error_type', ...Object.keys(baseLabels)]
    //   );
    // }
  }

  public startTimer(operationName: string, customLabels: MetricLabels = {}): (error?: any) => void {
    const startTime = process.hrtime();
    this.log(LogLevel.TRACE, `Timer started for operation: ${operationName}`, { ...this.defaultLabels, ...customLabels });

    return (error?: any): void => {
      const endTime = process.hrtime(startTime);
      const durationSeconds = endTime[0] + endTime[1] / 1e9; // Convert to seconds

      const status = error ? 'error' : 'success';
      const labels: MetricLabels = {
        ...this.defaultLabels,
        ...customLabels,
        operation_name: operationName,
        status,
      };

      if (error && this.metricsService) {
        // Could add error_type label if desired
        // labels.error_type = error.name || 'UnknownError';
        this.log(LogLevel.DEBUG, `Timer stopped for FAILED operation: ${operationName}. Duration: ${durationSeconds.toFixed(4)}s`, { labels, error: error?.message });
      } else {
        this.log(LogLevel.DEBUG, `Timer stopped for SUCCEEDED operation: ${operationName}. Duration: ${durationSeconds.toFixed(4)}s`, { labels });
      }


      if (this.metricsService) {
        const durationHistogram = this.metricsService.getMetric(this.durationMetricName) as import('../../services/management/metrics-service').IHistogram | undefined;
        durationHistogram?.observe(durationSeconds, labels);

        const countCounter = this.metricsService.getMetric(this.countMetricName) as import('../../services/management/metrics-service').ICounter | undefined;
        countCounter?.inc(1, labels);
      }
    };
  }

  public async measure<T>(
    operationName: string,
    operation: () => Promise<T>,
    customLabels: MetricLabels = {}
  ): Promise<T> {
    const stopTimer = this.startTimer(operationName, customLabels);
    try {
      const result = await operation();
      stopTimer(); // Record success
      return result;
    } catch (error: any) {
      stopTimer(error); // Record failure
      throw error; // Re-throw the original error
    }
  }
}

// Example Usage:
async function examplePerformanceMonitorUsage() {
  // Assume MetricsService and LoggingService are set up
  // const metrics = new MetricsService();
  // await metrics.addReporter(new ConsoleMetricsReporter());
  // const logger = new LoggingService();
  // await logger.addTransport(new ConsoleTransport());
  // logger.setLogLevel(LogLevel.DEBUG);

  const perfMonitor = new PerformanceMonitor({
    // metricsService: metrics,
    // logger,
    monitorName: 'MyApplication',
    defaultLabels: { version: '1.0.2' },
    histogramBuckets: [0.1, 0.5, 1, 5]
  });

  async function fetchData(id: string): Promise<{ data: string }> {
    console.log(`Fetching data for ID: ${id}`);
    const delay = 50 + Math.random() * 200; // Simulate 50-250ms delay
    await new Promise(resolve => setTimeout(resolve, delay));
    if (id === 'fail') {
      throw new Error('Simulated data fetch failure');
    }
    return { data: `Data for ${id} fetched after ${delay.toFixed(0)}ms` };
  }

  console.log('\n--- Measuring successful operation ---');
  try {
    const result1 = await perfMonitor.measure('fetch_user_data', () => fetchData('user123'), { endpoint: '/users/:id' });
    console.log('Result 1:', result1);
  } catch (e: any) {
    console.error('Error 1:', e.message);
  }

  console.log('\n--- Measuring failing operation ---');
  try {
    const result2 = await perfMonitor.measure('fetch_product_data', () => fetchData('fail'), { endpoint: '/products/:id' });
    console.log('Result 2:', result2);
  } catch (e: any) {
    console.error('Error 2:', e.message);
  }

  console.log('\n--- Using startTimer manually ---');
  const stopGetDataTimer = perfMonitor.startTimer('get_complex_report', { report_type: 'financial' });
  try {
    // Simulate some work
    await new Promise(resolve => setTimeout(resolve, 300));
    // const report = await generateReport();
    stopGetDataTimer(); // Success
    console.log('Manual timer example succeeded.');
  } catch (error) {
    stopGetDataTimer(error); // Failure
    console.error('Manual timer example failed.');
  }

  // if (metrics) {
  //   console.log('\n--- Final Metrics Report ---');
  //   await metrics.collectAndReport();
  //   await metrics.shutdown();
  // }
}

// To run the example:
// examplePerformanceMonitorUsage().catch(e => console.error("Example usage main error:", e));