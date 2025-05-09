interface PerformanceMetric {
  name: string;
  value: number;
  unit: string;
  timestamp: Date;
}

export class PerformanceMetrics {
  private metrics: Map<string, PerformanceMetric> = new Map();

  record(name: string, value: number, unit: string): void {
    this.metrics.set(name, {
      name,
      value,
      unit,
      timestamp: new Date()
    });
  }

  get(name: string): PerformanceMetric | undefined {
    return this.metrics.get(name);
  }

  getAll(): PerformanceMetric[] {
    return Array.from(this.metrics.values());
  }

  clear(): void {
    this.metrics.clear();
  }
}