# ML Engine Configuration Guide

## Model Registry Setup
```yaml
# config/models/registry.yaml
models:
  - name: "text-classifier-v1"
    framework: "pytorch"
    storageUri: "gs://models/text-classifier/v1"
    inputSchema: "text"
    outputSchema: "probability"
```

## Pipeline Management
```python
from ai.pipelines import TrainingPipeline

pipeline = TrainingPipeline(
    data_loader=CSVLoader('/data/training.csv'),
    preprocessor=TextVectorizer(),
    model=TransformerModel(),
    evaluator=AccuracyEvaluator()
)

pipeline.run(epochs=10, batch_size=32)
```

## Performance Tuning
```bash
# Benchmarking command
ai-engine benchmark --model mobilenet-v3 \
                    --batch-size 128 \
                    --precision fp16
```

[Explore Training Workflows →](../training-guide.md)