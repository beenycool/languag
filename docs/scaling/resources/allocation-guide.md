# Resource Allocation Guide

## CPU Management
From `src/scaling/resources/allocation/cpu-manager.ts`:
```typescript
const cpuManager = new CpuManager({
  allocationStrategy: 'burst',
  coresPerProcess: 2,
  throttleThreshold: 90
});
```

## Memory Management
Key configuration:
```yaml
memory:
  allocation_mode: dynamic
  min_per_process: 256MB
  max_per_process: 2GB
  swap_buffer: 10%
```

## Configuration Tips
1. Set conservative limits for production
2. Enable oversubscription for dev/test
3. Monitor actual usage before tuning
4. Use `ResourceAllocator.stats()` for metrics

## Best Practices
- Allocate resources by workload type
- Implement graceful degradation
- Set up resource quotas
- Monitor for contention