# Real-time ML Integration Guide

## Stream Processing
Core components:
- **Stream Processor** (`src/ml/__tests__/integration/realtime/stream-processor.spec.ts`)
- **Event Queue**
- **Result Aggregator**

```typescript
// From src/realtime/__tests__/core/engine/stream-manager.spec.ts
const processor = new StreamProcessor({
  windowSize: 5,
  slideInterval: 1000
});
```

## Real-time Inference
Configuration:
```yaml
realtime:
  maxLatency: 50ms
  throughput: 1000rps
  fallback: cached-results
```

## Batch Scheduling
Scheduling options:
```json
{
  "scheduling": {
    "strategy": "fixed-rate",
    "interval": "5m",
    "priority": "high"
  }
}
```

## Performance Tips
1. Use windowed processing for stateful operations
2. Enable result caching for frequent queries
3. Monitor with:
```bash
$ ml-monitor streams --metrics latency,throughput