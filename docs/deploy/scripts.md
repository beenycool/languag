# Deployment Scripts Guide

## Core Scripts
1. **Build Script**:
   ```bash
   # Defined in package.json
   npm run build
   ```

2. **Test Script**:
   ```bash
   # Runs all tests from src/__tests__/
   npm test
   ```

## Configuration
- Environment variables loaded from `.env`
- Configuration managed by [`src/main/services/config-manager.ts`](src/main/services/config-manager.ts)

## Customization
```javascript
// Example: Custom build configuration
// See [`src/main/llm/ollama-connector.ts`](src/main/llm/ollama-connector.ts)
const customConfig = {
  timeout: 30000,
  retries: 3
};
```

## Troubleshooting
1. **Build Failures**:
   - Check Node.js version compatibility
   - Verify dependencies in `package.json`

2. **Runtime Errors**:
   - Review monitoring logs from [`src/monitoring/core/collectors`](src/monitoring/core/collectors)
   - Check error reports in [`src/shared/types/llm.ts`](src/shared/types/llm.ts)

3. **Common Issues**:
   ```bash
   # Clean and rebuild
   rm -rf node_modules && npm install