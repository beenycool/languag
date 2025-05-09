# Extending Analysis Engines

## Creating Custom Engines

1. **Base Engine Implementation**:
```typescript
import { BaseEngine } from '../../src/main/analysis/engines/base-engine';

class CustomEngine extends BaseEngine {
  async analyze(text: string, context?: AnalysisContext) {
    // Custom analysis logic
    return { results: [], metrics: {} };
  }
}
```

2. **Registration**:
```typescript
// Register with coordinator
coordinator.registerEngine('custom', new CustomEngine());
```

## Adding New Rules

1. **Grammar Rules**:
```typescript
// In src/main/analysis/engines/grammar/grammar-rules/
export const customRules: GrammarRule[] = [
  {
    id: 'custom-rule',
    check: (token) => { /* rule logic */ },
    message: 'Custom rule violation'
  }
];
```

## Security Requirements

1. **Input Validation**:
- Must validate all external inputs
- Use [`src/shared/utils/sanitization.ts`](src/shared/utils/sanitization.ts)

2. **Output Sanitization**:
- Remove any sensitive data
- Escape HTML/JS in suggestions

## Testing Guidelines

1. **Unit Tests**:
```typescript
describe('CustomEngine', () => {
  it('should analyze text correctly', () => {
    const engine = new CustomEngine();
    const result = engine.analyze('sample');
    expect(result).toMatchSnapshot();
  });
});
```

2. **Integration Tests**:
- Verify engine works with coordinator
- Test error handling scenarios