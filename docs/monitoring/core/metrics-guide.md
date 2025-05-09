# Metrics Guide

## Available Metrics
| Metric | Type | Description | Source |
|--------|------|-------------|--------|
| CPU Usage | Gauge | Current CPU utilization | [`src/main/analysis/utils/metrics.ts`](src/main/analysis/utils/metrics.ts:1) |
| Memory Usage | Gauge | Process memory consumption | [`src/main/analysis/utils/metrics.ts`](src/main/analysis/utils/metrics.ts:1) |
| Processing Time | Histogram | Time per analysis operation | [`src/main/analysis/pipeline/pipeline-coordinator.ts`](src/main/analysis/pipeline/pipeline-coordinator.ts:1) |
| Throughput | Counter | Operations per second | [`src/main/analysis/utils/metrics.ts`](src/main/analysis/utils/metrics.ts:1) |

## Collection Methods
Metrics are collected through:
1. **Direct instrumentation** - Code-level metrics
2. **System probes** - OS-level metrics
3. **Event listeners** - Framework integration points

## Resource Tracking
Key resource metrics include:
- CPU utilization
- Memory allocation
- Disk I/O
- Network bandwidth

Example configuration:
```typescript
// From src/main/analysis/utils/metrics.ts
const metrics = {
  cpu: new Gauge('cpu_usage'),
  memory: new Gauge('memory_usage')
};
```

## Timing Measurements
Timing is captured using:
- High-resolution timers
- Process.hrtime() for Node.js
- Performance API for browser contexts

See [`src/main/analysis/utils/metrics.ts`](src/main/analysis/utils/metrics.ts:1) for implementation details.