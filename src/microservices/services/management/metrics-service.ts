// src/microservices/services/management/metrics-service.ts

import { IConfigService } from '../infrastructure/config-service';

/**
 * @enum MetricType
 * Defines the types of metrics that can be collected.
 */
export enum MetricType {
  COUNTER = 'COUNTER', // A cumulative metric that represents a single monotonically increasing counter.
  GAUGE = 'GAUGE',     // A metric that represents a single numerical value that can arbitrarily go up and down.
  HISTOGRAM = 'HISTOGRAM', // Samples observations (usually things like request durations or response sizes) and counts them in configurable buckets.
  SUMMARY = 'SUMMARY',   // Similar to a histogram, a summary samples observations but calculates configurable φ-quantiles over a sliding time window.
}

/**
 * @interface MetricLabels
 * Represents key-value pairs for labeling metrics, providing dimensions.
 * Example: { method: "GET", statusCode: "200" }
 */
export type MetricLabels = Record<string, string | number>;

/**
 * @interface IMetric
 * Base interface for all metric types.
 */
export interface IMetric<TConfig = any> {
  readonly name: string;
  readonly help: string;
  readonly type: MetricType;
  readonly labels?: string[]; // Predefined label names for this metric

  /**
   * Gets the current value(s) of the metric.
   * The structure of the returned value depends on the metric type.
   */
  collect(): Promise<CollectedMetricData[]>;
}

/**
 * @interface CollectedMetricData
 * Represents a single data point or set of data points for a metric, including its labels.
 */
export interface CollectedMetricData {
  name: string;
  help: string;
  type: MetricType;
  labels?: MetricLabels; // Labels specific to this data point
  value: any; // For Counter/Gauge: number. For Histogram/Summary: specific structure.
  timestamp?: number;
}

// --- Specific Metric Interfaces ---

export interface ICounter extends IMetric {
  type: MetricType.COUNTER;
  inc(value?: number, labels?: MetricLabels): void;
}

export interface IGauge extends IMetric {
  type: MetricType.GAUGE;
  set(value: number, labels?: MetricLabels): void;
  inc(value?: number, labels?: MetricLabels): void;
  dec(value?: number, labels?: MetricLabels): void;
  setToCurrentTime(labels?: MetricLabels): void;
}

export interface IHistogram extends IMetric {
  type: MetricType.HISTOGRAM;
  observe(value: number, labels?: MetricLabels): void;
  // Buckets are typically configured at creation
  readonly buckets?: number[];
}

export interface ISummary extends IMetric {
  type: MetricType.SUMMARY;
  observe(value: number, labels?: MetricLabels): void;
  // Quantiles are typically configured at creation
  readonly quantiles?: number[];
}


/**
 * @interface IMetricsRegistry
 * Manages the registration and retrieval of metrics.
 */
export interface IMetricsRegistry {
  registerMetric<T extends IMetric>(metric: T): void;
  getMetric(name: string): IMetric | undefined;
  getAllMetrics(): IMetric[];
  clear(): void; // Clears all registered metrics

  createCounter(name: string, help: string, labelNames?: string[]): ICounter;
  createGauge(name: string, help: string, labelNames?: string[]): IGauge;
  createHistogram(name: string, help: string, labelNames?: string[], buckets?: number[]): IHistogram;
  createSummary(name: string, help: string, labelNames?: string[], quantiles?: number[], maxAgeSeconds?: number, ageBuckets?: number): ISummary;
}

/**
 * @interface IMetricsReporter
 * Defines a contract for reporting collected metrics to a monitoring system or output.
 */
export interface IMetricsReporter {
  /**
   * Reports a set of collected metric data.
   * @param metricsData - An array of collected metric data points.
   */
  report(metricsData: CollectedMetricData[]): Promise<void>;

  /**
   * Optional: Gets the name of the reporter.
   */
  getName?(): string;

  /**
   * Optional: Initializes the reporter.
   */
  init?(configService?: IConfigService): Promise<void>;

  /**
   * Optional: Shuts down the reporter.
   */
  shutdown?(): Promise<void>;
}

/**
 * @interface IMetricsService
 * Central service for creating, collecting, and reporting metrics.
 */
export interface IMetricsService extends IMetricsRegistry {
  /**
   * Adds a metrics reporter.
   * @param reporter - The metrics reporter to add.
   */
  addReporter(reporter: IMetricsReporter): Promise<void>;

  /**
   * Removes a metrics reporter.
   * @param reporterName - The name of the reporter to remove.
   */
  removeReporter(reporterName: string): Promise<void>;

