import { TimingMetrics } from '../../core/metrics/timing-metrics';

export interface BenchmarkCase {
  name: string;
  description?: string;
  execute: () => Promise<void> | void; // Benchmarked function
  iterations?: number; // Number of times to run, defaults to 1
  warmupIterations?: number; // Iterations before actual measurement, defaults to 0
}

export interface BenchmarkResult {
  caseName: string;
  totalDurationMs: number;
  averageDurationMs: number;
  iterations: number;
  individualTimings?: number[]; // Optional: store individual run times
  error?: string; // If an error occurred
}

export class AnalysisSuite {
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
      throw new Error(`Benchmark case with name '${benchmarkCase.name}' already exists.`);
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
    const timerName = `benchmark_${benchmarkCase.name}`;

    try {
      // Warmup phase
      for (let i = 0; i < warmupIterations; i++) {
        await benchmarkCase.execute();
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
          // This should ideally not happen if start/stop logic is correct
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
      console.error(`Error running benchmark case '${benchmarkCase.name}':`, error);
      return {
        caseName: benchmarkCase.name,
        totalDurationMs: 0,
        averageDurationMs: 0,
        iterations,
        error: error.message || String(error),
      };
    } finally {
      this.timingMetrics.clear(); // Clear metrics for this specific benchmark case run
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