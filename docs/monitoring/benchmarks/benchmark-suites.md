# Benchmark Suites

## Available Test Suites
1. **Unit Performance** - Microbenchmarks for individual functions
2. **Integration Load** - System-level performance tests
3. **Stress Tests** - Extreme condition testing
4. **Comparative** - Performance against baseline versions

## Creating Custom Suites
To create a new benchmark suite:
1. Create a new file in `src/__tests__/benchmarks/`
2. Extend the base Benchmark class:
```typescript
import { Benchmark } from '../../monitoring/benchmark';

class MyBenchmark extends Benchmark {
  async run() {
    // Test implementation
  }
}
```

## Best Practices
- Isolate test environments
- Run multiple iterations (min 1000)
- Warm up JIT compilers
- Measure both mean and outliers

## Result Interpretation
Key metrics to analyze:
- **Throughput** - Ops/second
- **Latency** - P95/P99 response times
- **Memory** - Heap usage patterns
- **CPU** - Utilization during test