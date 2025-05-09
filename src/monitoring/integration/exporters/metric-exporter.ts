import { MetricCollector } from '../../core/collectors/metric-collector';
import { PerformanceMetrics } from '../../core/metrics/performance-metrics';
import { ResourceMetrics } from '../../core/metrics/resource-metrics';
import { TimingMetrics } from '../../core/metrics/timing-metrics';

// Define common export formats or interfaces if needed
// Example: Prometheus format, OpenTelemetry format

export interface ExporterConfig {
  // Common configuration for all exporters, e.g., endpoint, batch_size
  exportIntervalMs?: number; // How often to export
}

export interface PrometheusExporterConfig extends ExporterConfig {
  // Prometheus specific: e.g., pushGatewayUrl, jobName
  jobName?: string;
}

export interface OpenTelemetryExporterConfig extends ExporterConfig {
  // OTel specific: e.g., collectorEndpoint, serviceName
  serviceName?: string;
  collectorEndpoint?: string;
}


export abstract class BaseExporter {
  protected metricCollector: MetricCollector;
  protected config: ExporterConfig;
  private intervalId?: NodeJS.Timeout;

  constructor(metricCollector: MetricCollector, config: ExporterConfig) {
    this.metricCollector = metricCollector;
    this.config = config;
  }

  abstract exportMetrics(): Promise<void>;

  start(): void {
    if (this.config.exportIntervalMs && this.config.exportIntervalMs > 0) {
      if (this.intervalId) {
        console.warn('Exporter is already running an interval.');
        return;
      }
      this.intervalId = setInterval(async () => {
        try {
          await this.exportMetrics();
        } catch (error) {
          console.error('Error during scheduled metric export:', error);
        }
      }, this.config.exportIntervalMs);
      console.log(`${this.constructor.name} started with interval ${this.config.exportIntervalMs}ms.`);
    } else {
      // No interval, export must be called manually or by a different mechanism
      console.log(`${this.constructor.name} configured for manual export.`);
    }
  }

  stop(): void {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = undefined;
      console.log(`${this.constructor.name} stopped.`);
    }
  }
}

// Example: Console Exporter (simple, for debugging)
export class ConsoleMetricExporter extends BaseExporter {
  constructor(metricCollector: MetricCollector, config: ExporterConfig = { exportIntervalMs: 10000 }) {
    super(metricCollector, config);
  }

  async exportMetrics(): Promise<void> {
    const data = this.metricCollector.collectAll();
    console.log('\n--- Exporting Metrics (Console) ---');
    console.log('Timestamp:', new Date().toISOString());

    console.log('\nPerformance Metrics:');
    if (data.performance.length > 0) {
      data.performance.forEach(m => console.log(`  ${m.name}: ${m.value} ${m.unit} (at ${m.timestamp.toLocaleTimeString()})`));
    } else {
      console.log('  (No performance metrics)');
    }

    console.log('\nResource Metrics:');
    if (data.resources.length > 0) {
      data.resources.forEach(m => console.log(`  ${m.name}: ${m.value} ${m.unit} (at ${m.timestamp.toLocaleTimeString()})`));
    } else {
      console.log('  (No resource metrics)');
    }

    console.log('\nTiming Metrics:');
    if (data.timings.length > 0) {
      data.timings.forEach(m => console.log(`  ${m.name}: ${m.durationMs.toFixed(2)}ms (ended at ${m.endTime.toLocaleTimeString()})`));
    } else {
      console.log('  (No timing metrics)');
    }
    console.log('-----------------------------------\n');
  }
}

// TODO: Implement PrometheusExporter
// TODO: Implement OpenTelemetryExporter (OTLP)

/*
// Conceptual Prometheus Exporter
export class PrometheusMetricExporter extends BaseExporter {
    // ... constructor ...
    async exportMetrics(): Promise<void> {
        const data = this.metricCollector.collectAll();
        // Convert data to Prometheus format
        // Send to Pushgateway or expose an endpoint
        console.log('[PrometheusExporter] Exporting metrics (conceptual)');
    }
}
*/