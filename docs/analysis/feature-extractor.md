# Feature Extractor

Extracts linguistic features from processed text segments.

## Feature Types

1. **Lexical Features**:
   - Word frequencies
   - Keyword extraction
   - Vocabulary richness metrics

2. **Syntactic Features**:
   - Sentence structure patterns
   - Phrase detection
   - Grammar rule matches

3. **Stylistic Features**:
   - Readability scores
   - Tone indicators
   - Formality markers

## Configuration

```typescript
interface FeatureExtractorConfig {
  maxKeywords: number; // Maximum keywords to extract
  minKeywordScore: number; // Minimum score for keyword inclusion
  featureWeights: {
    lexical: number;
    syntactic: number;
    stylistic: number;
  };
}
```

## Usage Example

```typescript
import { FeatureExtractor } from '../../src/main/analysis/feature-extractor';

const extractor = new FeatureExtractor({
  maxKeywords: 10,
  minKeywordScore: 0.5,
  featureWeights: {
    lexical: 0.4,
    syntactic: 0.3,
    stylistic: 0.3
  }
});

const features = extractor.process(processedSegments);
```

## Best Practices

- Adjust feature weights based on your analysis goals
- Monitor keyword extraction thresholds for optimal results
- Consider performance impact of complex feature calculations