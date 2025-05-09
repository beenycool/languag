# Getting Started with Real-time Processing

## Setup Instructions
1. **Installation**:
```bash
npm install @realtime/engine
```

2. **Configuration**:
```typescript
// config/default.js
module.exports = {
  engine: {
    workers: 4,
    maxStreams: 20
  }
};
```

## Basic Usage
### Simple Pipeline
```typescript
import { RealTimeEngine } from '@realtime/engine';

const engine = new RealTimeEngine();
const stream = engine.createStream('data-feed');

stream.addProcessor('filter', (event) => {
  return isValid(event) ? event : null;
});

stream.start();
```

## Common Patterns
1. **Event Processing**:
```typescript
engine.on('user-action', (action) => {
  processAction(action);
});
```

2. **Batch Processing**:
```typescript
engine.addBatchProcessor('analytics', {
  window: 1000,
  handler: sendToAnalytics
});
```

3. **Error Handling**:
```typescript
stream.on('error', (err) => {
  logger.error(err);
  stream.recover();
});
```

## Examples
### Real-time Analytics
```typescript
const analyticsStream = engine.createStream('analytics');
analyticsStream.addProcessor('aggregate', aggregateMetrics);
analyticsStream.addBatchProcessor('flush', {
  window: 5000,
  handler: updateDashboard
});
```

### Data Transformation
```typescript
const transformStream = engine.createStream('data-transform');
transformStream.addProcessor('parse', parseData);
transformStream.addProcessor('enrich', fetchAdditionalData);
transformStream.addProcessor('format', formatOutput);
```

## Next Steps
1. Explore the [Performance Guide](./performance-guide.md)
2. Learn about [Troubleshooting](./troubleshooting.md)
3. Review [API Reference](../api.md)