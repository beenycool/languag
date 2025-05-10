# ML Adapters Guide

## Model Adaptation
Supported adaptation types:
1. Input/output format conversion
2. Performance optimization
3. Interface standardization

```typescript
// From src/ml/__tests__/integration/adapters/model-adapter.spec.ts
const adapter = new ModelAdapter({
  inputType: 'json',
  outputType: 'protobuf'
});
```

## Data Transformation
Common transformations:
- Normalization
- Tokenization
- Dimensionality reduction

Example configuration:
```yaml
transform:
  steps:
    - type: normalize
      range: [0, 1]
    - type: tokenize
      method: wordpiece
```

## Format Conversion
Supported formats:
| Format | Direction | Implementation |
|--------|-----------|----------------|
| JSON | In/Out | `src/ml/__tests__/integration/adapters/format-adapter.spec.ts` |
| Protobuf | In/Out | Native binding |
| CSV | In | Streaming parser |

## Integration Patterns
Common patterns:
1. Request/response
2. Batch processing
3. Stream processing
4. Hybrid approaches