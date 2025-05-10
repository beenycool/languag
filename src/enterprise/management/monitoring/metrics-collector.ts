/**
 * @file Metrics Collector
 *
 * This file defines the metrics collector responsible for gathering various
 * performance and operational metrics from enterprise services and systems.
 * It can integrate with different monitoring agents or scrape metrics endpoints.
 *
 * Focus areas:
 * - Performance monitoring: Collects key metrics like CPU, memory, response times, error rates.
 * - Scalability: Can collect metrics from a large number of sources.
 * - Reliability: Ensures metrics are collected accurately and consistently.
 * - Error handling: Manages errors during metrics collection.
 */

interface IMetricSourceConfig {
  sourceId: string; // Unique identifier for the metrics source (e.g., serviceId, hostname)
  type: 'prometheus' | 'statsd' | 'opentelemetry' | 'custom_api' | 'log_parsing'; // Type of metrics source
  endpoint?: string; // e.g., Prometheus scrape endpoint, StatsD host:port, API URL
  // Type-specific options
  prometheusJobName?: string;
  statsdPrefix?: string;
  // For custom_api
  apiHeaders?: Record<string, string>;
  apiMethod?: 'GET' | 'POST';
  // For log_parsing
  logFilePath?: string;
  logParsePattern?: string; // Regex or pattern to extract metrics
  // Common options
  collectionIntervalMs?: number; // How often to collect from this source (if applicable)
  defaultDimensions?: Record<string, string>; // Tags/labels to add to all metrics from this source
}

export interface ICollectedMetric {
  name: string; // e.g., 'http_requests_total', 'cpu_usage_percent', 'queue_depth'
  value: number;
  timestamp: Date;
  dimensions?: Record<string, string>; // Tags/labels like { service: 'auth-service', instance: 'pod-123', region: 'us-east-1' }
  unit?: string; // e.g., 'ms', 'bytes', 'percent', 'requests_per_second'
  sourceId?: string; // From IMetricSourceConfig
}

interface IMetricsCollector {
  /**
   * Adds a new source for metrics collection.
   * @param config Configuration for the metrics source.
   */
  addSource(config: IMetricSourceConfig): Promise<void>;

  /**
   * Removes a metrics source.
   * @param sourceId The ID of the source to remove.
   */
  removeSource(sourceId: string): Promise<void>;

  /**
   * Manually triggers metrics collection from a specific source or all sources.
   * @param sourceId Optional ID of a specific source. If not provided, collects from all.
   * @returns A promise that resolves with an array of collected metrics.
   */
  collectMetrics(sourceId?: string): Promise<ICollectedMetric[]>;

  /**
   * Retrieves the latest cached metrics for a specific source or metric name.
   * @param sourceId Optional source ID.
   * @param metricName Optional metric name to filter by.
   * @returns A promise that resolves with an array of metrics.
   */
  getLatestMetrics(sourceId?: string, metricName?: string): Promise<ICollectedMetric[]>;

  // Potentially, methods to push metrics to a backend (e.g., Prometheus Pushgateway, OpenTelemetry Collector)
  // pushMetrics(metrics: ICollectedMetric[]): Promise<void>;
}

export class MetricsCollector implements IMetricsCollector {
  private sources: Map<string, { config: IMetricSourceConfig, intervalId?: NodeJS.Timeout, lastCollectedMetrics?: ICollectedMetric[] }> = new Map();

  constructor() {
    console.log('Metrics Collector initialized.');
  }

  async addSource(config: IMetricSourceConfig): Promise<void> {
    if (this.sources.has(config.sourceId)) {
      console.warn(`Metrics source ${config.sourceId} already exists. Re-adding/updating.`);
      await this.removeSource(config.sourceId);
    }

    this.sources.set(config.sourceId, { config });
    console.log(`Added metrics source ${config.sourceId} of type ${config.type}. Endpoint: ${config.endpoint || 'N/A'}`);

    if (config.collectionIntervalMs && config.collectionIntervalMs > 0) {
      const intervalId = setInterval(async () => {
        try {
          console.log(`Periodically collecting metrics for source ${config.sourceId}...`);
          const metrics = await this.fetchMetricsFromSource(config);
          const sourceEntry = this.sources.get(config.sourceId);
          if (sourceEntry) {
            sourceEntry.lastCollectedMetrics = metrics;
            // TODO: Potentially emit these metrics to an event bus or push to a backend
          }
        } catch (error) {
          console.error(`Error during periodic metrics collection for ${config.sourceId}:`, error);
        }
      }, config.collectionIntervalMs);
      const sourceEntry = this.sources.get(config.sourceId);
      if (sourceEntry) sourceEntry.intervalId = intervalId;
    }
  }

  async removeSource(sourceId: string): Promise<void> {
    const sourceEntry = this.sources.get(sourceId);
    if (sourceEntry) {
      if (sourceEntry.intervalId) {
        clearInterval(sourceEntry.intervalId);
      }
      this.sources.delete(sourceId);
      console.log(`Removed metrics source ${sourceId}.`);
    } else {
      console.warn(`Metrics source ${sourceId} not found for removal.`);
    }
  }

