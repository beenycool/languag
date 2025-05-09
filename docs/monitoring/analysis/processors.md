# Metric Processors

## Metric Analysis
The system provides several analysis processors:
1. **Statistical Analysis** - Mean, median, percentiles
2. **Rate Calculation** - Operations per time unit
3. **Normalization** - Scale metrics for comparison

## Trend Detection
Processors can identify:
- Gradual performance degradation
- Seasonal patterns
- Step changes in metrics

Example configuration:
```typescript
// From src/main/analysis/pipeline/result-merger.ts
const trendConfig = {
  windowSize: '5m',
  sensitivity: 0.8,
  minChange: 0.1
};
```

## Anomaly Detection
Algorithms include:
- Z-score based detection
- Moving average deviations
- Machine learning models

## Configuration Options
Key processor settings:
- `windowSize` - Analysis time window
- `thresholds` - Alert boundaries
- `smoothing` - Noise reduction
- `aggregation` - Metric grouping

See [`src/main/analysis/pipeline/pipeline-coordinator.ts`](src/main/analysis/pipeline/pipeline-coordinator.ts:1) for implementation.