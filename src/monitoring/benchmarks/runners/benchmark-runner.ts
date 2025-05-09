import { AnalysisSuite, BenchmarkResult as SuiteBenchmarkResult } from '../suites/analysis-suite';
import { FormatSuite } from '../suites/format-suite';
import { IntegrationSuite } from '../suites/integration-suite';
import { TimingMetrics } from '../../core/metrics/timing-metrics';

// Consolidate BenchmarkResult type if they are indeed identical
type BenchmarkResult = SuiteBenchmarkResult;

interface Suite {
  // name: string; // Name is managed by the runner's map key
  runAll: () => Promise<BenchmarkResult[]>;
  // Add other common suite methods if needed, e.g., addCase, clearCases
}

export class BenchmarkRunner {
  private suites: Map<string, Suite> = new Map();
  private timingMetrics: TimingMetrics; // Shared or new instance

  constructor(timingMetrics?: TimingMetrics) {
    this.timingMetrics = timingMetrics || new TimingMetrics();
    // Automatically register known suite types, or allow manual registration
    this.registerSuite('analysis', new AnalysisSuite(this.timingMetrics));
    this.registerSuite('format', new FormatSuite(this.timingMetrics));
    this.registerSuite('integration', new IntegrationSuite(this.timingMetrics));
  }

  registerSuite(name: string, suiteInstance: Suite): void {
    if (this.suites.has(name)) {
      throw new Error(`Suite with name '${name}' is already registered.`);
    }
    this.suites.set(name, suiteInstance);
  }

  async runAllSuites(): Promise<Map<string, BenchmarkResult[]>> {
    const allResults = new Map<string, BenchmarkResult[]>();
    for (const [name, suite] of this.suites) {
      try {
        console.log(`Running benchmark suite: ${name}...`);
        const results = await suite.runAll();
        allResults.set(name, results);
        console.log(`Suite ${name} finished. Results:`, results.length);
      } catch (error: any) {
        console.error(`Error running suite '${name}':`, error);
        allResults.set(name, [{
          caseName: 'Suite Error',
          totalDurationMs: 0,
          averageDurationMs: 0,
          iterations: 0,
          error: `Suite ${name} failed: ${error.message || String(error)}`,
        }]);
      }
    }
    return allResults;
  }

  async runSingleSuite(suiteName: string): Promise<BenchmarkResult[] | undefined> {
    const suite = this.suites.get(suiteName);
    if (!suite) {
      console.error(`Suite '${suiteName}' not found.`);
      return undefined;
    }
    try {
      console.log(`Running benchmark suite: ${suiteName}...`);
      const results = await suite.runAll();
      console.log(`Suite ${suiteName} finished. Results:`, results.length);
      return results;
    } catch (error: any) {
      console.error(`Error running suite '${suiteName}':`, error);
      return [{
        caseName: 'Suite Error',
        totalDurationMs: 0,
        averageDurationMs: 0,
        iterations: 0,
        error: `Suite ${suiteName} failed: ${error.message || String(error)}`,
      }];
    }
  }

  getSuite(name: string): Suite | undefined {
    return this.suites.get(name);
  }

  listSuites(): string[] {
    return Array.from(this.suites.keys());
  }
}