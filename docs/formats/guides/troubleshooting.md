# Format Handling Troubleshooting

## Common Issues
1. **Encoding Problems**:
- Symptoms: Garbled text
- Solution: Verify and specify encoding

2. **Conversion Failures**:
- Symptoms: Incomplete output
- Solution: Check handler registration

## Performance Tips
1. **Slow Conversions**:
- Enable streaming
- Use worker pools
- Cache results

```typescript
// Example from [`parallel-processor.ts`](src/main/analysis/utils/parallel-processor.ts)
const processor = new ParallelProcessor();
await processor.processInParallel(files);
```

## Security Guidelines
- Always validate input
- Sanitize output
- Use [`content-validator.ts`](src/main/integration/security/validation/content-validator.ts)

## Debugging Help
1. **Logging**:
```typescript
registry.on('transform', (event) => {
  logger.debug('Transform event', event);
});
```

2. **Validation Errors**:
- Check error details
- Review format specifications
- Test with sample files