import { TimingMetrics } from '../../core/metrics/timing-metrics';
import { BenchmarkCase, BenchmarkResult } from './analysis-suite'; // Reusing definitions

// Specific types for integration benchmarks could involve more complex setup/teardown,
// or metrics related to inter-component communication.
// For now, we'll use the generic BenchmarkCase and BenchmarkResult.

export class IntegrationSuite {
  private cases: BenchmarkCase[] = [];
  private timingMetrics: TimingMetrics;

  constructor(timingMetrics?: TimingMetrics) {
    this.timingMetrics = timingMetrics || new TimingMetrics();
  }

  add(benchmarkCase: BenchmarkCase): void {
    if (!benchmarkCase.name || benchmarkCase.name.trim() === '') {
      throw new Error('Benchmark case name cannot be empty.');
    }
    if (this.cases.find(c => c.name === benchmarkCase.name)) {
      throw new Error(`Benchmark case with name '${benchmarkCase.name}' already exists in IntegrationSuite.`);
    }
    this.cases.push(benchmarkCase);
  }

  async runAll(): Promise<BenchmarkResult[]> {
    const results: BenchmarkResult[] = [];
    for (const benchmarkCase of this.cases) {
      results.push(await this.runCase(benchmarkCase));
    }
    return results;
  }

  async runCase(benchmarkCase: BenchmarkCase): Promise<BenchmarkResult> {
    const iterations = benchmarkCase.iterations || 1;
    const warmupIterations = benchmarkCase.warmupIterations || 0;
    const individualTimings: number[] = [];
    let totalDurationMs = 0;
    const timerName = `benchmark_integration_${benchmarkCase.name}`;

    try {
      // Warmup phase
      for (let i = 0; i < warmupIterations; i++) {
        await benchmarkCase.execute(); // Assuming execute might involve async setup/teardown for integration tests
      }

      // Measurement phase
      for (let i = 0; i < iterations; i++) {
        this.timingMetrics.start(timerName);
        await benchmarkCase.execute();
        const timing = this.timingMetrics.stop(timerName);
        if (timing) {
          individualTimings.push(timing.durationMs);
          totalDurationMs += timing.durationMs;
        } else {
          console.warn(`Timing for ${timerName} iteration ${i} was not recorded.`);
        }
      }

      return {
        caseName: benchmarkCase.name,
        totalDurationMs,
        averageDurationMs: iterations > 0 ? totalDurationMs / iterations : 0,
        iterations,
        individualTimings,
      };
    } catch (error: any) {
      console.error(`Error running integration benchmark case '${benchmarkCase.name}':`, error);
      return {
        caseName: benchmarkCase.name,
        totalDurationMs: 0,
        averageDurationMs: 0,
        iterations,
        error: error.message || String(error),
      };
    } finally {
      this.timingMetrics.clear(); // Clear timers for this specific run
    }
  }

  getCase(name: string): BenchmarkCase | undefined {
    return this.cases.find(c => c.name === name);
  }

  getAllCases(): BenchmarkCase[] {
    return [...this.cases];
  }

  clearCases(): void {
    this.cases = [];
  }
}