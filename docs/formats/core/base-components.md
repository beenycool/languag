# Base Components Architecture

## Core Classes
1. **FormatHandler** - Base interface for all format handlers
2. **ContentTransformer** ([`content-transformer.ts`](src/main/integration/formats/core/content-transformer.ts)) - Core transformation logic
3. **MetadataManager** ([`metadata-manager.ts`](src/main/integration/formats/core/metadata-manager.ts)) - Handles format metadata

## Extension Points
```typescript
interface FormatHandler {
  canHandle(format: string): boolean;
  transform(content: string): Promise<TransformedContent>;
}
```

## Common Patterns
1. **Handler Registration**:
```typescript
registry.registerHandler(new HtmlHandler());
```

2. **Content Transformation**:
```typescript
const transformed = await transformer.transform(content, 'html', 'markdown');
```

## Best Practices
- Implement proper content validation
- Use streaming for large files
- Cache transformation results