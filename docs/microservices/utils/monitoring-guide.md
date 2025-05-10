# Microservices Monitoring Guide

## Performance Monitoring

Key metrics to track:
- Request latency (p50, p90, p99)
- Error rates
- Throughput
- Resource utilization

```typescript
// From metrics-collector.ts
interface Metric {
  name: string;
  value: number;
  tags: Record<string, string>;
}
```

## Dependency Tracking

Implementation using OpenTelemetry:
```typescript
// Reference: [`src/realtime/services/monitoring/performance-monitor.ts`](src/realtime/services/monitoring/performance-monitor.ts)
class Tracer {
  startSpan(name: string) {
    // Implementation
  }
}
```

## Resource Monitoring

Critical resources:
- CPU usage
- Memory consumption
- Network I/O
- Disk utilization

Alerting example:
```yaml
# From alert-manager.ts
alert_rules:
  - alert: HighCPUUsage
    expr: cpu_usage > 80%
    for: 5m
```

## Alerting Setup

Best practices:
1. Tiered alert levels
2. Meaningful notifications
3. Auto-remediation hooks
4. Alert fatigue prevention