  /**
   * Collects data from all registered metrics and sends it to all reporters.
   * This might be called periodically or on demand.
   */
  collectAndReport(): Promise<void>;

  /**
   * Gets the default labels to be applied to all metrics.
   */
  getDefaultLabels(): Readonly<MetricLabels>;

  /**
   * Sets default labels to be applied to all metrics.
   * @param labels - The default labels.
   */
  setDefaultLabels(labels: MetricLabels): void;
}


// --- Basic Implementations (In-Memory, for demonstration) ---
// In a real system, you'd use a library like prom-client, OpenTelemetry SDK, etc.

class BaseMetric<TConfig = any> implements IMetric<TConfig> {
  constructor(
    public readonly name: string,
    public readonly help: string,
    public readonly type: MetricType,
    public readonly labelNames: string[] = [],
    protected readonly defaultLabels: MetricLabels = {}
  ) {}

  protected data: Map<string, any> = new Map(); // Key is stringified labels

  protected getLabelKey(labels?: MetricLabels): string {
    const allLabels = { ...this.defaultLabels, ...labels };
    if (Object.keys(allLabels).length === 0) return '_nolabels_';
    // Ensure consistent order for key generation
    return this.labelNames.sort().map(ln => `${ln}="${allLabels[ln]}"`).join(',');
  }

  // This is a generic collect and needs to be overridden by specific metric types
  // to format their 'value' correctly.
  public async collect(): Promise<CollectedMetricData[]> {
    const collected: CollectedMetricData[] = [];
    this.data.forEach((value, labelKey) => {
      const labels = labelKey === '_nolabels_' ? {} :
        Object.fromEntries(labelKey.split(',').map(pair => {
          const [k, v] = pair.split('=');
          return [k, v.substring(1, v.length -1)]; // remove quotes
        }));

      collected.push({
        name: this.name,
        help: this.help,
        type: this.type,
        labels: { ...this.defaultLabels, ...labels },
        value: value, // This needs to be specific to metric type
        timestamp: Date.now(),
      });
    });
    return collected;
  }
}

class Counter extends BaseMetric implements ICounter {
  public readonly type: MetricType.COUNTER = MetricType.COUNTER;

  constructor(name: string, help: string, labelNames?: string[], defaultLabels?: MetricLabels) {
    super(name, help, MetricType.COUNTER, labelNames, defaultLabels);
    // Initialize with 0 for no labels if not present
    if (labelNames && labelNames.length === 0 && !this.data.has('_nolabels_')) {
        this.data.set('_nolabels_', 0);
    }
  }

  inc(value: number = 1, labels?: MetricLabels): void {
    const key = this.getLabelKey(labels);
    this.data.set(key, (this.data.get(key) || 0) + value);
  }

  async collect(): Promise<CollectedMetricData[]> {
    const results: CollectedMetricData[] = [];
    this.data.forEach((count, labelKey) => {
      const currentLabels = labelKey === '_nolabels_' ? {} :
        Object.fromEntries(labelKey.split(',').map(pair => {
          const [k, v] = pair.split('=');
          return [k, v.substring(1, v.length -1)];
        }));
      results.push({
        name: this.name,
        help: this.help,
        type: this.type,
        labels: { ...this.defaultLabels, ...currentLabels },
        value: count,
        timestamp: Date.now(),
      });
    });
     // If no data points yet but it's a defined counter (e.g. no labels), report 0
    if (results.length === 0 && this.labelNames.length === 0) {
        results.push({
            name: this.name,
            help: this.help,
            type: this.type,
            labels: { ...this.defaultLabels },
            value: 0,
            timestamp: Date.now(),
        });
    }
    return results;
  }
}

class Gauge extends BaseMetric implements IGauge {
  public readonly type: MetricType.GAUGE = MetricType.GAUGE;

  constructor(name: string, help: string, labelNames?: string[], defaultLabels?: MetricLabels) {
    super(name, help, MetricType.GAUGE, labelNames, defaultLabels);
  }
  set(value: number, labels?: MetricLabels): void {
    this.data.set(this.getLabelKey(labels), value);
  }
  inc(value: number = 1, labels?: MetricLabels): void {
    const key = this.getLabelKey(labels);
    this.data.set(key, (this.data.get(key) || 0) + value);
  }
  dec(value: number = 1, labels?: MetricLabels): void {
    const key = this.getLabelKey(labels);
    this.data.set(key, (this.data.get(key) || 0) - value);
  }
  setToCurrentTime(labels?: MetricLabels): void {
    this.set(Date.now() / 1000, labels); // Unix timestamp in seconds
  }
   async collect(): Promise<CollectedMetricData[]> { // Similar to Counter's collect
    const results: CollectedMetricData[] = [];
    this.data.forEach((val, labelKey) => {
      const currentLabels = labelKey === '_nolabels_' ? {} :
        Object.fromEntries(labelKey.split(',').map(pair => {
          const [k, v] = pair.split('=');
          return [k, v.substring(1, v.length -1)];
        }));
      results.push({
        name: this.name,
        help: this.help,
        type: this.type,
        labels: { ...this.defaultLabels, ...currentLabels },
        value: val,
        timestamp: Date.now(),
      });
    });
    return results;
  }
}

