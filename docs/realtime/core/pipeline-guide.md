# Real-time Pipeline Configuration Guide

## Pipeline Setup
```typescript
import { createPipeline } from '@core/pipeline';

const pipeline = createPipeline({
  name: 'data-processing',
  stages: [
    { name: 'ingest', processor: 'json-parser' },
    { name: 'transform', processor: 'field-mapper' },
    { name: 'enrich', processor: 'data-lookup' }
  ]
});
```

## Stage Management
### Adding Stages
```typescript
pipeline.addStage({
  name: 'validate',
  processor: 'schema-validator',
  position: 2 // Insert after transform
});
```

### Removing Stages
```typescript
pipeline.removeStage('ingest');
```

## Buffer Configuration
```typescript
// Configure stage buffers
pipeline.configureBuffers({
  'ingest': { size: '500KB', overflow: 'drop' },
  'transform': { size: '1MB', overflow: 'block' }
});
```

## Best Practices
1. **Stage Design**:
   - Keep stages focused on single responsibilities
   - Limit stage processing time to <5ms

2. **Error Handling**:
```typescript
pipeline.on('error', (err, stage) => {
  logger.error(`Stage ${stage} failed: ${err.message}`);
});
```

3. **Monitoring**:
```typescript
setInterval(() => {
  console.log(pipeline.getMetrics());
}, 5000);
```

4. **Performance Tips**:
- Batch process small events
- Use streaming transformations
- Parallelize independent stages