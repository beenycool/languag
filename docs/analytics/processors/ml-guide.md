# Machine Learning Guide

## Predictive Analytics
```typescript
// Time series forecasting config
const forecastConfig = {
  model: "prophet",
  params: {
    seasonality: {
      mode: "multiplicative",
      periods: [7, 365] // Weekly and yearly
    }
  },
  training: {
    lookback: "2y",
    evaluation: "30d" // Last 30 days for testing
  }
};
```

## Classification Setup
```typescript
// Classification pipeline
const classifier = {
  features: [
    "age",
    "purchase_frequency",
    "avg_order_value"
  ],
  target: "churn_risk",
  algorithm: "xgboost",
  hyperparameters: {
    max_depth: 6,
    learning_rate: 0.1
  }
};
```

## Model Management
| Task | Tools | Frequency |
|------|-------|-----------|
| Training | MLflow, TFX | Daily/Weekly |
| Evaluation | Evidently, Arize | On-demand |
| Monitoring | Prometheus, Grafana | Real-time |
| Retraining | Airflow, Kubeflow | Monthly |