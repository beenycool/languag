# Style Analysis Features

## Style Detection

The style engine analyzes writing style through:

1. **Style Classifier** - Identifies writing styles in [`src/main/analysis/engines/style/style-classifier.ts`](src/main/analysis/engines/style/style-classifier.ts)
2. **Readability Scorer** - Calculates readability metrics in [`src/main/analysis/engines/style/readability-scorer.ts`](src/main/analysis/engines/style/readability-scorer.ts)
3. **Advanced Style Engine** - Coordinates analysis in [`src/main/analysis/engines/style/advanced-style-engine.ts`](src/main/analysis/engines/style/advanced-style-engine.ts)

```typescript
// Example style analysis
import { AdvancedStyleEngine } from '../../src/main/analysis/engines/style/advanced-style-engine';
const styleEngine = new AdvancedStyleEngine();
const styleReport = styleEngine.analyze(text);
```

## Consistency Checking

The system ensures style consistency through:

1. **Document-wide analysis** - Tracks style patterns across the entire text
2. **Section comparison** - Flags inconsistencies between sections
3. **Temporal analysis** - Detects style drift over time

## Performance Considerations

1. **Caching** - Style patterns are cached for repeated analysis
2. **Parallel processing** - Uses [`src/main/analysis/utils/parallel-processor.ts`](src/main/analysis/utils/parallel-processor.ts)
3. **Resource limits** - Analysis is chunked for large documents

## Resource Management

1. **Memory usage** - Limited to 100MB per analysis
2. **CPU throttling** - Analysis yields to main thread
3. **Cleanup** - Resources released after analysis completes