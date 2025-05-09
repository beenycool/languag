import { PerformanceMetrics } from '../metrics/performance-metrics';
import { ResourceMetrics } from '../metrics/resource-metrics';
import { TimingMetrics } from '../metrics/timing-metrics';

interface MetricData {
  performance: ReturnType<PerformanceMetrics['getAll']>;
  resources: ReturnType<ResourceMetrics['getAll']>;
  timings: ReturnType<TimingMetrics['getAll']>;
}

export class MetricCollector {
  private performanceMetrics: PerformanceMetrics;
  private resourceMetrics: ResourceMetrics;
  private timingMetrics: TimingMetrics;

  constructor() {
    this.performanceMetrics = new PerformanceMetrics();
    this.resourceMetrics = new ResourceMetrics();
    this.timingMetrics = new TimingMetrics();
  }

  getPerformanceMetrics(): PerformanceMetrics {
    return this.performanceMetrics;
  }

  getResourceMetrics(): ResourceMetrics {
    return this.resourceMetrics;
  }

  getTimingMetrics(): TimingMetrics {
    return this.timingMetrics;
  }

  collectAll(): MetricData {
    try {
      return {
        performance: this.performanceMetrics.getAll(),
        resources: this.resourceMetrics.getAll(),
        timings: this.timingMetrics.getAll(),
      };
    } catch (error) {
      console.error('Error collecting metrics:', error);
      // Return empty arrays or re-throw, depending on desired error handling
      return {
        performance: [],
        resources: [],
        timings: [],
      };
    }
  }

  clearAll(): void {
    try {
      this.performanceMetrics.clear();
      this.resourceMetrics.clear();
      this.timingMetrics.clear();
    } catch (error) {
      console.error('Error clearing metrics:', error);
      // Potentially re-throw if clearing is critical
    }
  }
}