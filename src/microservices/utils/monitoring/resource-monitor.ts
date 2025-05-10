// src/microservices/utils/monitoring/resource-monitor.ts

import { IMetricsService, MetricLabels } from '../../services/management/metrics-service';
import { ILoggingService, LogLevel } from '../../services/management/logging-service';
import * as os from 'os'; // Node.js OS module for system information

/**
 * @interface ResourceMonitorOptions
 * Configuration options for the ResourceMonitor.
 */
export interface ResourceMonitorOptions {
  metricsService?: IMetricsService;
  logger?: ILoggingService;
  monitorName?: string;
  defaultLabels?: MetricLabels;
  collectionIntervalMs?: number; // Interval for collecting and reporting metrics. Default: 15000 (15s).
}

/**
 * @interface SystemResourceUsage
 * Represents collected system resource usage data.
 */
export interface SystemResourceUsage {
  timestamp: number;
  cpuUsage: {
    /** Average CPU load over 1, 5, and 15 minutes. */
    loadAverage: number[]; // [1min, 5min, 15min]
    /** Per-CPU core usage information (can be detailed, simplified here). */
    cores?: { user: number; nice: number; sys: number; idle: number; irq: number }[]; // from os.cpus()
    /** Overall system CPU usage percentage (0-100), if calculable. */
    systemCpuPercentage?: number;
  };
  memoryUsage: {
    /** Total system memory in bytes. */
    totalBytes: number;
    /** Free system memory in bytes. */
    freeBytes: number;
    /** Used system memory in bytes. */
    usedBytes: number;
    /** Memory usage percentage (0-100). */
    usagePercentage: number;
  };
  processMemoryUsage?: { // Specific to the current Node.js process
    /** Resident Set Size: memory occupied by the process in RAM. */
    rssBytes: number;
    /** Total size of the heap. */
    heapTotalBytes: number;
    /** Actual memory used by the heap. */
    heapUsedBytes: number;
    /** V8 external memory (e.g., ArrayBuffers). */
    externalBytes: number;
    /** ArrayBuffers memory. */
    arrayBuffersBytes?: number;
  };
  diskUsage?: DiskUsageStats[]; // Array of disk usage stats
  networkStats?: any; // Placeholder for network I/O (complex to get reliably cross-platform without external libs)
}

export interface DiskUsageStats {
    filesystem: string;
    sizeBytes: number;
    usedBytes: number;
    availableBytes: number;
    usagePercentage: number;
    mountpoint: string;
}


/**
 * @interface IResourceMonitor
 * Defines a contract for monitoring system and process resources.
 */
export interface IResourceMonitor {
  /**
   * Collects current resource usage data.
   * @returns A Promise resolving to SystemResourceUsage.
   */
  collectResourceUsage(): Promise<SystemResourceUsage>;

  /**
   * Starts periodic collection and reporting of resource metrics.
   */
  startMonitoring(): void;

  /**
   * Stops periodic collection.
   */
  stopMonitoring(): void;
}


const DEFAULT_COLLECTION_INTERVAL_MS = 15000; // 15 seconds

/**
 * @class ResourceMonitor
 * Monitors system resources like CPU, memory, and potentially disk/network.
 * Integrates with MetricsService to report these as gauges.
 * Note: Getting detailed, cross-platform disk and network stats often requires external libraries.
 * This implementation will focus on CPU and memory available via Node.js 'os' module.
 */
export class ResourceMonitor implements IResourceMonitor {
  private options: Required<Omit<ResourceMonitorOptions, 'metricsService' | 'logger' | 'monitorName' | 'defaultLabels'>> & Pick<ResourceMonitorOptions, 'metricsService' | 'logger' | 'monitorName' | 'defaultLabels'>;
  private metricsService?: IMetricsService;
  private logger?: ILoggingService;
  private monitorName: string;
  private defaultLabels: MetricLabels;
  private collectionIntervalId: NodeJS.Timeout | null = null;

  // For CPU usage percentage calculation
  private previousCpuTimes: { core: number, times: os.CpuInfo['times'] }[] | null = null;


  constructor(options?: ResourceMonitorOptions) {
    this.options = {
        collectionIntervalMs: options?.collectionIntervalMs || DEFAULT_COLLECTION_INTERVAL_MS,
        metricsService: options?.metricsService,
        logger: options?.logger,
        monitorName: options?.monitorName, // Keep optional here
        defaultLabels: options?.defaultLabels, // Keep optional here
    };
    this.metricsService = this.options.metricsService;
    this.logger = this.options.logger;
    this.monitorName = this.options.monitorName || 'SystemResources'; // Apply default here
    this.defaultLabels = this.options.defaultLabels || {}; // Apply default here

    this.initializeMetrics();
    this.log(LogLevel.INFO, `ResourceMonitor "${this.monitorName}" initialized. Interval: ${this.options.collectionIntervalMs}ms.`);
  }

