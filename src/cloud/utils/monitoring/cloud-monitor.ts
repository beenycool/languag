type MetricType = 'gauge' | 'counter' | 'histogram';
type Metric = {
  name: string;
  type: MetricType;
  value: number;
  labels: Record<string, string>;
  timestamp: Date;
};

export class CloudMonitor {
  private metrics: Metric[] = [];
  private retentionPeriod = 3600; // 1 hour in seconds

  recordMetric(metric: Omit<Metric, 'timestamp'>) {
    this.metrics.push({ ...metric, timestamp: new Date() });
    this.cleanupOldMetrics();
  }

  queryMetrics(filter: Partial<Metric>) {
    return this.metrics.filter(m => 
      Object.entries(filter).every(([key, value]) => 
        m[key as keyof Metric] === value
      )
    );
  }

  getMetricSummary(name: string) {
    const metrics = this.metrics.filter(m => m.name === name);
    if (metrics.length === 0) return null;
    
    return {
      average: metrics.reduce((sum, m) => sum + m.value, 0) / metrics.length,
      min: Math.min(...metrics.map(m => m.value)),
      max: Math.max(...metrics.map(m => m.value)),
      count: metrics.length
    };
  }

  private cleanupOldMetrics() {
    const cutoff = new Date(Date.now() - this.retentionPeriod * 1000);
    this.metrics = this.metrics.filter(m => m.timestamp > cutoff);
  }
}