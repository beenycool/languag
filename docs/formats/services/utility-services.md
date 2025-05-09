# Utility Services for Format Handling

## Format Detection
Features:
- Content sniffing
- Header analysis
- Fallback mechanisms

## Encoding Handling
Key capabilities:
- Automatic detection
- Conversion
- Normalization

```typescript
// Example from [`text-handler.ts`](src/main/integration/formats/handlers/text-handler.ts)
function detectEncoding(buffer: Buffer): string {
  // Implementation details
}
```

## Stream Processing
- Chunked processing
- Backpressure handling
- Error recovery

## Performance Tips
1. **Caching**:
- Use [`format-cache.ts`](src/main/integration/services/cache/format-cache.ts)
- Cache detection results
- Store transformed content

2. **Parallel Processing**:
- Worker pools
- Chunked operations
- Load balancing