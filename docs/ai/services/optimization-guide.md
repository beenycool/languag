# AI Service Optimization Guide

## Model Optimization
Techniques:
- Quantization (FP32 → FP16/INT8)
- Pruning (remove unimportant weights)
- Knowledge distillation
- Architecture search

## Performance Tuning
```python
# Benchmarking script
start = time.time()
output = model(input)
latency = time.time() - start
throughput = batch_size / latency
```

## Resource Management
| Resource | Monitoring Metric | Optimization |
|----------|-------------------|--------------|
| CPU | utilization % | Limit threads |
| Memory | usage GB | Batch sizing |
| GPU | memory % | Mixed precision |

## Monitoring Setup
Key metrics to track:
- Request latency
- Error rates
- Resource utilization
- Queue depth