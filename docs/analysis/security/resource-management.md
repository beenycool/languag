# Resource Management System

## Cache Management

1. **Semantic Cache** - Stores analysis results in [`src/main/services/cache/cache-semantic.ts`](src/main/services/cache/cache-semantic.ts)
2. **Encrypted Cache** - Securely stores sensitive data in [`src/main/services/cache/cache-encryption.ts`](src/main/services/cache/cache-encryption.ts)
3. **Eviction Policy** - LRU-based cache clearing

```typescript
// Example cache usage
import { getSemanticCache } from '../../src/main/services/cache/cache-semantic';
const cache = getSemanticCache();
const cachedResult = cache.get(textHash);
```

## Memory Considerations

1. **Per-analysis Limits** - 200MB maximum per analysis job
2. **Document Chunking** - Large documents processed in sections
3. **Leak Detection** - Automated memory usage monitoring

## Performance Optimization

1. **Parallel Processing** - Uses [`src/main/analysis/utils/parallel-processor.ts`](src/main/analysis/utils/parallel-processor.ts)
2. **Batch Processing** - Combines multiple small analyses
3. **Pre-warming** - Frequently used engines kept in memory