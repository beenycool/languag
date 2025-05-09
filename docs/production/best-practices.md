# Production Best Practices

## Coding Standards
1. **Style Guide**:
   - Follow TypeScript strict mode
   - Use ESLint rules from `package.json`
   - Consistent naming from [`src/shared/types`](src/shared/types)

## Security Guidelines
1. **Input Validation**:
   ```typescript
   // From src/shared/utils/sanitization.ts
   sanitizeInput(userInput);
   ```

2. **Secrets Management**:
   - Never commit secrets
   - Use environment variables
   - Rotate credentials regularly

## Performance Tips
1. **Caching**:
   - Leverage [`src/main/services/cache-service.ts`](src/main/services/cache-service.ts)
   - Set appropriate TTLs

2. **Optimizations**:
   - Batch operations
   - Use streaming where possible

## Testing Strategies
1. **Unit Tests**:
   - Cover core logic in [`src/__tests__/`](src/__tests__/)

2. **Integration Tests**:
   - Verify component interactions
   - Test error scenarios