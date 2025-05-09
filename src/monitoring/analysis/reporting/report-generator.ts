import { AnalysisOutput, AggregatedTimingStats } from '../processors/metric-analyzer';
import { Trend } from '../processors/trend-analyzer';
import { Anomaly } from '../processors/anomaly-detector';
import { BenchmarkResult } from '../../benchmarks/suites/analysis-suite'; // Corrected import
import { AllBenchmarkResults } from '../../benchmarks/runners/result-reporter'; // Keep this if AllBenchmarkResults is used
import { LoadTestSummary } from '../../benchmarks/runners/load-generator';

// fs and path might be needed for file-based reports, but keep it console-based for now.
// import * as fs from 'fs/promises';
// import * as path from 'path';

export interface ReportConfig {
  title?: string;
  includeDetails?: boolean; // Whether to include verbose details
  outputFormat: 'console' | 'markdown' | 'json'; // | 'html' in future
  // filePath?: string; // For file-based reports
}

export class ReportGenerator {
  constructor() {
    // Initialization if needed
  }

  generateReport(analysisOutput: AnalysisOutput, config: ReportConfig): string | void {
    switch (config.outputFormat) {
      case 'console':
        this.generateConsoleReport(analysisOutput, config.title, config.includeDetails);
        return; // Console report prints directly
      case 'markdown':
        return this.generateMarkdownReport(analysisOutput, config.title, config.includeDetails);
      case 'json':
        return this.generateJsonReport(analysisOutput, config.includeDetails);
      default:
        console.error(`Unsupported report format: ${config.outputFormat}`);
        return `Error: Unsupported report format ${config.outputFormat}`;
    }
  }

  private generateConsoleReport(output: AnalysisOutput, title?: string, includeDetails?: boolean): void {
    console.log(`\n===== ${title || 'Performance Analysis Report'} =====`);
    console.log(`Overall Health: ${output.overallHealth}`);

    console.log('\n--- Key Performance Indicators ---');
    output.keyPerformanceIndicators.forEach(kpi => {
      console.log(`  - ${kpi.name}: ${kpi.value} [${kpi.status.toUpperCase()}]`);
    });

    if (output.timingAnalysis && output.timingAnalysis.size > 0) {
      console.log('\n--- Timing Analysis ---');
      output.timingAnalysis.forEach((stats, name) => {
        console.log(`  Metric: ${name}`);
        console.log(`    Avg: ${stats.averageDurationMs.toFixed(2)}ms, Min: ${stats.minDurationMs.toFixed(2)}ms, Max: ${stats.maxDurationMs.toFixed(2)}ms, Count: ${stats.count}`);
        if (includeDetails && stats.percentiles) {
          console.log(`    Percentiles: P50: ${stats.percentiles[50]?.toFixed(2)}ms, P90: ${stats.percentiles[90]?.toFixed(2)}ms, P99: ${stats.percentiles[99]?.toFixed(2)}ms`);
        }
      });
    }
    
    if (output.benchmarkSummary && includeDetails) {
        console.log('\n--- Benchmark Summary ---');
        // Assuming benchmarkSummary is an array of {name, avgMs, error}
        (output.benchmarkSummary as any[]).forEach(bs => {
            console.log(`  Benchmark: ${bs.name} - Avg: ${bs.avgMs?.toFixed(2)}ms ${bs.error ? `(Error: ${bs.error})`:''}`);
        });
    }

    if (output.loadTestSummary) {
        console.log('\n--- Load Test Summary ---');
        const summary = output.loadTestSummary;
        console.log(`  Test: ${summary.configName}`);
        console.log(`    RPS: ${summary.requestsPerSecond.toFixed(2)}, Avg Latency: ${summary.averageLatencyMs.toFixed(2)}ms`);
        console.log(`    Success: ${summary.successfulRequests}/${summary.totalRequestsSent}, Errors: ${summary.failedRequests}`);
    }


    if (output.anomalies && output.anomalies.length > 0) {
      console.log('\n--- Detected Anomalies ---');
      output.anomalies.forEach(anomaly => {
        console.log(`  - [${anomaly.severity.toUpperCase()}] ${anomaly.metricName} at ${anomaly.timestamp.toISOString()}: ${anomaly.description} (Value: ${anomaly.value})`);
      });
    }

    if (output.recommendations && output.recommendations.length > 0) {
      console.log('\n--- Recommendations ---');
      output.recommendations.forEach(rec => console.log(`  - ${rec}`));
    }
    console.log('======================================\n');
  }