  async collectMetrics(sourceId?: string): Promise<ICollectedMetric[]> {
    let allCollectedMetrics: ICollectedMetric[] = [];
    if (sourceId) {
      const sourceEntry = this.sources.get(sourceId);
      if (sourceEntry) {
        console.log(`Manually collecting metrics for source ${sourceId}...`);
        const metrics = await this.fetchMetricsFromSource(sourceEntry.config);
        sourceEntry.lastCollectedMetrics = metrics;
        allCollectedMetrics.push(...metrics);
      } else {
        console.warn(`Source ${sourceId} not found for manual collection.`);
        return [];
      }
    } else {
      console.log('Manually collecting metrics from all sources...');
      for (const [id, entry] of this.sources) {
        try {
          const metrics = await this.fetchMetricsFromSource(entry.config);
          entry.lastCollectedMetrics = metrics;
          allCollectedMetrics.push(...metrics);
        } catch (error) {
          console.error(`Failed to collect metrics from source ${id}:`, error);
        }
      }
    }
    // TODO: Store or forward these metrics
    return allCollectedMetrics;
  }

  private async fetchMetricsFromSource(config: IMetricSourceConfig): Promise<ICollectedMetric[]> {
    const timestamp = new Date();
    const dimensionsWithDefaults = { ...config.defaultDimensions };
    console.log(`Fetching metrics from ${config.type} source: ${config.sourceId} at ${config.endpoint || 'N/A'}`);

    // Simulate fetching based on type
    switch (config.type) {
      case 'prometheus':
        // Would use a Prometheus client library to scrape config.endpoint
        // Example: parse text format from fetch(config.endpoint).then(res => res.text())
        return [
          { name: 'http_requests_total', value: Math.random() * 1000, timestamp, dimensions: { ...dimensionsWithDefaults, method: 'GET', code: '200' }, unit: 'count', sourceId: config.sourceId },
          { name: 'cpu_usage_seconds_total', value: Math.random() * 100, timestamp, dimensions: { ...dimensionsWithDefaults, core: '0' }, unit: 'seconds', sourceId: config.sourceId },
        ];
      case 'statsd':
        // StatsD is push-based, so collector might listen on a port or integrate with a StatsD server.
        // This method might query an aggregated view if available, or this is conceptual.
        return [
          { name: `${config.statsdPrefix || ''}page_views`, value: Math.random() * 500, timestamp, dimensions: dimensionsWithDefaults, unit: 'count', sourceId: config.sourceId },
        ];
      case 'custom_api':
        // const response = await fetch(config.endpoint!, { method: config.apiMethod || 'GET', headers: config.apiHeaders });
        // const data = await response.json();
        // Transform data to ICollectedMetric[]
        return [
          { name: 'active_users', value: Math.floor(Math.random() * 100), timestamp, dimensions: dimensionsWithDefaults, unit: 'users', sourceId: config.sourceId },
        ];
      case 'log_parsing':
          console.warn("Log parsing metrics collection is highly conceptual and not fully simulated.");
          return [
            { name: 'errors_logged_total', value: Math.floor(Math.random() * 10), timestamp, dimensions: dimensionsWithDefaults, unit: 'count', sourceId: config.sourceId }
          ];
      case 'opentelemetry':
          console.warn("OpenTelemetry metrics collection would typically involve an OTel collector or SDK integration.");
          return [
            { name: 'otel_service_latency_ms', value: Math.random() * 200, timestamp, dimensions: dimensionsWithDefaults, unit: 'ms', sourceId: config.sourceId }
          ];
      default:
        console.warn(`Unsupported metrics source type for fetching: ${config.type}`);
        return [];
    }
  }

  async getLatestMetrics(sourceId?: string, metricName?: string): Promise<ICollectedMetric[]> {
    let results: ICollectedMetric[] = [];
    if (sourceId) {
      const sourceEntry = this.sources.get(sourceId);
      if (sourceEntry && sourceEntry.lastCollectedMetrics) {
        results = sourceEntry.lastCollectedMetrics;
      }
    } else {
      this.sources.forEach(entry => {
        if (entry.lastCollectedMetrics) {
          results.push(...entry.lastCollectedMetrics);
        }
      });
    }

    if (metricName) {
      results = results.filter(m => m.name === metricName);
    }
    return results;
  }
}

// Example Usage (Conceptual)
// async function runMetricsCollectorExample() {
//   const collector = new MetricsCollector();

//   const promSource: IMetricSourceConfig = {
//     sourceId: 'service-A-prometheus',
//     type: 'prometheus',
//     endpoint: 'http://localhost:9090/metrics', // Example Prometheus endpoint
//     collectionIntervalMs: 15000, // Collect every 15 seconds
//     defaultDimensions: { app: 'my-app', service_group: 'backend' }
//   };
//   await collector.addSource(promSource);

//   const apiSource: IMetricSourceConfig = {
//     sourceId: 'user-stats-api',
//     type: 'custom_api',
//     endpoint: 'http://localhost:3000/api/stats',
//     apiMethod: 'GET',
//     collectionIntervalMs: 60000
//   };
//   await collector.addSource(apiSource);

//   setTimeout(async () => {
//     console.log("--- Collecting all metrics manually ---");
//     const allMetrics = await collector.collectMetrics();
//     // console.log("All collected metrics:", JSON.stringify(allMetrics, null, 2));

//     console.log("\n--- Getting latest cached metrics for Prometheus source ---");
//     const promMetrics = await collector.getLatestMetrics('service-A-prometheus');
//     console.log("Latest Prometheus Metrics:", promMetrics.length > 0 ? promMetrics[0] : 'No metrics yet');

//     console.log("\n--- Getting specific metric 'active_users' from all sources ---");
//     const activeUsers = await collector.getLatestMetrics(undefined, 'active_users');
//     console.log("Active Users Metric:", activeUsers);

//     // await collector.removeSource('service-A-prometheus');
//   }, 5000); // Wait for some initial collections if interval is set
// }

// runMetricsCollectorExample();