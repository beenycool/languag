# Shell Integration Developer Guide

## Development Setup
1. **Prerequisites**
   - Node.js 18+
   - Windows SDK
   - Admin privileges for registry operations

2. **Environment Configuration**
   ```bash
   npm install
   npm run build:shell
   ```

## Testing Guidelines
- Use [`src/integration/shell/__tests__/commands/command-registry.spec.ts`](src/integration/shell/__tests__/commands/command-registry.spec.ts) as reference
- Mock registry operations
- Test both success and failure paths

## Common Patterns
```typescript
// Registering a new command
commandRegistry.register({
  id: 'analyze-text',
  handler: analyzeTextHandler,
  permissions: ['read']
});