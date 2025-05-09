import { PerformanceMetrics } from '../../core/metrics/performance-metrics';
import { ResourceMetrics } from '../../core/metrics/resource-metrics';
import { TimingMetrics, TimingMetric } from '../../core/metrics/timing-metrics';
import { MetricCollector } from '../../core/collectors/metric-collector';
import { BenchmarkResult } from '../../benchmarks/suites/analysis-suite'; // Common benchmark result
import { LoadTestSummary } from '../../benchmarks/runners/load-generator';
import { Anomaly } from './anomaly-detector';

export interface AggregatedTimingStats {
  count: number;
  totalDurationMs: number;
  averageDurationMs: number;
  minDurationMs: number;
  maxDurationMs: number;
  stdDevDurationMs?: number; // Standard deviation
  percentiles?: { [percentile: number]: number }; // e.g., { 50: value, 90: value, 99: value }
}

export interface AnalysisOutput {
  overallHealth: 'good' | 'warning' | 'critical'; // Simple health status
  keyPerformanceIndicators: { name: string, value: string | number, status: 'good' | 'warning' | 'critical' }[];
  resourceUsageSummary: any; // TODO: Define more specific type
  timingAnalysis: Map<string, AggregatedTimingStats>;
  benchmarkSummary?: any; // TODO: Define more specific type
  loadTestSummary?: LoadTestSummary; // Can directly use this
  anomalies?: Anomaly[]; // List of detected anomalies
  recommendations?: string[]; // Suggested actions
}

export class MetricAnalyzer {
  private metricCollector: MetricCollector;

  constructor(metricCollector: MetricCollector) {
    this.metricCollector = metricCollector;
  }

  analyzeCurrentMetrics(): Partial<AnalysisOutput> {
    const performance = this.metricCollector.getPerformanceMetrics().getAll();
    const resources = this.metricCollector.getResourceMetrics().getAll();
    const timings = this.metricCollector.getTimingMetrics().getAll();

    const timingAnalysis = this.analyzeTimings(timings);
    // TODO: Implement more detailed analysis for performance and resources
    // For now, just passing them through or doing minimal aggregation.

    const kpis: AnalysisOutput['keyPerformanceIndicators'] = [];
    performance.forEach(p => {
        kpis.push({ name: p.name, value: `${p.value} ${p.unit}`, status: 'good' }); // Basic status
    });

    // Example: Check CPU load if available (from ResourceCollector snapshots, not directly here)
    // Example: Check memory usage
    const heapUsed = resources.find(r => r.name === 'memory_heap_used');
    if (heapUsed) {
        kpis.push({ name: 'Heap Used', value: `${(heapUsed.value / (1024*1024)).toFixed(2)} MB`, status: 'good' });
    }


    return {
      keyPerformanceIndicators: kpis,
      resourceUsageSummary: { raw: resources },
      timingAnalysis,
    };
  }

  analyzeTimings(timings: TimingMetric[]): Map<string, AggregatedTimingStats> {
    const groupedTimings = new Map<string, number[]>();

    timings.forEach(t => {
      if (!groupedTimings.has(t.name)) {
        groupedTimings.set(t.name, []);
      }
      groupedTimings.get(t.name)!.push(t.durationMs);
    });

    const analysisResults = new Map<string, AggregatedTimingStats>();
    for (const [name, durations] of groupedTimings) {
      if (durations.length === 0) continue;

      durations.sort((a, b) => a - b);
      const count = durations.length;
      const totalDurationMs = durations.reduce((sum, d) => sum + d, 0);
      const averageDurationMs = totalDurationMs / count;
      const minDurationMs = durations[0];
      const maxDurationMs = durations[count - 1];

      // Standard Deviation (optional, can be intensive)
      // const mean = averageDurationMs;
      // const stdDev = Math.sqrt(durations.map(x => Math.pow(x - mean, 2)).reduce((a, b) => a + b, 0) / count);

      // Percentiles (optional)
      const getPercentile = (p: number) => {
        const index = Math.floor(count * (p / 100));
        return durations[Math.min(index, count - 1)];
      };

      analysisResults.set(name, {
        count,
        totalDurationMs,
        averageDurationMs,
        minDurationMs,
        maxDurationMs,
        // stdDevDurationMs: stdDev, // Uncomment if calculated
        percentiles: {
          50: getPercentile(50),
          90: getPercentile(90),
          95: getPercentile(95),
          99: getPercentile(99),
        }
      });
    }
    return analysisResults;
  }

  analyzeBenchmarkResults(results: BenchmarkResult[]): Partial<AnalysisOutput> {
    // Summarize benchmark results, identify regressions or improvements
    // This is a placeholder for more complex benchmark analysis logic
    const summary = results.map(r => ({
        name: r.caseName,
        avgMs: r.averageDurationMs,
        error: r.error,
    }));
    return { benchmarkSummary: summary };
  }

  analyzeLoadTestSummary(loadSummary: LoadTestSummary): Partial<AnalysisOutput> {
    // Further analyze load test summary, e.g., check against SLOs
    const kpis: AnalysisOutput['keyPerformanceIndicators'] = [];
    kpis.push({ name: `${loadSummary.configName} RPS`, value: loadSummary.requestsPerSecond.toFixed(2), status: 'good' });
    kpis.push({ name: `${loadSummary.configName} Avg Latency`, value: `${loadSummary.averageLatencyMs.toFixed(2)} ms`, status: 'good' });
    kpis.push({ name: `${loadSummary.configName} Error Rate`, value: `${((loadSummary.failedRequests / loadSummary.totalRequestsSent) * 100 || 0).toFixed(2)}%`, status: loadSummary.failedRequests > 0 ? 'warning' : 'good' });

    return {
        loadTestSummary: loadSummary, // Pass through for now
        keyPerformanceIndicators: kpis,
    };
  }

  // TODO: combineAnalyses method to merge different analysis parts into a full AnalysisOutput
}