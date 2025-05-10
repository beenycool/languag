# Analysis Models Guide

## Context Analysis
Key features:
- Entity recognition
- Relationship extraction
- Temporal analysis

```typescript
// From src/ml/__tests__/models/analysis/context-model.spec.ts
const analyzer = new ContextAnalyzer({
  depth: 'deep',
  resolution: 'high'
});
```

## Style Detection
Supported styles:
1. Formality level
2. Tone (casual/professional)
3. Readability score

Example output:
```json
{
  "style": {
    "formality": 0.82,
    "tone": "professional",
    "readability": "college"
  }
}
```

## Pattern Recognition
Common patterns:
- Repetition detection
- Structural patterns
- Semantic similarity clusters

Configuration:
```yaml
pattern:
  minClusterSize: 3
  similarityThreshold: 0.75
  maxPatterns: 10
```

## Model Customization
Custom training options:
```bash
$ ml-train custom \
  --model analysis \
  --dataset ./data/styles.json \
  --params ./config/style-params.yaml