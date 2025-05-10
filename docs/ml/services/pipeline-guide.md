# ML Pipeline Guide

## Configuration
Pipeline components are configured in `pipeline.yaml`:
```yaml
stages:
  - name: text-preprocessing
    type: adapter
    config: 
      clean_html: true
      normalize: true

  - name: feature-extraction
    type: transformer
    config:
      features: ['tfidf', 'word_embeddings']
```

## Feature Extraction
Supported extractors:
1. Text features (`src/ml/__tests__/services/pipeline/feature-extractor.spec.ts`)
2. Numerical transforms
3. Embedding generators

Example usage:
```typescript
const features = pipeline.extractFeatures(text, {
  cache: true,
  batchSize: 32
});
```

## Model Selection
Selection strategies:
- Accuracy-based
- Latency-optimized
- Resource-constrained

```bash
$ ml-pipeline select-model \
  --constraints 'latency<100ms' \
  --dataset validation.json
```

## Pipeline Optimization
Performance tuning:
```json
{
  "parallelStages": 2,
  "batchSize": 64,
  "memoryCache": true
}