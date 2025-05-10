/**
 * @file Collects system and application metrics.
 * Gathers performance indicators, resource usage, and custom application metrics.
 */

// Assuming similar connectors might be used or adapted for metrics
import { ApiConnector, ApiConnectionParams } from '../connectors/api-connector';
import { DatabaseConnector, DatabaseConnectionParams } from '../connectors/database-connector';
// For system metrics, might use OS-level commands or libraries (e.g., 'os', 'systeminformation')

export interface MetricSourceConfig {
  id: string; // Unique identifier for this metric source
  type: 'api' | 'database-query' | 'system' | 'custom-function';
  params?: ApiConnectionParams | DatabaseConnectionParams; // For API or DB
  query?: string | object; // For DB
  endpoint?: string; // For API
  // For system metrics
  systemMetricType?: 'cpu' | 'memory' | 'disk' | 'network' | 'custom-command';
  command?: string; // For custom system command
  // For custom function metrics
  customCollectFunction?: () => Promise<Record<string, number | string>>;
  collectionIntervalSeconds: number;
}

export type MetricData = Record<string, number | string | boolean | Record<string, any>>;
export type MetricCallback = (metricName: string, value: number | string | boolean | Record<string, any>, sourceId: string, tags?: Record<string, string>) => void;
export type MetricErrorCallback = (error: Error, sourceId: string) => void;

export class MetricCollector {
  private sources: MetricSourceConfig[];
  private activeCollectors: Map<string, NodeJS.Timeout> = new Map();
  private onMetricCallback?: MetricCallback;
  private onErrorCallback?: MetricErrorCallback;

  constructor(sources: MetricSourceConfig[]) {
    this.sources = sources;
  }

  /**
   * Starts collecting metrics from all configured sources at their defined intervals.
   * @param onMetric Callback function to handle collected metrics.
   * @param onError Callback function to handle errors during metric collection.
   */
  public start(onMetric: MetricCallback, onError: MetricErrorCallback): void {
    this.onMetricCallback = onMetric;
    this.onErrorCallback = onError;

    this.sources.forEach(sourceConfig => {
      if (this.activeCollectors.has(sourceConfig.id)) {
        console.warn(`Metric source ${sourceConfig.id} is already active.`);
        return;
      }

      const collectAndSchedule = async () => {
        try {
          let metrics: MetricData | null = null;
          switch (sourceConfig.type) {
            case 'api':
              metrics = await this.collectFromApi(sourceConfig as Required<Pick<MetricSourceConfig, 'id' | 'endpoint' | 'params'>>);
              break;
            case 'database-query':
              metrics = await this.collectFromDatabase(sourceConfig as Required<Pick<MetricSourceConfig, 'id' | 'query' | 'params'>>);
              break;
            case 'system':
              metrics = await this.collectSystemMetrics(sourceConfig as Required<Pick<MetricSourceConfig, 'id' | 'systemMetricType' | 'command'>>);
              break;
            case 'custom-function':
              if (sourceConfig.customCollectFunction) {
                metrics = await sourceConfig.customCollectFunction();
              } else {
                throw new Error('customCollectFunction is not defined for custom-function metric source.');
              }
              break;
            default:
              this.handleError(new Error(`Unsupported metric source type: ${(sourceConfig as any).type}`), sourceConfig.id);
              return;
          }

          if (metrics && this.onMetricCallback) {
            for (const key in metrics) {
              this.onMetricCallback(key, metrics[key], sourceConfig.id);
            }
          }
        } catch (error: any) {
          this.handleError(error, sourceConfig.id);
        } finally {
          // Schedule next collection if still active
          if (this.activeCollectors.has(sourceConfig.id)) {
            const timeoutId = setTimeout(collectAndSchedule, sourceConfig.collectionIntervalSeconds * 1000);
            this.activeCollectors.set(sourceConfig.id, timeoutId);
          }
        }
      };

      console.log(`Starting metric collection for ${sourceConfig.id}, interval: ${sourceConfig.collectionIntervalSeconds}s`);
      const initialTimeoutId = setTimeout(collectAndSchedule, 0); // Start immediately
      this.activeCollectors.set(sourceConfig.id, initialTimeoutId);
    });
  }

