# Text Format Handlers

## Plain Text Handling
- Basic text processing
- Line ending normalization
- Encoding detection

## Markdown Processing
Key features:
- Syntax tree parsing
- Link validation
- Frontmatter extraction

```typescript
// Example from [`markdown-handler.ts`](src/main/integration/formats/handlers/markdown-handler.ts)
class MarkdownHandler implements FormatHandler {
  canHandle(format: string) {
    return format === 'markdown';
  }
}
```

## RTF Support
- Basic RTF parsing
- Style extraction
- Conversion to HTML/Markdown

## Implementation Details
1. **Stream Processing**:
```typescript
processStream(stream: Readable): TransformStream {
  // Implementation from [`text-handler.ts`](src/main/integration/formats/handlers/text-handler.ts)
}
```

2. **Error Recovery**:
- Fallback to plain text
- Partial content processing
- Error boundaries