// Simplified Histogram and Summary (actual implementations are complex)
class Histogram extends BaseMetric implements IHistogram {
  public readonly type: MetricType.HISTOGRAM = MetricType.HISTOGRAM;
  public readonly buckets: number[];
  constructor(name: string, help: string, labelNames?: string[], buckets: number[] = [0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5, 10], defaultLabels?: MetricLabels) {
    super(name, help, MetricType.HISTOGRAM, labelNames, defaultLabels);
    this.buckets = buckets.sort((a, b) => a - b); // Ensure buckets are sorted
  }
  observe(value: number, labels?: MetricLabels): void {
    const key = this.getLabelKey(labels);
    let currentData = this.data.get(key);
    if (!currentData) {
      currentData = {
        sum: 0,
        count: 0,
        buckets: this.buckets.reduce((acc, b) => ({ ...acc, [b]: 0 }), {} as Record<number, number>),
      };
      currentData.buckets[Infinity] = 0; // +Inf bucket
    }
    currentData.sum += value;
    currentData.count += 1;
    for (const b of this.buckets) {
      if (value <= b) {
        currentData.buckets[b]++;
      }
    }
    currentData.buckets[Infinity]++; // All observations go into +Inf bucket count
    this.data.set(key, currentData);
  }
  async collect(): Promise<CollectedMetricData[]> {
    const results: CollectedMetricData[] = [];
    this.data.forEach((histData, labelKey) => {
      const currentLabels = labelKey === '_nolabels_' ? {} :
        Object.fromEntries(labelKey.split(',').map(pair => {
          const [k, v] = pair.split('=');
          return [k, v.substring(1, v.length -1)];
        }));
      results.push({
        name: this.name,
        help: this.help,
        type: this.type,
        labels: { ...this.defaultLabels, ...currentLabels },
        value: { // Prometheus-like histogram structure
          sum: histData.sum,
          count: histData.count,
          buckets: histData.buckets,
        },
        timestamp: Date.now(),
      });
    });
    return results;
  }
}

class Summary extends BaseMetric implements ISummary {
  public readonly type: MetricType.SUMMARY = MetricType.SUMMARY;
  public readonly quantiles: number[];
  // Actual summary implementation with sliding windows and quantile estimation is very complex.
  // This is a highly simplified version that just stores observations.
  constructor(name: string, help: string, labelNames?: string[], quantiles: number[] = [0.5, 0.9, 0.99], defaultLabels?: MetricLabels) {
    super(name, help, MetricType.SUMMARY, labelNames, defaultLabels);
    this.quantiles = quantiles;
  }
  observe(value: number, labels?: MetricLabels): void {
    const key = this.getLabelKey(labels);
    let currentData = this.data.get(key);
     if (!currentData) {
      currentData = { sum: 0, count: 0, // In a real summary, observations would be stored to calculate quantiles
                       // For simplicity, we'll just keep sum and count like a basic histogram part
                     };
    }
    currentData.sum += value;
    currentData.count += 1;
    this.data.set(key, currentData);
  }
   async collect(): Promise<CollectedMetricData[]> {
    const results: CollectedMetricData[] = [];
    this.data.forEach((summaryData, labelKey) => {
      const currentLabels = labelKey === '_nolabels_' ? {} :
        Object.fromEntries(labelKey.split(',').map(pair => {
          const [k, v] = pair.split('=');
          return [k, v.substring(1, v.length -1)];
        }));
      results.push({
        name: this.name,
        help: this.help,
        type: this.type,
        labels: { ...this.defaultLabels, ...currentLabels },
        value: { // Prometheus-like summary structure (simplified)
          sum: summaryData.sum,
          count: summaryData.count,
          // Quantiles would be calculated here in a real implementation
          quantiles: this.quantiles.reduce((acc, q) => ({...acc, [q]: summaryData.sum / (summaryData.count || 1)}), {}), // Placeholder
        },
        timestamp: Date.now(),
      });
    });
    return results;
  }
}