  private async collectFromApi(config: Required<Pick<MetricSourceConfig, 'id' | 'endpoint' | 'params'>>): Promise<MetricData | null> {
    if (!config.endpoint || !config.params) throw new Error('API endpoint or params missing for metric source ' + config.id);
    const connector = new ApiConnector(config.params as ApiConnectionParams);
    // Assuming the API returns metrics in a parsable format
    return connector.get(config.endpoint);
  }

  private async collectFromDatabase(config: Required<Pick<MetricSourceConfig, 'id' | 'query' | 'params'>>): Promise<MetricData | null> {
    if (!config.query || !config.params) throw new Error('DB query or params missing for metric source ' + config.id);
    const connector = new DatabaseConnector(config.params as DatabaseConnectionParams);
    try {
      await connector.connect();
      // Assuming the query returns rows that can be treated as metrics
      const result = await connector.executeQuery(config.query);
      return result.data || result; // Adjust based on actual executeQuery response
    } finally {
      await connector.disconnect();
    }
  }

  private async collectSystemMetrics(config: Required<Pick<MetricSourceConfig, 'id' | 'systemMetricType' | 'command'>>): Promise<MetricData | null> {
    // This is a placeholder. Actual implementation would use Node.js 'os' module or a library like 'systeminformation'.
    console.log(`Collecting system metric: ${config.systemMetricType} for source ${config.id}`);
    switch (config.systemMetricType) {
      case 'cpu':
        // const cpus = os.cpus();
        // const total = cpus.reduce((acc, cpu) => acc + cpu.times.user + cpu.times.nice + cpu.times.sys + cpu.times.idle + cpu.times.irq, 0);
        // const idle = cpus.reduce((acc, cpu) => acc + cpu.times.idle, 0);
        // return { cpu_usage: (1 - idle / total) * 100 };
        return { cpu_usage_percent: Math.random() * 100 }; // Placeholder
      case 'memory':
        // return {
        //   total_memory_mb: os.totalmem() / (1024 * 1024),
        //   free_memory_mb: os.freemem() / (1024 * 1024),
        //   used_memory_percent: (1 - os.freemem() / os.totalmem()) * 100,
        // };
        return { memory_used_gb: Math.random() * 16, memory_total_gb: 16 }; // Placeholder
      case 'disk':
        // Use 'systeminformation' or 'df' command for disk usage
        return { disk_c_used_percent: Math.random() * 100 }; // Placeholder
      case 'network':
        // Use 'systeminformation' for network stats
        return { network_rx_mbps: Math.random() * 100, network_tx_mbps: Math.random() * 50 }; // Placeholder
      case 'custom-command':
        if (!config.command) throw new Error('Custom command not specified for ' + config.id);
        // const { exec } = require('child_process');
        // return new Promise((resolve, reject) => {
        //   exec(config.command, (error, stdout, stderr) => {
        //     if (error) return reject(error);
        //     if (stderr) return reject(new Error(stderr));
        //     try { resolve(JSON.parse(stdout)); } // Assuming command outputs JSON
        //     catch (e) { reject(new Error('Command output not valid JSON: ' + stdout));}
        //   });
        // });
        return { custom_metric_value: Math.random() * 1000 }; // Placeholder
      default:
        throw new Error(`Unknown system metric type: ${config.systemMetricType}`);
    }
  }

  private handleError(error: Error, sourceId: string): void {
    console.error(`Error collecting metrics from source ${sourceId}:`, error);
    if (this.onErrorCallback) {
      this.onErrorCallback(error, sourceId);
    }
  }

  /**
   * Stops collecting metrics from a specific source or all sources.
   * @param sourceId Optional. If provided, stops only this source. Otherwise, stops all.
   */
  public stop(sourceId?: string): void {
    const sourcesToStop = sourceId ? [sourceId] : Array.from(this.activeCollectors.keys());

    sourcesToStop.forEach(id => {
      const timeoutId = this.activeCollectors.get(id);
      if (timeoutId) {
        clearTimeout(timeoutId);
        this.activeCollectors.delete(id);
        console.log(`Metric collection stopped for source: ${id}`);
      }
    });
     if (!sourceId) {
        console.log('All metric collection stopped.');
    }
  }

  /**
   * Stops all metric collection and clears resources.
   */
  public stopAll(): void {
    this.activeCollectors.forEach(timeoutId => clearTimeout(timeoutId));
    this.activeCollectors.clear();
    console.log('All metric collectors shut down.');
  }
}