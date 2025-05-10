# Load Balancers Guide

## Request Distribution
Uses weighted round-robin with health checks:

```typescript
// From src/scaling/load/balancers/workload-balancer.ts
class WorkloadBalancer {
  private weights: Map<Node, number>;
  
  distribute(request: Request): Node {
    // Implementation details...
  }
}
```

## Workload Balancing
Three strategies available:
1. **CPU-based**: `ResourceBalancer`
2. **Memory-based**: `MemoryAwareBalancer` 
3. **Hybrid**: `WorkloadBalancer`

## Resource Allocation
Configure in `config.yaml`:
```yaml
balancer:
  cpu_threshold: 80%
  memory_threshold: 70%
  check_interval: 5s
```

## Configuration Options
| Parameter         | Default | Description               |
|-------------------|---------|---------------------------|
| algorithm         | rr      | Round-robin or least-conn |
| health_check      | 10s     | Node health interval      |
| failover_threshold| 3       | Failed checks before mark |