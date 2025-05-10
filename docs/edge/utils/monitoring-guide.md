# Edge Monitoring Utilities

## Health Checks
```ts
// From [health-monitor.ts](src/realtime/services/monitoring/health-monitor.ts)
const healthConfig = {
  checkInterval: 5000,
  failureThreshold: 3,
  metrics: ['cpu', 'memory', 'network']
};
```

## Metrics Collection
```mermaid
graph LR
  A[Edge Node] -->|Push| B(Metrics Aggregator)
  B --> C[Time Series DB]
  C --> D[Monitoring Dashboard]
```

## Diagnostic Tools
```bash
# Access real-time metrics stream
edge-cli monitor --filter "cpu_usage > 0.8" --interval 1s
```

[Next: Optimization Strategies →](../utils/optimization-guide.md)