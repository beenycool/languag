# Production Metrics Guide

## System Metrics
Tracked by [`src/monitoring/core/metrics/resource-metrics.ts`](src/monitoring/core/metrics/resource-metrics.ts):
- CPU usage
- Memory consumption
- Disk I/O
- Network throughput

## Application Metrics
From [`src/monitoring/production/metrics/app-metrics.ts`](src/monitoring/production/metrics/app-metrics.ts):
```typescript
interface AppMetrics {
  requestCount: number;
  errorRate: number;
  latency: number;
  cacheHitRatio: number;
}
```

## User Analytics
Implemented in [`src/monitoring/production/metrics/user-metrics.ts`](src/monitoring/production/metrics/user-metrics.ts):
- Active sessions
- Feature usage
- Conversion funnels

## Performance Monitoring
Key indicators:
1. **LLM Response Times**:
   - Tracked in [`src/main/llm/ollama-connector.ts`](src/main/llm/ollama-connector.ts)
2. **Cache Efficiency**:
   - Monitored via [`src/main/services/cache-service.ts`](src/main/services/cache-service.ts)
3. **UI Responsiveness**:
   - Measured in [`src/renderer/editor/monaco-wrapper.ts`](src/renderer/editor/monaco-wrapper.ts)