  private generateMarkdownReport(output: AnalysisOutput, title?: string, includeDetails?: boolean): string {
    let md = `# ${title || 'Performance Analysis Report'}\n\n`;
    md += `**Overall Health:** ${output.overallHealth}\n\n`;

    md += `## Key Performance Indicators\n`;
    output.keyPerformanceIndicators.forEach(kpi => {
      md += `- **${kpi.name}:** ${kpi.value} [${kpi.status.toUpperCase()}]\n`;
    });
    md += '\n';

    if (output.timingAnalysis && output.timingAnalysis.size > 0) {
      md += `## Timing Analysis\n`;
      output.timingAnalysis.forEach((stats, name) => {
        md += `### ${name}\n`;
        md += `- **Average:** ${stats.averageDurationMs.toFixed(2)} ms\n`;
        md += `- **Min:** ${stats.minDurationMs.toFixed(2)} ms\n`;
        md += `- **Max:** ${stats.maxDurationMs.toFixed(2)} ms\n`;
        md += `- **Count:** ${stats.count}\n`;
        if (includeDetails && stats.percentiles) {
          md += `- **Percentiles:** P50: ${stats.percentiles[50]?.toFixed(2)}ms, P90: ${stats.percentiles[90]?.toFixed(2)}ms, P99: ${stats.percentiles[99]?.toFixed(2)}ms\n`;
        }
        md += '\n';
      });
    }
    
    if (output.benchmarkSummary && includeDetails) {
        md += `## Benchmark Summary\n`;
        (output.benchmarkSummary as any[]).forEach(bs => {
            md += `- **${bs.name}:** Avg ${bs.avgMs?.toFixed(2)}ms ${bs.error ? `(Error: ${bs.error})`:''}\n`;
        });
        md += '\n';
    }

    if (output.loadTestSummary) {
        md += `## Load Test Summary: ${output.loadTestSummary.configName}\n`;
        const summary = output.loadTestSummary;
        md += `- **RPS:** ${summary.requestsPerSecond.toFixed(2)}\n`;
        md += `- **Avg Latency:** ${summary.averageLatencyMs.toFixed(2)}ms\n`;
        md += `- **Success/Total:** ${summary.successfulRequests}/${summary.totalRequestsSent}\n`;
        md += `- **Errors:** ${summary.failedRequests}\n\n`;
    }

    if (output.anomalies && output.anomalies.length > 0) {
      md += `## Detected Anomalies\n`;
      output.anomalies.forEach(anomaly => {
        md += `- **[${anomaly.severity.toUpperCase()}] ${anomaly.metricName}** at ${anomaly.timestamp.toISOString()}: ${anomaly.description} (Value: ${anomaly.value})\n`;
      });
      md += '\n';
    }

    if (output.recommendations && output.recommendations.length > 0) {
      md += `## Recommendations\n`;
      output.recommendations.forEach(rec => md += `- ${rec}\n`);
      md += '\n';
    }
    return md;
  }

  private generateJsonReport(output: AnalysisOutput, includeDetails?: boolean): string {
    // For JSON, we might want to serialize Dates as ISO strings
    // This is a simplified version. A more robust version would handle Date objects better.
    const replacer = (key: string, value: any) => {
        if (value instanceof Map) {
            return Object.fromEntries(value);
        }
        // Could add Date toISOString conversion here if needed and not handled by default JSON.stringify
        return value;
    }
    
    if (!includeDetails) {
        const summaryOutput = { ...output };
        // delete summaryOutput.resourceUsageSummary; // Or simplify it
        // delete summaryOutput.timingAnalysis; // Or simplify it
        return JSON.stringify(summaryOutput, replacer, 2);
    }
    return JSON.stringify(output, replacer, 2);
  }
}