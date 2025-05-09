import { TimingMetrics } from '../../core/metrics/timing-metrics';
import { BenchmarkCase, BenchmarkResult } from './analysis-suite'; // Reusing definitions

// Specific types for format benchmarks could be added if needed,
// e.g., for tracking bytes processed or specific format operations.
// For now, we'll use the generic BenchmarkCase and BenchmarkResult.

export class FormatSuite {
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
      throw new Error(`Benchmark case with name '${benchmarkCase.name}' already exists in FormatSuite.`);
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
    const timerName = `benchmark_format_${benchmarkCase.name}`;

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
      console.error(`Error running format benchmark case '${benchmarkCase.name}':`, error);
      return {
        caseName: benchmarkCase.name,
        totalDurationMs: 0,
        averageDurationMs: 0,
        iterations,
        error: error.message || String(error),
      };
    } finally {
      // Clear metrics specific to this benchmark case run from the shared/temporary timer
      // This assumes TimingMetrics `stop` removes the timer, or `clear` is selective.
      // If TimingMetrics is shared across suites, more careful clearing might be needed.
      // For now, let's assume `TimingMetrics` used here is either per-suite or per-run.
      // A simple clear might be too broad if the TimingMetrics instance is long-lived and shared.
      // The current `analysis-suite` clears all its timers, which is fine if it's one-shot.
      // Let's ensure this suite does the same for its timers.
      this.timingMetrics.clear(); // Clears all timers in this instance.
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