# Troubleshooting Guide

## Common Issues
1. **Add-in not loading**:
   - Check Office version compatibility
   - Verify manifest configuration ([`manifest.xml`](src/addins/word/manifest.xml))

2. **Analysis failures**:
   - Check [`llm-service.spec.ts`](src/main/services/__tests__/llm-service.spec.ts) for expected behavior
   - Review error logs in [`logger.ts`](src/main/services/logger.ts)

## Debugging Strategies
1. Enable debug mode in [`config-manager.ts`](src/main/services/config-manager.ts):
```typescript
config.set('debug', true);
```

2. Use Office Add-in debugger
3. Check network traffic in F12 tools

## Performance Optimization
1. Cache frequent operations ([`format-cache.spec.ts`](src/main/integration/services/__tests__/cache/format-cache.spec.ts))
2. Batch document operations
3. Optimize analysis pipeline ([`pipeline.spec.ts`](src/main/analysis/__tests__/pipeline.spec.ts))