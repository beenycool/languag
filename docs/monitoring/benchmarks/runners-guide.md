# Benchmark Runners Guide

## Running Benchmarks
Execute benchmarks using:
```bash
npm run benchmark -- --suite=<suite-name>
```

Available options:
- `--iterations` - Number of test runs (default: 1000)
- `--warmup` - Warmup iterations (default: 100)
- `--output` - Results format (json, csv, text)

## Load Generation
The system supports:
1. **Constant load** - Fixed request rate
2. **Ramp-up** - Gradual increase
3. **Spike testing** - Sudden bursts

Example configuration:
```typescript
// From src/monitoring/benchmark/runner.ts
const config = {
  loadProfile: 'ramp',
  startRate: 100,
  endRate: 1000,
  duration: '60s'
};
```

## Results Reporting
Reports include:
- Statistical summaries
- Percentile distributions
- Comparative analysis
- Resource utilization

## Performance Analysis
Key analysis techniques:
1. **Bottleneck identification** - CPU, Memory, I/O
2. **Throughput/latency correlation**
3. **Garbage collection impact**
4. **Concurrency scaling**

See [`src/monitoring/integration/exporters/metric-exporter.ts`](src/monitoring/integration/exporters/metric-exporter.ts:1) for export formats.