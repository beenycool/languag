import { DataPoint, Trend } from './trend-analyzer'; // Using DataPoint for analysis
import { AggregatedTimingStats } from './metric-analyzer';

export interface Anomaly {
  metricName: string;
  timestamp: Date;
  value: number;
  severity: 'low' | 'medium' | 'high' | 'critical';
  description: string;
  expectedRange?: { min: number; max: number };
  relatedTrend?: Trend;
}

export interface AnomalyDetectionConfig {
  // Standard deviation based detection
  stdDevFactor?: number; // e.g., 3 standard deviations from mean
  // Fixed threshold based detection
  fixedThresholds?: { metricPattern: string | RegExp, min?: number, max?: number, severity: Anomaly['severity'] }[];
  // Trend-based anomaly detection (e.g., sudden spike against a stable trend)
  trendChangeThreshold?: number; // e.g., value changes by X% more than trend slope
  minSamplesForStdDev?: number; // Minimum samples to calculate std dev reliably
}

export class AnomalyDetector {
  private config: AnomalyDetectionConfig;

  constructor(config: AnomalyDetectionConfig = {}) {
    this.config = {
      stdDevFactor: config.stdDevFactor || 3, // Default to 3 sigma
      minSamplesForStdDev: config.minSamplesForStdDev || 10,
      fixedThresholds: config.fixedThresholds || [],
      trendChangeThreshold: config.trendChangeThreshold // No default, must be specified if used
    };
  }

  detectAnomalies(metricName: string, dataPoints: DataPoint[], trends?: Trend[]): Anomaly[] {
    const anomalies: Anomaly[] = [];
    if (dataPoints.length === 0) return anomalies;

    // 1. Fixed Threshold Detection
    this.config.fixedThresholds?.forEach(threshold => {
      let match = false;
      if (typeof threshold.metricPattern === 'string' && metricName === threshold.metricPattern) {
        match = true;
      } else if (threshold.metricPattern instanceof RegExp && threshold.metricPattern.test(metricName)) {
        match = true;
      }

      if (match) {
        dataPoints.forEach(point => {
          if (threshold.min !== undefined && point.value < threshold.min) {
            anomalies.push({
              metricName,
              timestamp: point.timestamp,
              value: point.value,
              severity: threshold.severity,
              description: `Value ${point.value.toFixed(2)} below minimum threshold ${threshold.min.toFixed(2)}`,
              expectedRange: { min: threshold.min, max: threshold.max !== undefined ? threshold.max : Infinity }
            });
          }
          if (threshold.max !== undefined && point.value > threshold.max) {
            anomalies.push({
              metricName,
              timestamp: point.timestamp,
              value: point.value,
              severity: threshold.severity,
              description: `Value ${point.value.toFixed(2)} above maximum threshold ${threshold.max.toFixed(2)}`,
              expectedRange: { min: threshold.min !== undefined ? threshold.min : -Infinity, max: threshold.max }
            });
          }
        });
      }
    });

    // 2. Standard Deviation Based Detection (for the whole series)
    if (this.config.stdDevFactor && dataPoints.length >= (this.config.minSamplesForStdDev || 10)) {
      const values = dataPoints.map(p => p.value);
      const mean = values.reduce((sum, val) => sum + val, 0) / values.length;
      const stdDev = Math.sqrt(values.map(x => Math.pow(x - mean, 2)).reduce((a, b) => a + b, 0) / values.length);
      const upperBound = mean + this.config.stdDevFactor * stdDev;
      const lowerBound = mean - this.config.stdDevFactor * stdDev;

      dataPoints.forEach(point => {
        if (point.value > upperBound || point.value < lowerBound) {
          // Avoid duplicate reporting if already caught by fixed threshold with higher/equal severity
          const alreadyReported = anomalies.some(a => 
            a.timestamp.getTime() === point.timestamp.getTime() && 
            a.metricName === metricName &&
            this.severityToNumber(a.severity) >= this.severityToNumber('medium') // Example: std dev is medium
          );

          if (!alreadyReported) {
            anomalies.push({
              metricName,
              timestamp: point.timestamp,
              value: point.value,
              severity: 'medium', // Default severity for std dev anomaly
              description: `Value ${point.value.toFixed(2)} is outside ${this.config.stdDevFactor} std deviations (mean: ${mean.toFixed(2)}, stdDev: ${stdDev.toFixed(2)})`,
              expectedRange: { min: lowerBound, max: upperBound }
            });
          }
        }
      });
    }
    
    // 3. Trend-based anomaly detection (e.g. sudden deviation from an established trend)
    // This is more complex and might involve comparing recent points to trend predictions.
    // Placeholder for now.
    if (this.config.trendChangeThreshold && trends) {
        const relevantTrend = trends.find(t => t.name === metricName);
        if (relevantTrend && relevantTrend.slope !== undefined && dataPoints.length > 1) {
            const lastPoint = dataPoints[dataPoints.length - 1];
            const secondLastPoint = dataPoints[dataPoints.length - 2];
            const timeDiffSeconds = (lastPoint.timestamp.getTime() - secondLastPoint.timestamp.getTime()) / 1000;
            if (timeDiffSeconds > 0) {
                const actualChange = (lastPoint.value - secondLastPoint.value) / timeDiffSeconds; // Rate of change
                const expectedChangeRate = relevantTrend.slope; // Assuming slope is per second
                
                // If actual change significantly deviates from trend's slope
                if (Math.abs(actualChange - expectedChangeRate) > Math.abs(expectedChangeRate * this.config.trendChangeThreshold)) {
                     anomalies.push({
                        metricName,
                        timestamp: lastPoint.timestamp,
                        value: lastPoint.value,
                        severity: 'medium',
                        description: `Sudden deviation from established trend. Actual change rate: ${actualChange.toFixed(2)}, expected: ${expectedChangeRate.toFixed(2)}`,
                        relatedTrend: relevantTrend
                    });
                }
            }
        }
    }


    // Deduplicate anomalies based on timestamp and metric name to avoid clutter if multiple rules trigger
    const uniqueAnomalies = Array.from(new Map(anomalies.map(a => [`${a.metricName}-${a.timestamp.toISOString()}`, a])).values());
    return uniqueAnomalies;
  }

  private severityToNumber(severity: Anomaly['severity']): number {
    switch (severity) {
      case 'low': return 1;
      case 'medium': return 2;
      case 'high': return 3;
      case 'critical': return 4;
      default: return 0;
    }
  }

  // Helper to analyze aggregated stats (e.g., from MetricAnalyzer)
  detectAnomaliesInAggregated(metricName: string, stats: AggregatedTimingStats): Anomaly[] {
    const anomalies: Anomaly[] = [];
    // Example: Check if max duration is excessively high compared to average
    if (stats.maxDurationMs > stats.averageDurationMs * 5 && stats.averageDurationMs > 0) { // Arbitrary factor
        anomalies.push({
            metricName: `${metricName}.maxDurationSpike`,
            timestamp: new Date(), // Timestamp of analysis
            value: stats.maxDurationMs,
            severity: 'medium',
            description: `Max duration ${stats.maxDurationMs.toFixed(2)}ms is significantly higher than average ${stats.averageDurationMs.toFixed(2)}ms for ${metricName}.`
        });
    }
    // More rules can be added for aggregated stats
    return anomalies;
  }
}