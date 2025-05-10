# Data Processing Guide

## Stream Processing
```typescript
// Stream processing example
const streamProcessor = {
  window: {
    size: "1m", // 1 minute windows
    slide: "30s" // slide every 30 seconds
  },
  operations: [
    {
      type: "filter",
      condition: "event.type === 'purchase'"
    },
    {
      type: "aggregate",
      field: "amount",
      operation: "sum"
    }
  ]
};
```

## Batch Processing
```typescript
// Batch job configuration
const batchJob = {
  schedule: "0 0 * * *", // Daily at midnight
  input: {
    source: "s3://data-lake/raw/",
    format: "parquet"
  },
  operations: [
    "cleanse",
    "enrich",
    "aggregate"
  ]
};
```

## Optimization Tips
1. **Partitioning**: Split data by key fields
2. **Caching**: Cache frequently used datasets
3. **Parallelism**: Scale workers per workload
4. **Compression**: Use efficient formats (Parquet, ORC)

| Operation | Stream | Batch |
|-----------|--------|-------|
| Filter    | ✅     | ✅    |
| Join      | ⚠️     | ✅    |
| Aggregate | ✅     | ✅    |
| Sort      | ❌     | ✅    |