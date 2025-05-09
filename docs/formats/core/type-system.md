# Format Type System

## Type Definitions
Core types defined in:
- [`src/shared/types/analysis.ts`](src/shared/types/analysis.ts)
- [`src/main/integration/types/message-types.ts`](src/main/integration/types/message-types.ts)

```typescript
interface FormatMetadata {
  type: string;
  version: string;
  encoding: string;
  securityFlags: SecurityLevel[];
}
```

## Interface Contracts
1. **Content Validation**:
```typescript
interface ContentValidator {
  validate(content: string): ValidationResult;
}
```

2. **Transformation**:
```typescript
interface ContentTransformer {
  transform(content: string, options?: TransformOptions): Promise<string>;
}
```

## Validation Patterns
1. **Schema Validation**:
```typescript
const schema = {
  type: 'object',
  properties: {
    content: { type: 'string' }
  }
};
```

2. **Content Sanitization**:
```typescript
function sanitize(content: string): string {
  // Implementation from [`sanitization.spec.ts`](src/shared/utils/__tests__/sanitization.spec.ts)
}
```

## Type Safety Measures
- Runtime type checking
- Schema validation
- Strict TypeScript interfaces