  private log(level: LogLevel, message: string, context?: Record<string, any>): void {
    if (this.logger) {
      this.logger.log(level, `[ResMon:${this.monitorName}] ${message}`, context);
    } else if (level === LogLevel.ERROR || level === LogLevel.WARN) {
      (level === LogLevel.ERROR ? console.error : console.warn)(`[ResMon:${this.monitorName}] ${message}`, context || '');
    }
  }

  private initializeMetrics(): void {
    if (!this.metricsService) {
      this.log(LogLevel.WARN, 'MetricsService not provided. Resource metrics will not be recorded.');
      return;
    }
    const prefix = this.monitorName.toLowerCase().replace(/[^a-z0-9_]/gi, '_');
    const commonLabels = Object.keys(this.defaultLabels);

    // Memory Metrics
    this.metricsService.createGauge(`${prefix}_memory_total_bytes`, 'Total system memory in bytes.', commonLabels);
    this.metricsService.createGauge(`${prefix}_memory_free_bytes`, 'Free system memory in bytes.', commonLabels);
    this.metricsService.createGauge(`${prefix}_memory_used_bytes`, 'Used system memory in bytes.', commonLabels);
    this.metricsService.createGauge(`${prefix}_memory_usage_percentage`, 'System memory usage percentage.', commonLabels);

    // Process Memory Metrics
    this.metricsService.createGauge(`${prefix}_process_memory_rss_bytes`, 'Process resident set size in bytes.', commonLabels);
    this.metricsService.createGauge(`${prefix}_process_memory_heap_total_bytes`, 'Process heap total size in bytes.', commonLabels);
    this.metricsService.createGauge(`${prefix}_process_memory_heap_used_bytes`, 'Process heap used size in bytes.', commonLabels);
    this.metricsService.createGauge(`${prefix}_process_memory_external_bytes`, 'Process external memory in bytes (V8).', commonLabels);
    if (process.memoryUsage().arrayBuffers) { // arrayBuffers is available in newer Node versions
        this.metricsService.createGauge(`${prefix}_process_memory_arraybuffers_bytes`, 'Process ArrayBuffers memory in bytes.', commonLabels);
    }


    // CPU Metrics
    this.metricsService.createGauge(`${prefix}_cpu_load_average_1m`, '1 minute CPU load average.', commonLabels);
    this.metricsService.createGauge(`${prefix}_cpu_load_average_5m`, '5 minute CPU load average.', commonLabels);
    this.metricsService.createGauge(`${prefix}_cpu_load_average_15m`, '15 minute CPU load average.', commonLabels);
    this.metricsService.createGauge(`${prefix}_cpu_system_usage_percentage`, 'Overall system CPU usage percentage.', commonLabels);

    // Per-core CPU metrics (example for one core, typically you'd label by core ID)
    // This is more complex to do generically without knowing number of cores beforehand for prom-client style.
    // For simplicity, we'll focus on overall system CPU usage.
    // os.cpus().forEach((cpu, index) => {
    //   const coreLabels = [...commonLabels, 'cpu_core'];
    //   this.metricsService.createGauge(`${prefix}_cpu_core_user_percentage`, 'Per-core CPU user time percentage.', coreLabels);
    //   // ... other per-core states
    // });

    this.log(LogLevel.DEBUG, 'Resource metrics registered.');
  }

  private calculateSystemCpuPercentage(): number | undefined {
    const currentCpuTimes = os.cpus().map((core, i) => ({ core: i, times: core.times }));

    if (!this.previousCpuTimes) {
      this.previousCpuTimes = currentCpuTimes;
      return undefined; // Need two points in time to calculate percentage
    }

    let totalDeltaIdle = 0;
    let totalDeltaAll = 0;

    for (let i = 0; i < currentCpuTimes.length; i++) {
      const current = currentCpuTimes[i].times;
      const previous = this.previousCpuTimes[i] ? this.previousCpuTimes[i].times : current; // Handle core count changes (unlikely mid-run)

      const deltaIdle = current.idle - previous.idle;
      const deltaUser = current.user - previous.user;
      const deltaNice = current.nice - previous.nice;
      const deltaSys = current.sys - previous.sys;
      const deltaIrq = current.irq - previous.irq;

      const deltaCoreAll = deltaUser + deltaNice + deltaSys + deltaIdle + deltaIrq;

      totalDeltaIdle += deltaIdle;
      totalDeltaAll += deltaCoreAll;
    }

    this.previousCpuTimes = currentCpuTimes;

    if (totalDeltaAll === 0) {
      return 0; // Avoid division by zero if no CPU time has passed (highly unlikely)
    }

    const systemUsage = 1 - (totalDeltaIdle / totalDeltaAll);
    return Math.max(0, Math.min(100, systemUsage * 100)); // Clamp to 0-100
  }


