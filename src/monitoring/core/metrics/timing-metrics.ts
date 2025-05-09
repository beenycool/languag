export interface TimingMetric {
  name: string;
  durationMs: number;
  startTime: Date;
  endTime: Date;
}

export class TimingMetrics {
  private timings: Map<string, TimingMetric> = new Map();
  private activeTimers: Map<string, number> = new Map(); // Stores start time in ms

  start(name: string): void {
    if (this.activeTimers.has(name)) {
      console.warn(`Timer '${name}' already started. Overwriting.`);
    }
    this.activeTimers.set(name, performance.now());
  }

  stop(name: string): TimingMetric | undefined {
    const startTimeMs = this.activeTimers.get(name);
    if (startTimeMs === undefined) {
      console.warn(`Timer '${name}' was not started or already stopped.`);
      return undefined;
    }

    const endTimeMs = performance.now();
    const durationMs = endTimeMs - startTimeMs;
    this.activeTimers.delete(name);

    const metric: TimingMetric = {
      name,
      durationMs,
      startTime: new Date(Date.now() - durationMs), // Approximate start time
      endTime: new Date()
    };
    this.timings.set(name, metric);
    return metric;
  }

  record(name: string, durationMs: number, startTime?: Date): void {
    if (durationMs < 0) {
      throw new Error(`Timing metric '${name}' duration cannot be negative: ${durationMs}`);
    }
    const now = new Date();
    this.timings.set(name, {
      name,
      durationMs,
      startTime: startTime || new Date(now.getTime() - durationMs),
      endTime: now
    });
  }

  get(name: string): TimingMetric | undefined {
    return this.timings.get(name);
  }

  getAll(): TimingMetric[] {
    return Array.from(this.timings.values());
  }

  clear(): void {
    this.timings.clear();
    this.activeTimers.clear();
  }
}