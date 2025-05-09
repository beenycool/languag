# Troubleshooting Guide

## Common Issues
### High Latency
**Symptoms**:
- Slow event processing
- Growing queue sizes

**Solutions**:
1. Check processor timing:
```typescript
console.log(processor.getMetrics().avgTime);
```

2. Optimize slow handlers:
```typescript
// Before
processor.syncOperation();

// After
processor.asyncOperation();
```

### Memory Leaks
**Symptoms**:
- Growing memory usage
- Frequent garbage collection

**Diagnosis**:
```bash
node --inspect engine.js
# Then use Chrome DevTools memory profiler
```

**Solutions**:
- Release resources properly
- Use object pools
- Limit cache sizes

## Debug Strategies
### Logging Configuration
```typescript
import { logger } from '@core/utils';

logger.configure({
  level: 'debug',
  format: 'json'
});
```

### Event Tracing
```typescript
stream.enableTracing('error', 'slow');
```

## Performance Analysis
### Bottleneck Identification
1. **CPU Bound**:
```bash
top -pid <engine_pid>
```

2. **I/O Bound**:
```bash
iotop -oPa
```

3. **Memory Bound**:
```bash
htop
```

## Support Resources
### Diagnostic Tools
| Tool | Purpose |
|------|---------|
| `perf` | CPU profiling |
| `strace` | System calls |
| `tcpdump` | Network analysis |
| `jstack` | Thread dumps |

### Recovery Procedures
1. **Graceful Degradation**:
```typescript
engine.setFallbackMode(true);
```

2. **Safe Mode**:
```typescript
engine.enterSafeMode();
```

3. **Emergency Restart**:
```typescript
process.on('SIGTERM', gracefulShutdown);
```

## Error Reference
| Code | Meaning | Action |
|------|---------|--------|
| RT-101 | Backpressure overflow | Increase buffers |
| RT-202 | Processor timeout | Optimize handler |
| RT-303 | Stream deadlock | Check dependencies |
| RT-404 | Resource exhaustion | Scale vertically |