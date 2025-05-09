# Processor Handlers Guide

## Text Processing
```typescript
// Basic text processor
engine.addProcessor('text-uppercase', (event) => {
  return event.text.toUpperCase();
});

// Chained processors
engine.addProcessor('text-pipeline', [
  (event) => ({ ...event, text: event.text.trim() }),
  (event) => ({ ...event, text: event.text.toLowerCase() })
]);
```

## Data Processing
### Transformation
```typescript
engine.addProcessor('json-transform', (event) => {
  return {
    ...event,
    data: transformSchema(event.data)
  };
});
```

### Filtering
```typescript
engine.addProcessor('data-filter', (event) => {
  if (!isValid(event.data)) {
    return null; // Discard event
  }
  return event;
});
```

## Event Handling Patterns
1. **Simple Handler**:
```typescript
engine.on('user-action', (action) => {
  processAction(action);
});
```

2. **Stateful Handler**:
```typescript
const sessionProcessor = createSessionProcessor();

engine.addProcessor('session-tracker', (event) => {
  return sessionProcessor.handle(event);
});
```

3. **Batch Handler**:
```typescript
engine.addBatchProcessor('analytics', {
  window: 1000, // 1 second
  maxSize: 100,
  handler: (batch) => {
    sendToAnalytics(batch);
  }
});
```

## Implementation Tips
- Keep handlers stateless when possible
- Use middleware for cross-cutting concerns
- Implement backpressure handling
- Monitor handler execution times