# Real-time Engine Configuration Guide

## Basic Setup
```typescript
import { RealTimeEngine } from '@core/engine';

const engine = new RealTimeEngine({
  workerThreads: 4,
  maxStreams: 20,
  bufferSize: '1MB'
});
```

## Stream Management
Key stream operations:
```typescript
// Create stream
const stream = engine.createStream('data-pipeline');

// Pause/resume
stream.pause();
stream.resume();

// Destroy stream
stream.destroy();
```

## Scheduling Strategies
Available scheduling modes:
1. **Round Robin** (default)
2. **Priority-based**
3. **Affinity-based**

```typescript
// Configure scheduling
engine.setScheduler({
  type: 'priority',
  weights: {
    high: 3,
    normal: 2, 
    low: 1
  }
});
```

## Performance Tuning
Key parameters:
```typescript
// Optimized configuration
const tunedEngine = new RealTimeEngine({
  workerThreads: 8,
  maxStreams: 30,
  bufferSize: '2MB',
  scheduler: {
    type: 'affinity',
    cpuAffinity: true
  }
});
```

## Monitoring
Access performance metrics:
```typescript
const metrics = engine.getMetrics();
// {
//   throughput: 45200,
//   latency: 4.2,
//   cpuUsage: 0.75
// }