# Worker Performance Optimization

## Resource Management

### Worker Pool Sizing
```typescript
// Optimal pool size based on CPU cores
const POOL_SIZE = navigator.hardwareConcurrency || 4;
const workerPool = new WorkerPool(POOL_SIZE);
```

### Memory Management
1. **Transfer ownership** of large data structures
2. **Limit payload size** (<1MB per message)
3. **Clean up** processed data

```typescript
// Transfer ArrayBuffer instead of copying
worker.postMessage(
  { largeData: arrayBuffer }, 
  [arrayBuffer] // Transfer ownership
);
```

## Optimization Strategies

### Task Batching
```typescript
// Batch small analysis tasks
function batchTasks(tasks: AnalysisTask[], batchSize = 10) {
  const batches = [];
  for (let i = 0; i < tasks.length; i += batchSize) {
    batches.push(tasks.slice(i, i + batchSize));
  }
  return batches;
}
```

### Priority Queue
```typescript
// Prioritize UI-critical tasks
interface PrioritizedTask {
  task: Task;
  priority: number; // 0-100
}

class PriorityWorkerPool extends WorkerPool {
  execute(task: PrioritizedTask) {
    // Insert based on priority
    this.queue.splice(
      this.queue.findIndex(t => t.priority < task.priority),
      0,
      task
    );
  }
}
```

## Monitoring Metrics

| Metric | Description | Target Value |
|--------|-------------|--------------|
| Task Queue Length | Pending tasks | <5 |
| Worker Utilization | Active workers/total | 60-80% |
| Avg. Task Time | Milliseconds per task | <200ms |
| Memory Usage | MB per worker | <100MB |

```typescript
// Monitoring implementation
setInterval(() => {
  const metrics = {
    queueLength: workerPool.queue.length,
    activeWorkers: workerPool.workers.filter(w => w.isBusy).length,
    avgTaskTime: calculateAverage(workerPool.taskTimes)
  };
  sendMetrics(metrics);
}, 5000);
```

## Common Bottlenecks

1. **Serialization Overhead**
   - Solution: Use transferable objects

2. **Frequent Worker Creation**
   - Solution: Maintain warm pool

3. **Large Message Payloads**
   - Solution: Chunk large data

4. **Blocking Main Thread**
   - Solution: Offload more to workers

## Best Practices

1. **Pre-warm Workers**
   ```typescript
   // Initialize workers at app start
   function prewarmWorkers(pool: WorkerPool, count: number) {
     pool.execute({type: 'init'});
   }
   ```

2. **Implement Timeouts**
   ```typescript
   function withTimeout<T>(promise: Promise<T>, ms: number) {
     return Promise.race([
       promise,
       new Promise((_, reject) => 
         setTimeout(() => reject(new Error('Timeout')), ms)
       )
     ]);
   }
   ```

3. **Error Recovery**
   ```typescript
   worker.onerror = (error) => {
     replaceWorker(worker);
     retryFailedTasks();
   };
   ```

## Related Documentation
- [Worker Architecture](./worker-architecture.md)
- [IPC Performance](../ipc/state-sync-guide.md#performance)
- [Suggestion System](../components/suggestion-system.md)