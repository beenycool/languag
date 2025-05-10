# Auto Scaling Guide

## Scale Management
Components from `src/scaling/performance/auto-scaling/`:
- `ScaleManager`: Core scaling logic
- `DemandPredictor`: Forecasts future load
- `CapacityPlanner`: Determines needed resources

```typescript
const scaleManager = new ScaleManager({
  minInstances: 2,
  maxInstances: 10,
  scaleOutFactor: 1.5
});
```

## Load Prediction
Uses time-series analysis:
```yaml
prediction:
  model: arima
  history_window: 24h
  forecast_horizon: 30m
  confidence_threshold: 80%
```

## Capacity Planning
Key considerations:
1. Current utilization
2. Historical patterns
3. Business calendar
4. Special events

## Threshold Configuration
Recommended defaults:
| Metric          | Scale Out | Scale In |
|-----------------|-----------|----------|
| CPU             | 75%       | 25%      |
| Memory          | 80%       | 30%      |
| Queue Length    | 100       | 10       |