# ML Optimization Guide

## Gradient Descent Setup
```python
optimizer = torch.optim.Adam(
    model.parameters(),
    lr=0.001,
    betas=(0.9, 0.999),
    weight_decay=0.01
)
```

## Learning Rate Tuning Strategies
1. Linear warmup
2. Cosine decay
3. Cyclical learning rates
4. Adaptive methods (Adam, RMSprop)

## Regularization Techniques
| Technique | Implementation | Effect |
|-----------|----------------|--------|
| L2 Regularization | weight_decay=0.01 | Prevents large weights |
| Dropout | nn.Dropout(0.2) | Reduces overfitting |
| Early Stopping | monitor='val_loss' | Prevents overtraining |

## Performance Tips
- Use mixed precision training
- Enable gradient checkpointing
- Optimize batch sizes for your hardware
- Profile with torch.profiler