  public async collectResourceUsage(): Promise<SystemResourceUsage> {
    const totalMemory = os.totalmem();
    const freeMemory = os.freemem();
    const usedMemory = totalMemory - freeMemory;
    const memoryUsagePercentage = totalMemory > 0 ? (usedMemory / totalMemory) * 100 : 0;

    const processMem = process.memoryUsage();
    const systemCpuPercentage = this.calculateSystemCpuPercentage();


    const usage: SystemResourceUsage = {
      timestamp: Date.now(),
      cpuUsage: {
        loadAverage: os.loadavg(),
        cores: os.cpus().map(c => c.times), // Simplified, just times
        systemCpuPercentage: systemCpuPercentage,
      },
      memoryUsage: {
        totalBytes: totalMemory,
        freeBytes: freeMemory,
        usedBytes: usedMemory,
        usagePercentage: memoryUsagePercentage,
      },
      processMemoryUsage: {
        rssBytes: processMem.rss,
        heapTotalBytes: processMem.heapTotal,
        heapUsedBytes: processMem.heapUsed,
        externalBytes: processMem.external,
        ...(processMem.arrayBuffers && { arrayBuffersBytes: processMem.arrayBuffers }),
      },
      // Disk and network would require more complex, platform-specific logic or libraries
      // diskUsage: await this.getDiskUsage(), // Example placeholder
    };
    return usage;
  }

  private async reportMetrics(usage: SystemResourceUsage): Promise<void> {
    if (!this.metricsService) return;

    const prefix = this.monitorName.toLowerCase().replace(/[^a-z0-9_]/gi, '_');
    const labels = this.defaultLabels;

    // Memory
    (this.metricsService.getMetric(`${prefix}_memory_total_bytes`) as import('../../services/management/metrics-service').IGauge | undefined)?.set(usage.memoryUsage.totalBytes, labels);
    (this.metricsService.getMetric(`${prefix}_memory_free_bytes`) as import('../../services/management/metrics-service').IGauge | undefined)?.set(usage.memoryUsage.freeBytes, labels);
    (this.metricsService.getMetric(`${prefix}_memory_used_bytes`) as import('../../services/management/metrics-service').IGauge | undefined)?.set(usage.memoryUsage.usedBytes, labels);
    (this.metricsService.getMetric(`${prefix}_memory_usage_percentage`) as import('../../services/management/metrics-service').IGauge | undefined)?.set(usage.memoryUsage.usagePercentage, labels);

    // Process Memory
    if (usage.processMemoryUsage) {
        (this.metricsService.getMetric(`${prefix}_process_memory_rss_bytes`) as import('../../services/management/metrics-service').IGauge | undefined)?.set(usage.processMemoryUsage.rssBytes, labels);
        (this.metricsService.getMetric(`${prefix}_process_memory_heap_total_bytes`) as import('../../services/management/metrics-service').IGauge | undefined)?.set(usage.processMemoryUsage.heapTotalBytes, labels);
        (this.metricsService.getMetric(`${prefix}_process_memory_heap_used_bytes`) as import('../../services/management/metrics-service').IGauge | undefined)?.set(usage.processMemoryUsage.heapUsedBytes, labels);
        (this.metricsService.getMetric(`${prefix}_process_memory_external_bytes`) as import('../../services/management/metrics-service').IGauge | undefined)?.set(usage.processMemoryUsage.externalBytes, labels);
        if (usage.processMemoryUsage.arrayBuffersBytes && this.metricsService.getMetric(`${prefix}_process_memory_arraybuffers_bytes`)) {
            (this.metricsService.getMetric(`${prefix}_process_memory_arraybuffers_bytes`) as import('../../services/management/metrics-service').IGauge | undefined)?.set(usage.processMemoryUsage.arrayBuffersBytes, labels);
        }
    }


    // CPU
    (this.metricsService.getMetric(`${prefix}_cpu_load_average_1m`) as import('../../services/management/metrics-service').IGauge | undefined)?.set(usage.cpuUsage.loadAverage[0], labels);
    (this.metricsService.getMetric(`${prefix}_cpu_load_average_5m`) as import('../../services/management/metrics-service').IGauge | undefined)?.set(usage.cpuUsage.loadAverage[1], labels);
    (this.metricsService.getMetric(`${prefix}_cpu_load_average_15m`) as import('../../services/management/metrics-service').IGauge | undefined)?.set(usage.cpuUsage.loadAverage[2], labels);
    if (usage.cpuUsage.systemCpuPercentage !== undefined) {
        (this.metricsService.getMetric(`${prefix}_cpu_system_usage_percentage`) as import('../../services/management/metrics-service').IGauge | undefined)?.set(usage.cpuUsage.systemCpuPercentage, labels);
    }


    this.log(LogLevel.DEBUG, 'Resource metrics reported.', {
        cpuLoad1m: usage.cpuUsage.loadAverage[0],
        memPercent: usage.memoryUsage.usagePercentage.toFixed(1),
        processRssMB: (usage.processMemoryUsage?.rssBytes || 0 / (1024*1024)).toFixed(1)
    });
  }

