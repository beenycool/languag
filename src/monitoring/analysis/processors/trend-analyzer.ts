import { AggregatedTimingStats, AnalysisOutput } from './metric-analyzer'; // Assuming AggregatedTimingStats is useful here
import { MetricCollector } from '../../core/collectors/metric-collector'; // For historical data access if needed
import { ResourceSnapshot } from '../../core/collectors/resource-collector'; // For resource trends

export interface DataPoint {
  timestamp: Date;
  value: number;
  tags?: Record<string, string>; // For multi-dimensional trends
}

export interface Trend {
  name: string;
  direction: 'increasing' | 'decreasing' | 'stable' | 'fluctuating';
  slope?: number; // For linear trends
  significance?: number; // Statistical significance of the trend
  dataPointsUsed: number;
  timeWindowSeconds: number;
}

export class TrendAnalyzer {
  private historicalData: Map<string, DataPoint[]> = new Map();
  private maxHistoryPerMetric: number;

  constructor(maxHistoryPerMetric: number = 1000) {
    this.maxHistoryPerMetric = maxHistoryPerMetric;
  }

  // Method to add new data points for trend analysis
  // This would typically be called periodically with new metrics
  addDataPoint(metricName: string, value: number, timestamp?: Date, tags?: Record<string, string>): void {
    if (!this.historicalData.has(metricName)) {
      this.historicalData.set(metricName, []);
    }
    const series = this.historicalData.get(metricName)!;
    series.push({ timestamp: timestamp || new Date(), value, tags });

    // Keep history bounded
    if (series.length > this.maxHistoryPerMetric) {
      series.shift();
    }
  }

  // Add multiple data points, e.g., from a MetricCollector snapshot
  addMetricCollectorData(collector: MetricCollector): void {
    const now = new Date();
    collector.getPerformanceMetrics().getAll().forEach(m => {
      this.addDataPoint(`performance.${m.name}`, m.value, m.timestamp || now, { unit: m.unit });
    });
    collector.getResourceMetrics().getAll().forEach(m => {
      this.addDataPoint(`resource.${m.name}`, m.value, m.timestamp || now, { unit: m.unit });
    });
    collector.getTimingMetrics().getAll().forEach(m => {
      this.addDataPoint(`timing.${m.name}`, m.durationMs, m.endTime || now);
    });
  }

  addResourceSnapshots(snapshots: ResourceSnapshot[]): void {
    snapshots.forEach(snap => {
        if (snap.memoryUsage) {
            this.addDataPoint('resource.memory_rss_snapshot', snap.memoryUsage.rss, snap.timestamp);
            this.addDataPoint('resource.memory_heap_used_snapshot', snap.memoryUsage.heapUsed, snap.timestamp);
        }
        // Add more from snapshot as needed
    });
  }


  analyzeTrends(metricNamePattern?: string | RegExp, timeWindowSeconds: number = 3600): Trend[] {
    const detectedTrends: Trend[] = [];
    const now = new Date().getTime();
    const windowStart = now - timeWindowSeconds * 1000;

    for (const [metricName, series] of this.historicalData) {
      if (metricNamePattern) {
        if (typeof metricNamePattern === 'string' && metricName !== metricNamePattern) continue;
        if (metricNamePattern instanceof RegExp && !metricNamePattern.test(metricName)) continue;
      }

      const recentPoints = series.filter(p => p.timestamp.getTime() >= windowStart);
      if (recentPoints.length < 5) { // Need at least a few points to detect a trend
        continue;
      }

      // Simple linear regression for trend slope (can be replaced with more robust methods)
      // y = mx + c; m = (NΣxy - ΣxΣy) / (NΣx^2 - (Σx)^2)
      // For simplicity, let x be time in seconds from windowStart
      let sumX = 0, sumY = 0, sumXY = 0, sumX2 = 0;
      const N = recentPoints.length;

      recentPoints.forEach(p => {
        const x = (p.timestamp.getTime() - windowStart) / 1000; // time in seconds
        const y = p.value;
        sumX += x;
        sumY += y;
        sumXY += x * y;
        sumX2 += x * x;
      });

      const slope = N * sumX2 - sumX * sumX !== 0 ?
        (N * sumXY - sumX * sumY) / (N * sumX2 - sumX * sumX) : 0;

      let direction: Trend['direction'] = 'stable';
      // Define thresholds for 'increasing'/'decreasing' vs 'stable'
      // This is highly dependent on the metric's nature and scale
      const significanceThreshold = 0.1 * (sumY / N); // e.g., 10% of average value change over window
      
      if (slope > significanceThreshold) direction = 'increasing';
      else if (slope < -significanceThreshold) direction = 'decreasing';
      else if (Math.abs(slope) > 0.01 * (sumY / N) && N > 10) { // Minor fluctuation if not stable
          const variance = recentPoints.reduce((acc, p, i, arr) => {
              if (i > 0) return acc + Math.abs(p.value - arr[i-1].value);
              return acc;
          }, 0) / (N-1);
          if (variance > significanceThreshold * 0.5) direction = 'fluctuating';
      }


      detectedTrends.push({
        name: metricName,
        direction,
        slope,
        // significance: /* TODO: calculate p-value or other significance */,
        dataPointsUsed: N,
        timeWindowSeconds,
      });
    }
    return detectedTrends;
  }

  getHistoricalData(metricName: string): DataPoint[] | undefined {
    return this.historicalData.get(metricName);
  }

  clearHistory(metricName?: string): void {
    if (metricName) {
      this.historicalData.delete(metricName);
    } else {
      this.historicalData.clear();
    }
  }
}