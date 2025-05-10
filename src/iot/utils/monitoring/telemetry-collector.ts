export class TelemetryCollector {
  private metrics = new Map<string, number>();
  private readonly MAX_METRICS = 1000;

  recordMetric(deviceId: string, metric: string, value: number): void {
    const key = `${deviceId}:${metric}`;
    this.metrics.set(key, value);
    
    if (this.metrics.size > this.MAX_METRICS) {
      // Remove oldest entry (Map preserves insertion order)
      const firstKey = this.metrics.keys().next().value;
      if (firstKey) {
        this.metrics.delete(firstKey);
      }
    }
  }

  getMetric(deviceId: string, metric: string): number | undefined {
    return this.metrics.get(`${deviceId}:${metric}`);
  }

  getDeviceMetrics(deviceId: string): Map<string, number> {
    const results = new Map<string, number>();
    for (const [key, value] of this.metrics) {
      if (key.startsWith(deviceId)) {
        const metric = key.split(':')[1];
        results.set(metric, value);
      }
    }
    return results;
  }
}