export class MetricsService implements IMetricsService {
  private registry: Map<string, IMetric>;
  private reporters: IMetricsReporter[];
  private defaultLabels: MetricLabels;
  private configService?: IConfigService;

  constructor(configService?: IConfigService) {
    this.registry = new Map();
    this.reporters = [];
    this.configService = configService;
    this.defaultLabels = this.configService?.get<MetricLabels>('metrics.defaultLabels', {}) || {};
    const serviceName = this.configService?.get<string>('service.name');
    if (serviceName) {
      this.defaultLabels['service_name'] = this.defaultLabels['service_name'] || serviceName;
    }
    console.log('MetricsService initialized.');
  }

  public getDefaultLabels(): Readonly<MetricLabels> {
    return { ...this.defaultLabels };
  }

  public setDefaultLabels(labels: MetricLabels): void {
    this.defaultLabels = { ...labels };
    // Potentially update existing metrics if they inherit default labels dynamically (complex)
    // For simplicity, new default labels apply to newly created metrics or on next collection if metrics re-evaluate.
  }

  public registerMetric<T extends IMetric>(metric: T): void {
    if (this.registry.has(metric.name)) {
      console.warn(`Metric with name "${metric.name}" is already registered and will be overridden.`);
    }
    // If the metric is one of our base types, ensure it gets the default labels
    if (metric instanceof BaseMetric) {
        // This is tricky as BaseMetric constructor already took defaultLabels.
        // A better way would be for create methods to pass them.
        // For now, we assume metrics are created via the service's create methods.
    }
    this.registry.set(metric.name, metric);
    console.log(`Metric registered: ${metric.name} (Type: ${metric.type})`);
  }

  public getMetric(name: string): IMetric | undefined {
    return this.registry.get(name);
  }

  public getAllMetrics(): IMetric[] {
    return Array.from(this.registry.values());
  }

  public clear(): void {
    this.registry.clear();
    console.log('All metrics cleared from registry.');
  }

  public createCounter(name: string, help: string, labelNames: string[] = []): ICounter {
    const counter = new Counter(name, help, labelNames, this.defaultLabels);
    this.registerMetric(counter);
    return counter;
  }

  public createGauge(name: string, help: string, labelNames: string[] = []): IGauge {
    const gauge = new Gauge(name, help, labelNames, this.defaultLabels);
    this.registerMetric(gauge);
    return gauge;
  }

  public createHistogram(name: string, help: string, labelNames: string[] = [], buckets?: number[]): IHistogram {
    const histogram = new Histogram(name, help, labelNames, buckets, this.defaultLabels);
    this.registerMetric(histogram);
    return histogram;
  }

  public createSummary(name: string, help: string, labelNames: string[] = [], quantiles?: number[], maxAgeSeconds?: number, ageBuckets?: number): ISummary {
    // maxAgeSeconds and ageBuckets are for more advanced summary implementations
    const summary = new Summary(name, help, labelNames, quantiles, this.defaultLabels);
    this.registerMetric(summary);
    return summary;
  }

  public async addReporter(reporter: IMetricsReporter): Promise<void> {
    if (reporter.init) {
      await reporter.init(this.configService);
    }
    this.reporters.push(reporter);
    console.log(`Metrics reporter added: ${reporter.getName ? reporter.getName() : 'UnnamedReporter'}`);
  }

  public async removeReporter(reporterName: string): Promise<void> {
    const initialLength = this.reporters.length;
    const reportersToKeep: IMetricsReporter[] = [];
    const reportersToRemove: IMetricsReporter[] = [];

    for (const r of this.reporters) {
        if (r.getName && r.getName() === reporterName) {
            reportersToRemove.push(r);
        } else {
            reportersToKeep.push(r);
        }
    }
    this.reporters = reportersToKeep;

    for (const r of reportersToRemove) {
        if (r.shutdown) {
            await r.shutdown();
        }
    }
    if (this.reporters.length < initialLength) {
      console.log(`Metrics reporter removed: ${reporterName}`);
    } else {
      console.warn(`Metrics reporter "${reporterName}" not found for removal.`);
    }
  }

