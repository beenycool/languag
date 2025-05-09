# Deployment Automation Guide

## Build Process
```bash
# Production build
npm run build:prod

# Development build
npm run build:dev
```

## Deployment Workflow
1. **Version Tagging**:
   ```bash
   npm version patch|minor|major
   ```

2. **CI/CD Pipeline**:
   - Triggered on git tag push
   - Runs tests from [`src/__tests__/`](src/__tests__/)
   - Builds production artifacts
   - Deploys to staging/production

## Version Management
- Follows semantic versioning (semver)
- Version stored in [`package.json`](package.json)
- Backward compatibility checks via [`src/platform/__tests__/compatibility`](src/platform/__tests__/compatibility)

## Rollback Procedures
1. Identify bad release:
   ```bash
   npm view @your/package versions
   ```

2. Revert to previous version:
   ```bash
   npm install @your/package@last-known-good
   ```

3. Emergency rollback script:
   ```javascript
   // See [`src/main/services/config-manager.ts`](src/main/services/config-manager.ts)
   // for configuration rollback implementation