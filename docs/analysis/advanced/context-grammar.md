# Context-Aware Grammar Analysis

## Rule System Architecture

The grammar engine uses a hierarchical rule system:

1. **Base Rules** - Fundamental grammar checks from [`src/main/analysis/engines/grammar/grammar-rules/base-rules.ts`](src/main/analysis/engines/grammar/grammar-rules/base-rules.ts)
2. **Context Rules** - Paragraph-aware checks from [`src/main/analysis/engines/grammar/grammar-rules/context-rules.ts`](src/main/analysis/engines/grammar/grammar-rules/context-rules.ts)
3. **Genre Rules** - Style-specific checks from [`src/main/analysis/engines/grammar/grammar-rules/genre-rules.ts`](src/main/analysis/engines/grammar/grammar-rules/genre-rules.ts)

```typescript
// Example rule application
import { ContextGrammarEngine } from '../../src/main/analysis/engines/grammar/context-grammar-engine';
const engine = new ContextGrammarEngine();
const results = engine.analyze(text, context);
```

## Multi-Paragraph Analysis

The system maintains context through:

1. **Document Context** - Tracks document-level state in [`src/main/analysis/context/document-context.ts`](src/main/analysis/context/document-context.ts)
2. **Paragraph Segmenter** - Identifies paragraph boundaries in [`src/main/analysis/context/paragraph-segmenter.ts`](src/main/analysis/context/paragraph-segmenter.ts)
3. **Context Cache** - Stores intermediate results in [`src/main/analysis/context/context-cache.ts`](src/main/analysis/context/context-cache.ts)

## Security Best Practices

1. **Input Validation**:
   ```typescript
   import { sanitizeInput } from '../../src/shared/utils/sanitization';
   const safeText = sanitizeInput(rawText);
   ```
2. **Rule Validation** - All custom rules are validated before execution
3. **Result Sanitization** - Suggestions are filtered for security