  public async collectAndReport(): Promise<void> {
    if (this.reporters.length === 0) {
      // console.debug('No metrics reporters configured. Skipping report.');
      return;
    }

    const allCollectedData: CollectedMetricData[] = [];
    for (const metric of this.registry.values()) {
      try {
        const data = await metric.collect();
        allCollectedData.push(...data);
      } catch (error) {
        console.error(`Error collecting data from metric "${metric.name}":`, error);
      }
    }

    if (allCollectedData.length === 0) {
      // console.debug('No metric data collected. Skipping report.');
      return;
    }

    // console.debug(`Collected ${allCollectedData.length} metric data points. Reporting...`);
    for (const reporter of this.reporters) {
      try {
        await reporter.report(allCollectedData);
      } catch (error) {
        console.error(`Error reporting metrics via ${reporter.getName ? reporter.getName() : 'UnnamedReporter'}:`, error);
      }
    }
  }

  /**
   * Cleans up resources, like shutting down reporters.
   */
  public async shutdown(): Promise<void> {
    for (const reporter of this.reporters) {
      if (reporter.shutdown) {
        await reporter.shutdown();
      }
    }
    this.reporters = [];
    this.clear();
    console.log('MetricsService shutdown complete.');
  }
}


// --- Example Metrics Reporter ---

/**
 * @class ConsoleMetricsReporter
 * A simple metrics reporter that logs metrics to the console.
 */
export class ConsoleMetricsReporter implements IMetricsReporter {
  public getName(): string {
    return 'ConsoleMetricsReporter';
  }

  public async init(): Promise<void> {
    console.log('ConsoleMetricsReporter initialized.');
  }

  public async report(metricsData: CollectedMetricData[]): Promise<void> {
    if (metricsData.length === 0) return;
    console.log("\n--- Metrics Report ---");
    metricsData.forEach(metric => {
      let labelStr = "";
      if (metric.labels && Object.keys(metric.labels).length > 0) {
        labelStr = `{${Object.entries(metric.labels).map(([k, v]) => `${k}="${v}"`).join(',')}}`;
      }
      let valueStr = JSON.stringify(metric.value);
      if (metric.type === MetricType.HISTOGRAM || metric.type === MetricType.SUMMARY) {
          // More readable format for complex types
          valueStr = `Count: ${metric.value.count}, Sum: ${metric.value.sum}`;
          if (metric.type === MetricType.HISTOGRAM) {
              valueStr += `, Buckets: ${JSON.stringify(metric.value.buckets)}`;
          } else { // Summary
              valueStr += `, Quantiles: ${JSON.stringify(metric.value.quantiles)}`;
          }
      }
      console.log(`${metric.name}${labelStr} (${metric.type}, Help: "${metric.help}") = ${valueStr}`);
    });
    console.log("--- End Metrics Report ---\n");
  }

  public async shutdown(): Promise<void> {
    console.log('ConsoleMetricsReporter shutdown.');
  }
}

// Example Usage
async function metricsExample() {
  const metricsService = new MetricsService();
  await metricsService.addReporter(new ConsoleMetricsReporter());
  metricsService.setDefaultLabels({ environment: 'development', region: 'us-east-1' });

  const httpRequestCounter = metricsService.createCounter(
    'http_requests_total',
    'Total number of HTTP requests.',
    ['method', 'path', 'status_code']
  );

  const activeConnectionsGauge = metricsService.createGauge(
    'active_connections',
    'Number of active connections.'
  );

  const requestLatencyHistogram = metricsService.createHistogram(
    'http_request_duration_seconds',
    'HTTP request latency in seconds.',
    ['method', 'path'],
    [0.1, 0.5, 1, 2.5, 5] // Custom buckets
  );

  httpRequestCounter.inc(1, { method: 'GET', path: '/api/users', status_code: '200' });
  httpRequestCounter.inc(1, { method: 'POST', path: '/api/users', status_code: '201' });
  httpRequestCounter.inc(1, { method: 'GET', path: '/api/products', status_code: '200' });
  httpRequestCounter.inc(1, { method: 'GET', path: '/api/users', status_code: '404' });


  activeConnectionsGauge.set(15);
  activeConnectionsGauge.inc(5); // 20
  activeConnectionsGauge.dec(2); // 18

  requestLatencyHistogram.observe(0.25, { method: 'GET', path: '/api/users' });
  requestLatencyHistogram.observe(0.8, { method: 'POST', path: '/api/users' });
  requestLatencyHistogram.observe(1.5, { method: 'GET', path: '/api/products' });
  requestLatencyHistogram.observe(0.05, { method: 'GET', path: '/api/users' });


  await metricsService.collectAndReport();

  // Example of metric without specific labels (uses default labels)
  const generalErrors = metricsService.createCounter('general_application_errors_total', 'Total general errors');
  generalErrors.inc();
  await metricsService.collectAndReport();


  await metricsService.shutdown();
}

// To run the example:
// metricsExample().catch(console.error);