  public startMonitoring(): void {
    if (this.collectionIntervalId) {
      this.log(LogLevel.WARN, 'Monitoring is already active.');
      return;
    }
    // Initial collection
    this.collectAndReport();

    this.collectionIntervalId = setInterval(async () => {
      await this.collectAndReport();
    }, this.options.collectionIntervalMs);
    this.log(LogLevel.INFO, `Started periodic resource monitoring every ${this.options.collectionIntervalMs}ms.`);
  }

  private async collectAndReport(): Promise<void> {
    try {
      const usage = await this.collectResourceUsage();
      await this.reportMetrics(usage);
    } catch (error) {
      this.log(LogLevel.ERROR, 'Failed to collect or report resource usage.', { error });
    }
  }

  public stopMonitoring(): void {
    if (this.collectionIntervalId) {
      clearInterval(this.collectionIntervalId);
      this.collectionIntervalId = null;
      this.log(LogLevel.INFO, 'Stopped periodic resource monitoring.');
    }
    this.previousCpuTimes = null; // Reset CPU calculation baseline
  }

  /**
   * Cleans up resources, like stopping the monitoring interval.
   */
  public dispose(): void {
    this.stopMonitoring();
    this.log(LogLevel.INFO, `ResourceMonitor "${this.monitorName}" disposed.`);
  }

  // Placeholder for more complex disk usage (would need a library like 'diskusage')
  // private async getDiskUsage(): Promise<DiskUsageStats[]> {
  //   try {
  //     // const { available, free, total } = require('diskusage').checkSync('/'); // Example
  //     // return [{ filesystem: '/', sizeBytes: total, usedBytes: total - free, availableBytes: available, usagePercentage: ( (total-free)/total * 100), mountpoint: '/' }];
  //   } catch (e) {
  //     this.log(LogLevel.WARN, "Could not get disk usage.", { error: e });
  //   }
  //   return [];
  // }
}


// Example Usage:
async function exampleResourceMonitorUsage() {
  // const metrics = new MetricsService();
  // await metrics.addReporter(new ConsoleMetricsReporter()); // Assuming ConsoleMetricsReporter exists
  // const logger = new LoggingService();
  // await logger.addTransport(new ConsoleTransport()); // Assuming ConsoleTransport exists
  // logger.setLogLevel(LogLevel.DEBUG);

  const resourceMonitor = new ResourceMonitor({
    // metricsService: metrics,
    // logger,
    monitorName: 'MyAppResources',
    collectionIntervalMs: 5000, // Check every 5 seconds
    defaultLabels: { environment: 'production', region: 'eu-west-1' }
  });

  resourceMonitor.startMonitoring();

  console.log('Resource monitoring started. Will run for 20 seconds...');

  // Let it run for a bit
  await new Promise(resolve => setTimeout(resolve, 20000));

  resourceMonitor.stopMonitoring();
  resourceMonitor.dispose();

  // if (metrics) {
  //   console.log('\n--- Final Metrics Report (after resource monitoring) ---');
  //   await metrics.collectAndReport(); // Collect any final metrics (though gauges are point-in-time)
  //   await metrics.shutdown();
  // }
  console.log('Resource monitoring example finished.');
}

// To run the example:
// exampleResourceMonitorUsage().catch(e => console.error("Example usage main error:", e));