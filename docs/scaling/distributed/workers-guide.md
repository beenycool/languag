# Distributed Workers Guide

## Worker Pool Setup
Configuration from `src/scaling/distributed/workers/worker-pool.ts`:
```typescript
const pool = new WorkerPool({
  minWorkers: 4,
  maxWorkers: 16,
  idleTimeout: '5m',
  taskQueueSize: 1000
});
```

## Task Scheduling
Three scheduling policies:
1. **FIFO** (default)
2. **Priority-based**
3. **Deadline-aware**

Example priority task:
```typescript
pool.schedule({
  task: processData,
  priority: 'high',
  deadline: Date.now() + 5000
});
```

## Worker Monitoring
Key metrics to track:
- `worker.cpu_usage`
- `worker.memory_used`
- `worker.tasks_completed`
- `worker.queue_length`

## Performance Tuning
Recommended settings:
| Parameter          | Light Load | Heavy Load |
|--------------------|------------|------------|
| minWorkers         | 2          | 8          |
| maxWorkers         | 8          | 32         |
| idleTimeout        | 10m        | 2m         |
| taskQueueSize      | 100        | 5000       |