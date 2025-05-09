# Linux Performance Optimization Guide

## Memory Limits
```c
// From src/platform/optimizations/linux/performance/memory-limits.ts
import { MemoryTuner } from 'src/platform/optimizations/linux';

const tuner = new MemoryTuner();
tuner.setLimits({
  rss: '2G',
  stack: '8M',
  locked: '512M'
});
```

## I/O Scheduling
| Scheduler | Best For | Tuning Parameters |
|-----------|----------|-------------------|
| CFQ       | HDD      | slice_idle, quantum |
| Deadline  | Mixed    | fifo_batch, write_expire |
| NOOP      | SSD      | N/A |

## Process Management
1. **Priority Classes**:
   - Use `nice` values (-20 to 19)
   - Implement proper `chrt` usage
   - Set CPU affinity

2. **Threading Models**:
   - Prefer NPTL over LinuxThreads
   - Optimize futex usage
   - Consider eventfd for IPC

## System Tuning
- Optimize swappiness (vm.swappiness)
- Tune dirty ratios (vm.dirty_*) 
- Adjust OOM killer settings
- Configure transparent hugepages