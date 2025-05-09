import { ResourceMetrics } from '../metrics/resource-metrics';

export interface ResourceSnapshot {
  timestamp: Date;
  memoryUsage?: {
    rss: number;
    heapTotal: number;
    heapUsed: number;
    external: number;
    arrayBuffers: number;
  };
  cpuUsage?: {
    user: number;
    system: number;
  };
  // Add other relevant resource metrics like disk I/O, network activity if needed
}

export class ResourceCollector {
  private resourceMetrics: ResourceMetrics;
  private collectionInterval: number; // in milliseconds
  private intervalId?: NodeJS.Timeout;
  private snapshots: ResourceSnapshot[] = [];
  private maxSnapshots: number;

  constructor(resourceMetrics: ResourceMetrics, collectionIntervalMs: number = 5000, maxSnapshots: number = 100) {
    if (collectionIntervalMs <= 0) {
      throw new Error('collectionIntervalMs must be a positive number.');
    }
    if (maxSnapshots <= 0) {
      throw new Error('maxSnapshots must be a positive number.');
    }
    this.resourceMetrics = resourceMetrics;
    this.collectionInterval = collectionIntervalMs;
    this.maxSnapshots = maxSnapshots;
  }

  private async collect(): Promise<void> {
    try {
      const memoryUsage = process.memoryUsage();
      this.resourceMetrics.record('memory_rss', memoryUsage.rss, 'bytes');
      this.resourceMetrics.record('memory_heap_total', memoryUsage.heapTotal, 'bytes');
      this.resourceMetrics.record('memory_heap_used', memoryUsage.heapUsed, 'bytes');
      this.resourceMetrics.record('memory_external', memoryUsage.external, 'bytes');
      if (memoryUsage.arrayBuffers) { // arrayBuffers might not be available in all Node.js versions/environments
        this.resourceMetrics.record('memory_array_buffers', memoryUsage.arrayBuffers, 'bytes');
      }


      // CPU usage is more complex to get accurately for the current process in Node.js without native modules.
      // process.cpuUsage() gives diffs, so it's better for calculating usage over an interval.
      // For simplicity, we'll store the raw values if needed for later calculation.
      const cpuUsage = process.cpuUsage();

      const snapshot: ResourceSnapshot = {
        timestamp: new Date(),
        memoryUsage,
        cpuUsage,
      };

      if (this.snapshots.length >= this.maxSnapshots) {
        this.snapshots.shift();
      }
      this.snapshots.push(snapshot);

    } catch (error) {
      console.error('Error during resource collection:', error);
      // Optionally, record an event using EventCollector if integrated
    }
  }

  start(): void {
    if (this.intervalId) {
      console.warn('Resource collector is already running.');
      return;
    }
    // Perform an initial collection immediately
    this.collect().catch(err => console.error("Initial collection failed:", err));
    this.intervalId = setInterval(() => {
      this.collect().catch(err => console.error("Periodic collection failed:", err));
    }, this.collectionInterval);
    console.log('Resource collector started.');
  }

  stop(): void {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = undefined;
      console.log('Resource collector stopped.');
    } else {
      console.warn('Resource collector is not running.');
    }
  }

  getSnapshots(): ResourceSnapshot[] {
    return [...this.snapshots]; // Return a copy
  }

  getCurrentResourceMetrics(): ResourceMetrics {
    // This method might be redundant if all data goes into snapshots
    // or could trigger an on-demand collection.
    // For now, it returns the shared ResourceMetrics instance.
    return this.resourceMetrics;
  }

  clearSnapshots(): void {
    this.snapshots = [];
  }
}