# Stream Transformation Guide

## Data Transformation
### Basic Transformations
```typescript
stream.addTransform('field-mapping', (event) => {
  return {
    id: event.userId,
    value: event.amount,
    timestamp: event.createdAt
  };
});
```

### Schema Evolution
```typescript
stream.addTransform('schema-upgrade', (event) => {
  if (event.version === 1) {
    return convertV1ToV2(event);
  }
  return event;
});
```

## Format Conversion
### JSON Processing
```typescript
stream.addTransform('json-normalize', {
  input: 'text',
  output: 'json',
  handler: parseJSON
});
```

### Binary Conversion
```typescript
stream.addTransform('protobuf-decode', {
  input: 'binary',
  output: 'json',
  handler: decodeProtobuf
});
```

## Filter Chains
### Conditional Filtering
```typescript
stream.addFilter('high-value', (event) => {
  return event.amount > 1000;
});
```

### Chained Filters
```typescript
stream.addFilterChain([
  (event) => isValid(event),
  (event) => isRelevant(event),
  (event) => !isDuplicate(event)
]);
```

## Performance Considerations
1. **Transformation Costs**:
   - Measure transform execution time
   - Avoid synchronous I/O in transforms
   - Cache expensive operations

2. **Memory Usage**:
```typescript
// Stream large payloads
stream.addTransform('large-payload', {
  streaming: true,
  handler: processLargePayload
});
```

3. **Throughput Tips**:
- Batch small events
- Use efficient serialization
- Parallelize independent transforms

## Monitoring
Track transform metrics:
```typescript
const transformStats = transform.getMetrics();
// {
//   processed: 12500,
//   errors: 3,
//   avgTime: 1.2,
//   throughput: 1041
// }