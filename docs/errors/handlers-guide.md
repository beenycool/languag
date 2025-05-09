# Error Handlers Guide

## Crash Handling
Implemented in [`src/main/main.ts`](src/main/main.ts):
```typescript
process.on('uncaughtException', (error) => {
  crashHandler.logCrash(error);
  if (criticalError(error)) process.exit(1);
});
```

## Recovery Procedures
1. **Automatic Recovery**:
   - Service restart
   - State restoration from [`src/main/services/cache-service.ts`](src/main/services/cache-service.ts)

2. **Manual Recovery**:
   ```bash
   # Verify system state
   npm run healthcheck

   # Start recovery
   npm run recover
   ```

## Diagnostics Setup
Diagnostic tools:
- Memory dumps
- CPU profiling
- Network capture
- Log correlation

## Debug Strategies
1. **Reproduction**:
   - Use test cases from [`src/__tests__/`](src/__tests__/)
2. **Isolation**:
   - Component testing
   - Mock dependencies
3. **Analysis**:
   - Stack traces
   - Metric correlations