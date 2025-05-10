# Data Collection Guide

## Event Collection
```typescript
// Web event collector
const webCollector = {
  type: "web",
  endpoints: [
    {
      path: "/track",
      methods: ["POST"],
      rateLimit: "1000/1m" // 1000 requests/minute
    }
  ],
  payloadFormat: {
    required: ["userId", "eventType"],
    optional: ["properties", "timestamp"]
  }
};
```

## Metrics Collection
```typescript
// System metrics config
const metricsConfig = {
  interval: "10s", // Collection interval
  sources: [
    {
      type: "cpu",
      metrics: ["usage", "load"]
    },
    {
      type: "memory",
      metrics: ["used", "free", "total"]
    }
  ]
};
```

## Implementation Patterns
1. **Batching**: Collect and send events in batches
2. **Buffering**: Local storage for network issues
3. **Sampling**: Reduce volume for high-frequency events
4. **Validation**: Schema enforcement at collection

| Pattern | Use Case | Tradeoff |
|---------|----------|----------|
| Batching | High volume | Increased latency |
| Streaming | Real-time | Higher resource use |
| Sampling | High frequency | Potential data loss |
| Caching | Unstable networks | Memory overhead |