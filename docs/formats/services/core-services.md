# Core Format Services

## Registry System
The format registry ([`format-registry.ts`](src/main/integration/formats/core/format-registry.ts)) provides:
- Handler registration
- Format discovery
- Priority management

## Converter System
Key components:
1. **Content Transformer** ([`content-transformer.ts`](src/main/integration/formats/core/content-transformer.ts))
2. **Format Adapters**
3. **Conversion Pipeline**

## Metadata Handling
- Extraction
- Validation
- Storage

```typescript
// Example from [`metadata-manager.ts`](src/main/integration/formats/core/metadata-manager.ts)
interface FormatMetadata {
  created: Date;
  modified: Date;
  author?: string;
}
```

## Service Patterns
1. **Singleton Registry**
2. **Factory for Handlers**
3. **Decorator for Validation**