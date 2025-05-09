import { BenchmarkResult } from '../suites/analysis-suite'; // Assuming this is the common result type
import { LoadTestSummary } from './load-generator';

export type AllBenchmarkResults = Map<string, BenchmarkResult[]>;

export class ResultReporter {
  constructor() {
    // Configuration for reporting can be added here (e.g., output directory, formats)
  }

  // --- Benchmark Suite Reporting ---

  public reportSuiteResultsConsole(suiteName: string, results: BenchmarkResult[]): void {
    console.log(`\n--- Benchmark Results for Suite: ${suiteName} ---`);
    if (!results || results.length === 0) {
      console.log('No results to report.');
      return;
    }

    results.forEach(result => {
      if (result.error) {
        console.error(`  Case: ${result.caseName} - FAILED`);
        console.error(`    Error: ${result.error}`);
      } else {
        console.log(`  Case: ${result.caseName}`);
        console.log(`    Iterations: ${result.iterations}`);
        console.log(`    Total Duration: ${result.totalDurationMs.toFixed(3)} ms`);
        console.log(`    Average Duration: ${result.averageDurationMs.toFixed(3)} ms/op`);
        if (result.individualTimings && result.individualTimings.length > 0) {
          const min = Math.min(...result.individualTimings).toFixed(3);
          const max = Math.max(...result.individualTimings).toFixed(3);
          console.log(`    Min/Max Duration: ${min} ms / ${max} ms`);
        }
      }
      console.log('  -----------------------------------');
    });
  }

  public reportAllBenchmarkResultsConsole(allResults: AllBenchmarkResults): void {
    console.log('\n===== All Benchmark Suite Results =====');
    if (allResults.size === 0) {
      console.log('No benchmark suites were run or produced results.');
      return;
    }
    for (const [suiteName, results] of allResults) {
      this.reportSuiteResultsConsole(suiteName, results);
    }
    console.log('===== End of Benchmark Suite Results =====');
  }

  // TODO: Implement other reporting formats like JSON, CSV, HTML
  // public async reportSuiteResultsJson(suiteName: string, results: BenchmarkResult[], filePath: string): Promise<void> {}
  // public async reportAllBenchmarkResultsJson(allResults: AllBenchmarkResults, filePath: string): Promise<void> {}

  // --- Load Test Reporting ---

  public reportLoadTestSummaryConsole(summary: LoadTestSummary): void {
    console.log(`\n--- Load Test Summary: ${summary.configName} ---`);
    console.log(`  Total Requests Sent: ${summary.totalRequestsSent}`);
    console.log(`  Successful Requests: ${summary.successfulRequests}`);
    console.log(`  Failed Requests: ${summary.failedRequests}`);
    console.log(`  Total Test Duration: ${(summary.totalDurationMs / 1000).toFixed(3)} s`);
    console.log(`  Requests Per Second (RPS): ${summary.requestsPerSecond.toFixed(2)}`);
    console.log(`  Average Latency: ${summary.averageLatencyMs.toFixed(3)} ms`);
    console.log(`  Min Latency: ${summary.minLatencyMs.toFixed(3)} ms`);
    console.log(`  Max Latency: ${summary.maxLatencyMs.toFixed(3)} ms`);
    if (summary.p90LatencyMs !== undefined) console.log(`  P90 Latency: ${summary.p90LatencyMs.toFixed(3)} ms`);
    if (summary.p95LatencyMs !== undefined) console.log(`  P95 Latency: ${summary.p95LatencyMs.toFixed(3)} ms`);
    if (summary.p99LatencyMs !== undefined) console.log(`  P99 Latency: ${summary.p99LatencyMs.toFixed(3)} ms`);

    if (summary.errors.length > 0) {
      console.log('  Errors Encountered:');
      summary.errors.forEach(err => {
        console.log(`    - "${err.message}": ${err.count} time(s)`);
      });
    }
    console.log('  -----------------------------------');

    // Optionally print some individual results if available and needed for quick glance
    if (summary.individualResults && summary.individualResults.length > 0) {
        console.log(`  Sample of ${Math.min(5, summary.individualResults.length)} individual results:`);
        summary.individualResults.slice(0, 5).forEach(res => {
            console.log(`    Iter ${res.iteration}: ${res.durationMs.toFixed(3)}ms - ${res.success ? 'OK' : `FAIL (${res.error})`}`);
        });
    }
  }

  // TODO: Implement other reporting formats for load tests
  // public async reportLoadTestSummaryJson(summary: LoadTestSummary, filePath: string): Promise<void> {}
}