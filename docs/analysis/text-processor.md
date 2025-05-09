# Text Processor

Handles text segmentation, tokenization, and normalization for analysis.

## Core Functionality

- **Text Segmentation**: Splits input text into manageable segments
- **Tokenization**: Breaks text into tokens for analysis
- **Normalization**: Standardizes text (case, whitespace, etc.)

## Configuration

```typescript
interface TextProcessorConfig {
  maxInputLength: number; // Maximum allowed input size (in characters)
  preserveWhitespace: boolean; // Whether to maintain original whitespace
  normalizationRules: {
    case: 'lower'|'original'; // Case normalization strategy
    trim: boolean; // Whether to trim whitespace
  };
}
```

## Usage Example

```typescript
import { TextProcessor } from '../../src/main/analysis/text-processor';

const processor = new TextProcessor({
  maxInputLength: 10000,
  preserveWhitespace: false,
  normalizationRules: {
    case: 'lower',
    trim: true
  }
});

const segments = processor.process("Sample text to analyze");
```

## Best Practices

- Set reasonable `maxInputLength` based on your use case
- Consider memory usage when processing large texts
- Normalize text consistently across your pipeline