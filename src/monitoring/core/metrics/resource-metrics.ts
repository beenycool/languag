interface ResourceMetric {
  name: string;
  value: number;
  unit: 'bytes' | 'percentage' | 'count';
  timestamp: Date;
}

export class ResourceMetrics {
  private metrics: Map<string, ResourceMetric> = new Map();

  record(name: string, value: number, unit: 'bytes' | 'percentage' | 'count'): void {
    if (value < 0) {
      throw new Error(`Resource metric '${name}' cannot be negative: ${value}`);
    }
    this.metrics.set(name, {
      name,
      value,
      unit,
      timestamp: new Date()
    });
  }

  get(name: string): ResourceMetric | undefined {
    return this.metrics.get(name);
  }

  getAll(): ResourceMetric[] {
    return Array.from(this.metrics.values());
  }

  clear(): void {
    this.metrics.clear();
  }
}