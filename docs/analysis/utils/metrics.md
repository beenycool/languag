# Metrics Collector

Tracks and aggregates performance metrics across the analysis pipeline.

## Collected Metrics

1. **Timing Metrics**:
   - Processing time per segment
   - Engine execution times
   - Pipeline stage durations

2. **Resource Metrics**:
   - Memory usage
   - CPU utilization
   - Parallel task counts

3. **Quality Metrics**:
   - Findings per segment
   - Confidence scores
   - Error rates

## Configuration

```typescript
interface MetricsConfig {
  autoReset: boolean;       // Clear after each collection
  sanitizeData: boolean;    // Remove sensitive information
  collectionInterval: number; // Milliseconds between samples
}
```

## Usage Example

```typescript
const metrics = new MetricsCollector({
  autoReset: false,
  sanitizeData: true
});

// During analysis
metrics.record('engine:grammar', { time: 150, findings: 3 });

// Get summary
const report = metrics.getReport();
```

## Security Considerations

- Enable `sanitizeData` when handling sensitive text
- Set appropriate collection intervals to balance detail vs performance
- Reset metrics regularly for accurate time-bound reporting