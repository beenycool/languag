# Format System Architecture

## Format Registry
All supported formats are registered in the central registry:
```typescript
formatRegistry.register({
  name: 'markdown',
  extensions: ['.md', '.markdown'],
  handler: MarkdownHandler,
  validator: markdownSchemaValidator
});
```

## Content Transformation
Transformation pipeline:
1. Parse input content
2. Apply operations sequentially
3. Serialize output

Example transformation:
```typescript
const result = await transformer.transform({
  format: 'html',
  content: '<div>Sample</div>',
  operations: ['sanitize', 'minify']
});
```

## Metadata Handling
Metadata is preserved through transformations:
```typescript
interface DocumentMetadata {
  source: string;
  created: Date;
  modified: Date;
  security: {
    level: number;
    tags: string[];
  };
}
```

Key features:
- Metadata extraction
- Version tracking
- Content+metadata validation

See implementation: [`src/main/integration/formats/core/format-registry.ts`](../../src/main/integration/formats/core/format-registry.ts)