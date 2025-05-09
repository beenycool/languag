# Extending Format Support

## Creating New Formats
1. Implement `FormatHandler` interface:
```typescript
class CustomHandler implements FormatHandler {
  canHandle(format: string) {
    return format === 'custom';
  }
  
  async transform(content: string) {
    // Transformation logic
  }
}
```

2. Register your handler:
```typescript
registry.registerHandler(new CustomHandler());
```

## Format Conversion
Key considerations:
- Bidirectional conversion
- Lossless transformations
- Metadata preservation

## Testing Guidelines
1. **Unit Tests**:
- Handler registration
- Transformation logic
- Error cases

2. **Integration Tests**:
- End-to-end conversion
- Performance benchmarks
- Cross-format validation

## Best Practices
- Use the [`base-engine.ts`](src/main/analysis/engines/base-engine.ts) as reference
- Implement proper error handling
- Document format specifics