# Document Format Handlers

## DOCX Handling
Features:
- Paragraph extraction
- Style preservation
- Metadata processing

## PDF Processing
Key capabilities:
- Text extraction
- Page segmentation
- Table recognition

```typescript
// Example from [`office-handler.ts`](src/main/integration/formats/handlers/office-handler.ts)
class OfficeHandler implements FormatHandler {
  private extractTextFromDocx(buffer: Buffer): string {
    // Implementation details
  }
}
```

## HTML Support
- DOM parsing
- Tag sanitization
- Structure preservation

## Format Specifics
1. **Security Considerations**:
- Content sanitization
- Script removal
- Safe attribute filtering

2. **Performance Optimizations**:
- Stream processing
- Parallel extraction
- Caching