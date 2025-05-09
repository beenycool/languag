# Stream Management Guide

## Stream Control
### Creating Streams
```typescript
const stream = engine.createStream('payment-events', {
  source: 'kafka://payments',
  bufferSize: '500KB'
});
```

### Lifecycle Management
```typescript
// Start/stop streams
stream.start();
stream.pause();
stream.resume();
stream.destroy();
```

## Backpressure Handling
### Strategies
1. **Drop** (default):
```typescript
stream.setBackpressure('drop');
```

2. **Block**:
```typescript
stream.setBackpressure('block', { timeout: 1000 });
```

3. **Sample**:
```typescript
stream.setBackpressure('sample', { rate: 0.5 }); // 50% sampling
```

## Flow Control
### Rate Limiting
```typescript
stream.configureFlow({
  maxRate: 1000, // events/sec
  burstSize: 100
});
```

### Dynamic Throttling
```typescript
stream.on('backpressure', (pressure) => {
  if (pressure > 0.8) {
    stream.throttle(0.5); // Reduce to 50% capacity
  }
});
```

## Error Handling
### Recovery Policies
```typescript
stream.setRecovery({
  retries: 3,
  backoff: 'exponential',
  maxDelay: 5000
});
```

### Error Events
```typescript
stream.on('error', (err) => {
  logger.error('Stream error:', err);
  if (isFatal(err)) {
    stream.recover(); // Attempt recovery
  }
});
```

## Monitoring
Key stream metrics:
```typescript
const metrics = stream.getMetrics();
// {
//   throughput: 1200,
//   latency: 3.2,
//   bufferSize: 0.75,
//   errorCount: 2
// }